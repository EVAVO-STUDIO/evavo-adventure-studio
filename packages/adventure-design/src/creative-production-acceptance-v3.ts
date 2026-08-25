import type {
  AdventureCreativeAcceptedDeliveryV3,
  AdventureCreativeHandoffIssueV3,
  AdventureCreativeReviewV3,
  AdventureCreativeTaskKindV3,
  AdventureCreativeWorkOrderV3,
} from "./creative-production-handoff-v3.js";

const animationKinds = new Set<AdventureCreativeTaskKindV3>([
  "animation-sequence",
  "cutscene-shot",
  "effects-sequence",
]);

const nonEmpty = (value: string | undefined): boolean => Boolean(value?.trim());

export const validateAdventureCreativeAcceptedDeliveryV3 = (
  order: AdventureCreativeWorkOrderV3,
  review: AdventureCreativeReviewV3,
  delivery: AdventureCreativeAcceptedDeliveryV3,
): readonly AdventureCreativeHandoffIssueV3[] => {
  const issues: AdventureCreativeHandoffIssueV3[] = [];
  if (review.disposition !== "accepted") {
    issues.push({ code: "review-not-accepted", message: "Only an accepted review may produce an Adventure Studio delivery." });
  }
  if (
    delivery.deliveryVersion !== 3 ||
    delivery.workOrderId !== order.workOrderId ||
    delivery.revision !== order.revision ||
    delivery.assetId !== order.assetId
  ) {
    issues.push({ code: "delivery-authority-mismatch", message: "Delivery must target the exact v3 work order revision and asset." });
  }
  if (delivery.approvedArtifactDigest !== review.candidateArtifactDigest) {
    issues.push({ code: "delivery-byte-mismatch", message: "The delivered artifact digest must be the exact artifact digest accepted by review." });
  }
  if (!Number.isSafeInteger(delivery.approvedByteLength) || delivery.approvedByteLength <= 0 || !nonEmpty(delivery.mediaType)) {
    issues.push({ code: "invalid-delivery-bytes", message: "Delivery requires positive byte length and media type." });
  }
  if (
    delivery.nativeSize.width !== order.nativeSize.width ||
    delivery.nativeSize.height !== order.nativeSize.height
  ) {
    issues.push({ code: "delivery-size-mismatch", message: "Delivery dimensions must exactly match the approved native work-order canvas." });
  }
  if (!nonEmpty(delivery.reviewEvidenceDigest) || delivery.reviewEvidenceDigest !== review.reviewerEvidenceDigest) {
    issues.push({ code: "review-evidence-mismatch", message: "Delivery must retain the exact review evidence digest that accepted the candidate." });
  }
  if (order.alphaPolicy !== "opaque") {
    if (!review.alphaEvidenceDigest || delivery.alphaEvidenceDigest !== review.alphaEvidenceDigest) {
      issues.push({ code: "alpha-evidence-mismatch", message: "Transparent delivery must retain the exact accepted alpha evidence." });
    }
  }
  if (animationKinds.has(order.taskKind)) {
    if (!review.sequenceEvidenceDigest || delivery.sequenceEvidenceDigest !== review.sequenceEvidenceDigest) {
      issues.push({ code: "sequence-evidence-mismatch", message: "Animation delivery must retain the exact accepted sequence evidence." });
    }
  }
  const requiredLineage = [
    order.sourceRevisionDigest,
    order.authorities.styleDigest,
    order.authorities.paletteDigest,
    order.authorities.modelSheetDigest,
    order.authorities.environmentLayoutDigest,
    order.authorities.xSheetDigest,
    order.authorities.previousApprovedArtifactDigest,
    ...order.authorities.referenceDigests,
  ].filter((value): value is string => Boolean(value));
  const lineage = new Set(delivery.sourceLineageDigests);
  for (const digest of requiredLineage) {
    if (!lineage.has(digest)) {
      issues.push({ code: "missing-source-lineage", message: `Delivery is missing governing lineage digest '${digest}'.` });
    }
  }
  return issues;
};

export const assertAdventureCreativeAcceptedDeliveryV3 = (
  order: AdventureCreativeWorkOrderV3,
  review: AdventureCreativeReviewV3,
  delivery: AdventureCreativeAcceptedDeliveryV3,
): AdventureCreativeAcceptedDeliveryV3 => {
  const issues = validateAdventureCreativeAcceptedDeliveryV3(order, review, delivery);
  if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join(" "));
  return delivery;
};