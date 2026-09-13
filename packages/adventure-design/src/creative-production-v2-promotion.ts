import {
  acceptedAdventureCreativeEvidence,
  type AdventureCreativeProductionSession,
} from "./creative-production-session.js";
import type {
  AdventureAnimationFramePlan,
  AdventureCreativeWorkOrder,
} from "./creative-production-handoff.js";
import {
  evaluateAdventureCreativeCandidateAdmission,
  type AdventureCreativeAdmissionResult,
  type AdventureCreativeCandidateManifestV2,
} from "./creative-handoff-acceptance.js";
import type {
  AdventureCreativeReviewResultV2,
  AdventureCreativeWorkOrderV2,
} from "./creative-handoff-v2.js";

export type AdventureCreativeVersionConsistencyIssueCode =
  | "work-order-id"
  | "project-id"
  | "asset-id"
  | "source-authority"
  | "style-authority"
  | "native-size"
  | "alpha-policy"
  | "model-sheet"
  | "x-sheet"
  | "frame-count"
  | "frame-id"
  | "frame-exposure"
  | "frame-source-rect"
  | "frame-pivot"
  | "frame-foot"
  | "frame-hand"
  | "frame-shadow";

export interface AdventureCreativeVersionConsistencyIssue {
  readonly code: AdventureCreativeVersionConsistencyIssueCode;
  readonly path: string;
  readonly message: string;
}

const samePoint = (
  left: { readonly x: number; readonly y: number } | undefined,
  right: { readonly x: number; readonly y: number } | undefined,
): boolean =>
  left === undefined && right === undefined ||
  left !== undefined && right !== undefined && left.x === right.x && left.y === right.y;

const sameRect = (
  left: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | undefined,
  right: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | undefined,
): boolean =>
  left === undefined && right === undefined ||
  left !== undefined && right !== undefined &&
    left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;

const compareFramePlans = (
  v1: readonly AdventureAnimationFramePlan[],
  v2: NonNullable<AdventureCreativeWorkOrderV2["framePlan"]>,
): readonly AdventureCreativeVersionConsistencyIssue[] => {
  const issues: AdventureCreativeVersionConsistencyIssue[] = [];
  if (v1.length !== v2.length) {
    issues.push({ code: "frame-count", path: "framePlan", message: `v1 expects ${v1.length} frames while v2 expects ${v2.length}.` });
  }
  const count = Math.min(v1.length, v2.length);
  for (let index = 0; index < count; index += 1) {
    const left = v1[index];
    const right = v2[index];
    if (!left || !right) continue;
    const path = `framePlan[${index}]`;
    if (left.frameId !== right.frameId) issues.push({ code: "frame-id", path, message: `Frame identity differs: '${left.frameId}' vs '${right.frameId}'.` });
    if (left.exposureTicks !== right.exposureTicks) issues.push({ code: "frame-exposure", path, message: `Frame '${left.frameId}' exposure differs: ${left.exposureTicks} vs ${right.exposureTicks}.` });
    if (!sameRect(left.sourceRect, right.sourceRect)) issues.push({ code: "frame-source-rect", path, message: `Frame '${left.frameId}' source rectangle differs between production contracts.` });
    if (!samePoint(left.pivot, right.pivot)) issues.push({ code: "frame-pivot", path, message: `Frame '${left.frameId}' pivot differs between production contracts.` });
    if (!samePoint(left.footPoint, right.footPoint)) issues.push({ code: "frame-foot", path, message: `Frame '${left.frameId}' foot point differs between production contracts.` });
    if (!samePoint(left.handAnchor, right.handAnchor)) issues.push({ code: "frame-hand", path, message: `Frame '${left.frameId}' hand anchor differs between production contracts.` });
    if (!samePoint(left.shadowAnchor, right.shadowAnchor)) issues.push({ code: "frame-shadow", path, message: `Frame '${left.frameId}' shadow anchor differs between production contracts.` });
  }
  return issues;
};

export const compareAdventureCreativeContractVersions = (
  v1: AdventureCreativeWorkOrder,
  v2: AdventureCreativeWorkOrderV2,
): readonly AdventureCreativeVersionConsistencyIssue[] => {
  const issues: AdventureCreativeVersionConsistencyIssue[] = [];
  if (v1.workOrderId !== v2.workOrderId) issues.push({ code: "work-order-id", path: "workOrderId", message: "v1 and v2 work-order identities differ." });
  if (String(v1.projectId) !== String(v2.projectId)) issues.push({ code: "project-id", path: "projectId", message: "v1 and v2 project identities differ." });
  if (String(v1.assetId) !== String(v2.assetId)) issues.push({ code: "asset-id", path: "assetId", message: "v1 and v2 asset identities differ." });
  if (v1.sourceRevisionDigest !== v2.sourceRevisionDigest) issues.push({ code: "source-authority", path: "sourceRevisionDigest", message: "v1 and v2 source revision authorities differ." });
  if (v1.visualStandardDigest !== v2.style.styleDigest) issues.push({ code: "style-authority", path: "style.styleDigest", message: "v1 visual standard and v2 style authority differ." });
  if (v1.nativeSize.width !== v2.nativeSize.width || v1.nativeSize.height !== v2.nativeSize.height) issues.push({ code: "native-size", path: "nativeSize", message: "v1 and v2 native canvas dimensions differ." });
  if (v1.alphaPolicy !== v2.alphaPolicy) issues.push({ code: "alpha-policy", path: "alphaPolicy", message: "v1 and v2 alpha policies differ." });
  if ((v1.characterModelSheetDigest ?? undefined) !== (v2.style.modelSheetDigest ?? undefined)) issues.push({ code: "model-sheet", path: "style.modelSheetDigest", message: "v1 and v2 model-sheet authorities differ." });
  if ((v1.xSheetDigest ?? undefined) !== (v2.sequencePolicy?.xSheetDigest ?? undefined)) issues.push({ code: "x-sheet", path: "sequencePolicy.xSheetDigest", message: "v1 and v2 X-sheet authorities differ." });
  if (v1.taskKind === "animation-sequence" || v2.taskKind === "animation-sequence") {
    issues.push(...compareFramePlans(v1.framePlan ?? [], v2.framePlan ?? []));
  }
  return issues;
};

export interface AdventureCreativePromotionResult {
  readonly readyForMastering: boolean;
  readonly consistencyIssues: readonly AdventureCreativeVersionConsistencyIssue[];
  readonly admission: AdventureCreativeAdmissionResult;
  readonly sessionAccepted: boolean;
  readonly acceptedSessionCandidateDigest: string | null;
}

export const evaluateAdventureCreativePromotion = (
  session: AdventureCreativeProductionSession,
  v2Order: AdventureCreativeWorkOrderV2,
  candidate: AdventureCreativeCandidateManifestV2,
  review: AdventureCreativeReviewResultV2,
): AdventureCreativePromotionResult => {
  const consistencyIssues = compareAdventureCreativeContractVersions(session.workOrder, v2Order);
  const accepted = acceptedAdventureCreativeEvidence(session);
  const admission = evaluateAdventureCreativeCandidateAdmission(v2Order, candidate, review);
  const sessionDigestMatches = accepted?.candidateDigest === candidate.candidateDigest;
  const sessionAccepted = Boolean(accepted) && sessionDigestMatches;
  return {
    readyForMastering: consistencyIssues.length === 0 && sessionAccepted && admission.accepted,
    consistencyIssues,
    admission,
    sessionAccepted,
    acceptedSessionCandidateDigest: accepted?.candidateDigest ?? null,
  };
};
