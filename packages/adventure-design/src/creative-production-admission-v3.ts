import type {
  AdventureCreativeAcceptedDeliveryV3,
  AdventureCreativeReviewV3,
  AdventureCreativeWorkOrderV3,
} from "./creative-production-handoff-v3.js";
import { decideAdventureCreativeIterationV3 } from "./creative-production-orchestrator-v3.js";
import type { AdventureCreativeStrictQualityEvidenceV3 } from "./creative-production-quality-v3.js";

export interface AdventureCreativeDeliveryAdmissionIssueV3 {
  readonly code: string;
  readonly message: string;
}

const issue = (code: string, message: string): AdventureCreativeDeliveryAdmissionIssueV3 => ({ code, message });

const requiredLineage = (order: AdventureCreativeWorkOrderV3): readonly string[] =>
  [
    order.sourceRevisionDigest,
    order.authorities.styleDigest,
    order.authorities.paletteDigest,
    order.authorities.modelSheetDigest,
    order.authorities.environmentLayoutDigest,
    order.authorities.xSheetDigest,
    order.authorities.previousApprovedArtifactDigest,
    ...order.authorities.referenceDigests,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right));

export const validateAdventureCreativeDeliveryAdmissionV3 = (
  order: AdventureCreativeWorkOrderV3,
  review: AdventureCreativeReviewV3,
  quality: AdventureCreativeStrictQualityEvidenceV3,
  delivery: AdventureCreativeAcceptedDeliveryV3,
): readonly AdventureCreativeDeliveryAdmissionIssueV3[] => {
  const issues: AdventureCreativeDeliveryAdmissionIssueV3[] = [];
  const decision = decideAdventureCreativeIterationV3(order, review, quality);
  if (decision.kind !== "deliver") {
    issues.push(issue("not-deliverable", `Creative revision is '${decision.kind}', not deliverable.`));
  }
  if (delivery.deliveryVersion !== 3) issues.push(issue("wrong-version", "Creative delivery requires deliveryVersion=3."));
  if (delivery.workOrderId !== order.workOrderId) issues.push(issue("work-order-mismatch", "Creative delivery targets a different work order."));
  if (delivery.revision !== order.revision) issues.push(issue("revision-mismatch", "Creative delivery targets a different revision."));
  if (delivery.assetId !== order.assetId) issues.push(issue("asset-mismatch", "Creative delivery asset ID does not match the work order."));
  if (delivery.approvedArtifactDigest !== review.candidateArtifactDigest || delivery.approvedArtifactDigest !== quality.candidateArtifactDigest) {
    issues.push(issue("artifact-mismatch", "Creative delivery bytes do not match the exact reviewed/strict-QA candidate digest."));
  }
  if (
    delivery.nativeSize.width !== order.nativeSize.width ||
    delivery.nativeSize.height !== order.nativeSize.height
  ) {
    issues.push(issue("native-size-mismatch", "Creative delivery native canvas differs from the approved work order."));
  }
  if (!Number.isSafeInteger(delivery.approvedByteLength) || delivery.approvedByteLength <= 0) {
    issues.push(issue("invalid-byte-length", "Creative delivery must report a positive safe byte length."));
  }
  if (!delivery.mediaType.trim()) issues.push(issue("missing-media-type", "Creative delivery must declare a media type."));
  if (delivery.reviewEvidenceDigest !== review.reviewerEvidenceDigest) {
    issues.push(issue("review-evidence-mismatch", "Creative delivery review evidence does not match the accepted review."));
  }
  if (order.alphaPolicy !== "opaque") {
    if (!review.alphaEvidenceDigest || delivery.alphaEvidenceDigest !== review.alphaEvidenceDigest) {
      issues.push(issue("alpha-evidence-mismatch", "Transparent delivery must carry the exact accepted alpha evidence digest."));
    }
  }
  const animation = order.taskKind === "animation-sequence" || order.taskKind === "cutscene-shot" || order.taskKind === "effects-sequence";
  if (animation) {
    if (!review.sequenceEvidenceDigest || delivery.sequenceEvidenceDigest !== review.sequenceEvidenceDigest) {
      issues.push(issue("sequence-evidence-mismatch", "Animation delivery must carry the exact accepted sequence evidence digest."));
    }
  }
  const lineage = new Set(delivery.sourceLineageDigests);
  for (const digest of requiredLineage(order)) {
    if (!lineage.has(digest)) {
      issues.push(issue("missing-lineage", `Creative delivery lineage is missing required authority '${digest}'.`));
    }
  }
  return issues.sort((left, right) => left.code.localeCompare(right.code) || left.message.localeCompare(right.message));
};

export const admitAdventureCreativeDeliveryV3 = (
  order: AdventureCreativeWorkOrderV3,
  review: AdventureCreativeReviewV3,
  quality: AdventureCreativeStrictQualityEvidenceV3,
  delivery: AdventureCreativeAcceptedDeliveryV3,
): AdventureCreativeAcceptedDeliveryV3 => {
  const issues = validateAdventureCreativeDeliveryAdmissionV3(order, review, quality, delivery);
  if (issues.length > 0) throw new Error(issues.map((entry) => entry.message).join(" "));
  return delivery;
};