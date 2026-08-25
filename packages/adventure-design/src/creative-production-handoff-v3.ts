export type AdventureCreativeStudioDestinationV3 = "art-studio" | "cel-animation-studio";

export type AdventureCreativeTaskKindV3 =
  | "background-layout"
  | "background-paint"
  | "foreground-plate"
  | "prop"
  | "ui-art"
  | "portrait-closeup"
  | "character-model-sheet"
  | "character-key-pose"
  | "animation-sequence"
  | "cutscene-shot"
  | "effects-sequence";

export type AdventureCreativeIssueCodeV3 =
  | "identity-drift"
  | "proportion-drift"
  | "costume-drift"
  | "style-drift"
  | "palette-drift"
  | "perspective-drift"
  | "layout-drift"
  | "silhouette-drift"
  | "pose-drift"
  | "anchor-drift"
  | "ground-contact-drift"
  | "frame-count-mismatch"
  | "frame-order-mismatch"
  | "exposure-timing-mismatch"
  | "loop-closure-mismatch"
  | "neighbour-continuity-mismatch"
  | "crop-or-safe-bounds"
  | "occlusion-mismatch"
  | "fake-transparency-checkerboard"
  | "missing-real-alpha"
  | "matte-residue"
  | "alpha-halo"
  | "transparent-rgb-contamination"
  | "soft-alpha-when-binary-required"
  | "unexpected-text-or-symbol"
  | "reference-authority-mismatch"
  | "source-byte-mismatch";

export type AdventureCreativeReviewDispositionV3 =
  | "candidate"
  | "repair-required"
  | "review-required"
  | "accepted"
  | "rejected";

export interface AdventureCreativeFramePlanV3 {
  readonly frameId: string;
  readonly role:
    | "hold"
    | "contact"
    | "passing"
    | "extreme"
    | "breakdown"
    | "inbetween"
    | "smear"
    | "replacement";
  readonly exposureTicks: number;
  readonly sourceRect?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly pivot?: { readonly x: number; readonly y: number };
  readonly footPoint?: { readonly x: number; readonly y: number };
  readonly handAnchors?: Readonly<Record<string, { readonly x: number; readonly y: number }>>;
  readonly shadowAnchor?: { readonly x: number; readonly y: number };
  readonly requiredNeighbourFrameIds: readonly string[];
  readonly preserveFromApprovedFrameId?: string;
}

export interface AdventureCreativeRepairScopeV3 {
  readonly issueId: string;
  readonly issueCode: AdventureCreativeIssueCodeV3;
  readonly targetFrameIds: readonly string[];
  readonly targetRegion?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly repairInstruction: string;
  readonly preserveFrameIds: readonly string[];
  readonly preserveRegions: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[];
  readonly allowRegenerateWholeAsset: boolean;
}

export interface AdventureCreativeWorkOrderV3 {
  readonly contractVersion: 3;
  readonly workOrderId: string;
  readonly projectId: string;
  readonly assetId: string;
  readonly destinationStudio: AdventureCreativeStudioDestinationV3;
  readonly taskKind: AdventureCreativeTaskKindV3;
  readonly revision: number;
  readonly replacesRevision?: number;
  readonly sourceRevisionDigest: string;
  readonly nativeSize: { readonly width: number; readonly height: number };
  readonly alphaPolicy: "opaque" | "binary" | "soft" | "required";
  readonly preserveNativeCanvas: boolean;
  readonly authorities: {
    readonly profileId: string;
    readonly styleDigest: string;
    readonly paletteDigest?: string;
    readonly modelSheetDigest?: string;
    readonly environmentLayoutDigest?: string;
    readonly xSheetDigest?: string;
    readonly referenceDigests: readonly string[];
    readonly previousApprovedArtifactDigest?: string;
  };
  readonly invariants: readonly string[];
  readonly forbiddenDrift: readonly string[];
  readonly artDirection: readonly string[];
  readonly reviewChecklist: readonly string[];
  readonly rejectionRules: readonly string[];
  readonly framePlan?: readonly AdventureCreativeFramePlanV3[];
  readonly sequencePolicy?: {
    readonly independentFrameGenerationForbidden: true;
    readonly exactExposureTimingRequired: true;
    readonly modelSheetConformanceRequired: boolean;
    readonly xSheetConformanceRequired: boolean;
    readonly immediateNeighbourReviewRequired: boolean;
    readonly loopClosureReviewRequired: boolean;
  };
  readonly transparencyPolicy: {
    readonly checkerboardForbidden: true;
    readonly decodedAlphaRequired: boolean;
    readonly transparentCanvasEdgeRequired: boolean;
    readonly matteResidueForbidden: true;
    readonly haloFringeForbidden: true;
    readonly transparentRgbContaminationForbidden: true;
    readonly hostilePlateReviewRequired: boolean;
  };
  readonly iterationPolicy: {
    readonly maximumRevisionPasses: number;
    readonly compareAgainstPreviousApproved: boolean;
    readonly requireIssueClosureEvidence: true;
    readonly preferTargetedRepair: true;
    readonly fullRegenerationRequiresExplicitReason: true;
  };
  readonly requestedRepairs: readonly AdventureCreativeRepairScopeV3[];
}

export interface AdventureCreativeReviewIssueV3 {
  readonly issueId: string;
  readonly code: AdventureCreativeIssueCodeV3;
  readonly severity: "blocking" | "major" | "minor";
  readonly message: string;
  readonly frameIds: readonly string[];
  readonly region?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly evidenceDigests: readonly string[];
  readonly suggestedRepair: string;
}

export interface AdventureCreativeReviewV3 {
  readonly reviewVersion: 3;
  readonly workOrderId: string;
  readonly revision: number;
  readonly candidateArtifactDigest: string;
  readonly disposition: AdventureCreativeReviewDispositionV3;
  readonly issues: readonly AdventureCreativeReviewIssueV3[];
  readonly closedIssueIds: readonly string[];
  readonly alphaEvidenceDigest?: string;
  readonly sequenceEvidenceDigest?: string;
  readonly styleEvidenceDigest?: string;
  readonly modelSheetEvidenceDigest?: string;
  readonly xSheetEvidenceDigest?: string;
  readonly reviewerEvidenceDigest: string;
}

export interface AdventureCreativeAcceptedDeliveryV3 {
  readonly deliveryVersion: 3;
  readonly workOrderId: string;
  readonly revision: number;
  readonly assetId: string;
  readonly approvedArtifactDigest: string;
  readonly approvedByteLength: number;
  readonly mediaType: string;
  readonly nativeSize: { readonly width: number; readonly height: number };
  readonly alphaEvidenceDigest?: string;
  readonly sequenceEvidenceDigest?: string;
  readonly reviewEvidenceDigest: string;
  readonly sourceLineageDigests: readonly string[];
}

export interface AdventureCreativeHandoffIssueV3 {
  readonly code: string;
  readonly message: string;
}

const nonEmpty = (value: string | undefined): boolean => Boolean(value?.trim());
const animationKinds = new Set<AdventureCreativeTaskKindV3>([
  "animation-sequence",
  "cutscene-shot",
  "effects-sequence",
]);

export const validateAdventureCreativeWorkOrderV3 = (
  order: AdventureCreativeWorkOrderV3,
): readonly AdventureCreativeHandoffIssueV3[] => {
  const issues: AdventureCreativeHandoffIssueV3[] = [];
  if (order.contractVersion !== 3) issues.push({ code: "wrong-version", message: "Creative handoff requires contractVersion=3." });
  if (!Number.isSafeInteger(order.revision) || order.revision <= 0) issues.push({ code: "invalid-revision", message: "Revision must be a positive safe integer." });
  if (order.replacesRevision !== undefined && order.replacesRevision >= order.revision) issues.push({ code: "invalid-revision", message: "Replacement revision must be older than the new revision." });
  if (!Number.isSafeInteger(order.nativeSize.width) || !Number.isSafeInteger(order.nativeSize.height) || order.nativeSize.width <= 0 || order.nativeSize.height <= 0) issues.push({ code: "invalid-size", message: "Native dimensions must be positive integers." });
  if (!nonEmpty(order.sourceRevisionDigest) || !nonEmpty(order.authorities.styleDigest) || !nonEmpty(order.authorities.profileId)) issues.push({ code: "missing-authority", message: "Source revision, style profile and immutable style digest are required." });
  if (!Number.isSafeInteger(order.iterationPolicy.maximumRevisionPasses) || order.iterationPolicy.maximumRevisionPasses <= 0 || !order.iterationPolicy.requireIssueClosureEvidence || !order.iterationPolicy.preferTargetedRepair || !order.iterationPolicy.fullRegenerationRequiresExplicitReason) issues.push({ code: "invalid-iteration-policy", message: "Iteration must be bounded, issue-closure-backed and targeted-repair-first." });
  const alphaRequired = order.alphaPolicy !== "opaque";
  if (order.transparencyPolicy.checkerboardForbidden !== true || order.transparencyPolicy.matteResidueForbidden !== true || order.transparencyPolicy.haloFringeForbidden !== true || order.transparencyPolicy.transparentRgbContaminationForbidden !== true || (alphaRequired && (!order.transparencyPolicy.decodedAlphaRequired || !order.transparencyPolicy.transparentCanvasEdgeRequired || !order.transparencyPolicy.hostilePlateReviewRequired))) {
    issues.push({ code: "invalid-alpha-policy", message: "Transparent work must prove decoded alpha, clear canvas edges, hostile-plate review, no checkerboard, no matte residue, no halo and no contaminated hidden RGB." });
  }
  if (animationKinds.has(order.taskKind)) {
    if (!order.framePlan || order.framePlan.length < 2) issues.push({ code: "missing-frame-plan", message: "Animation work requires an authored frame plan." });
    if (!order.sequencePolicy) issues.push({ code: "missing-sequence-policy", message: "Animation work requires sequence policy." });
    if (!order.authorities.modelSheetDigest) issues.push({ code: "missing-model-sheet", message: "Animation work requires approved model-sheet authority." });
    if (!order.authorities.xSheetDigest) issues.push({ code: "missing-x-sheet", message: "Animation work requires approved X-sheet authority." });
    if (order.sequencePolicy && (!order.sequencePolicy.modelSheetConformanceRequired || !order.sequencePolicy.xSheetConformanceRequired || !order.sequencePolicy.immediateNeighbourReviewRequired)) issues.push({ code: "weak-sequence-policy", message: "Animation requires model-sheet, X-sheet and immediate-neighbour conformance." });
  }
  const frameIds = order.framePlan?.map((frame) => frame.frameId) ?? [];
  if (new Set(frameIds).size !== frameIds.length) issues.push({ code: "duplicate-frame-id", message: "Frame IDs must be unique." });
  for (const repair of order.requestedRepairs) {
    if (!nonEmpty(repair.issueId) || !nonEmpty(repair.repairInstruction)) issues.push({ code: "invalid-repair-scope", message: "Repair scopes require issue identity and a concrete repair instruction." });
    if (repair.allowRegenerateWholeAsset && repair.preserveFrameIds.length > 0) issues.push({ code: "conflicting-repair-scope", message: "Whole-asset regeneration cannot simultaneously claim preserved frame IDs." });
  }
  return issues;
};

export const validateAdventureCreativeReviewV3 = (
  order: AdventureCreativeWorkOrderV3,
  review: AdventureCreativeReviewV3,
): readonly AdventureCreativeHandoffIssueV3[] => {
  const issues: AdventureCreativeHandoffIssueV3[] = [];
  if (review.reviewVersion !== 3 || review.workOrderId !== order.workOrderId || review.revision !== order.revision) issues.push({ code: "review-authority-mismatch", message: "Review must target the exact v3 work order revision." });
  if (!nonEmpty(review.candidateArtifactDigest) || !nonEmpty(review.reviewerEvidenceDigest)) issues.push({ code: "missing-review-evidence", message: "Candidate and reviewer evidence digests are required." });
  const open = review.issues.filter((issue) => !review.closedIssueIds.includes(issue.issueId));
  if (review.disposition === "accepted" && open.length > 0) {
    issues.push({ code: "accepted-with-open-issues", message: "An accepted review cannot retain unresolved blocking, major or minor issues." });
  }
  if (review.disposition === "accepted" && order.alphaPolicy !== "opaque" && !review.alphaEvidenceDigest) issues.push({ code: "missing-alpha-evidence", message: "Transparent accepted work requires alpha evidence." });
  if (review.disposition === "accepted" && animationKinds.has(order.taskKind)) {
    if (!review.sequenceEvidenceDigest) issues.push({ code: "missing-sequence-evidence", message: "Accepted animation requires sequence evidence." });
    if (!review.modelSheetEvidenceDigest) issues.push({ code: "missing-model-sheet-evidence", message: "Accepted animation requires model-sheet conformance evidence." });
    if (!review.xSheetEvidenceDigest) issues.push({ code: "missing-x-sheet-evidence", message: "Accepted animation requires X-sheet conformance evidence." });
  }
  return issues;
};

export const nextAdventureCreativeRepairOrderV3 = (
  order: AdventureCreativeWorkOrderV3,
  review: AdventureCreativeReviewV3,
): AdventureCreativeWorkOrderV3 => {
  const reviewIssues = validateAdventureCreativeReviewV3(order, review);
  if (reviewIssues.length > 0) throw new Error(reviewIssues.map((issue) => issue.message).join(" "));
  if (review.disposition !== "repair-required" && review.disposition !== "review-required") {
    throw new Error(`Cannot create a repair revision from '${review.disposition}'.`);
  }
  if (order.revision >= order.iterationPolicy.maximumRevisionPasses) {
    throw new Error(`Maximum revision passes (${order.iterationPolicy.maximumRevisionPasses}) reached.`);
  }
  const open = review.issues.filter((issue) => !review.closedIssueIds.includes(issue.issueId));
  const repairTargetFrameIds = new Set(open.flatMap((issue) => issue.frameIds));
  const protectedFrameIds = (order.framePlan ?? [])
    .map((frame) => frame.frameId)
    .filter((frameId) => !repairTargetFrameIds.has(frameId));
  return {
    ...order,
    revision: order.revision + 1,
    replacesRevision: order.revision,
    authorities: {
      ...order.authorities,
      previousApprovedArtifactDigest: order.authorities.previousApprovedArtifactDigest,
    },
    requestedRepairs: open.map((issue) => ({
      issueId: issue.issueId,
      issueCode: issue.code,
      targetFrameIds: issue.frameIds,
      ...(issue.region ? { targetRegion: issue.region } : {}),
      repairInstruction: issue.suggestedRepair,
      preserveFrameIds: protectedFrameIds,
      preserveRegions: [],
      allowRegenerateWholeAsset: false,
    })),
  };
};
