import type { Id, Point, Rectangle } from "@evavo/adventure-project-schema";

export type AdventureCreativeDestination = "art-studio" | "cel-animation-studio";
export type AdventureCreativeTaskKind =
  | "background"
  | "foreground-plate"
  | "prop"
  | "ui-art"
  | "character-model-sheet"
  | "character-key-pose"
  | "animation-sequence"
  | "cutscene-shot";
export type AdventureCreativeAlphaPolicy = "opaque" | "binary" | "soft" | "required";
export type AdventureCreativeReviewDecision = "accepted" | "revise" | "rejected";

export interface AdventureCreativeFramePlan {
  readonly frameId: string;
  readonly role: "hold" | "contact" | "passing" | "extreme" | "breakdown" | "inbetween" | "smear" | "replacement";
  readonly exposureTicks: number;
  readonly sourceRect?: Rectangle;
  readonly pivot?: Point;
  readonly footPoint?: Point;
  readonly handAnchor?: Point;
  readonly shadowAnchor?: Point;
  readonly requiredNeighbourFrameIds?: readonly string[];
}

export interface AdventureCreativeStyleLock {
  readonly profileId: string;
  readonly styleDigest: string;
  readonly paletteDigest?: string;
  readonly modelSheetDigest?: string;
  readonly environmentLayoutDigest?: string;
  readonly referenceDigests: readonly string[];
  readonly invariants: readonly string[];
  readonly forbiddenDrift: readonly string[];
}

export interface AdventureCreativeWorkOrderV2 {
  readonly contractVersion: 2;
  readonly workOrderId: string;
  readonly projectId: Id<"project"> | string;
  readonly assetId: Id<"asset"> | string;
  readonly destinationStudio: AdventureCreativeDestination;
  readonly taskKind: AdventureCreativeTaskKind;
  readonly revision: number;
  readonly replacesRevision?: number;
  readonly sourceRevisionDigest: string;
  readonly nativeSize: { readonly width: number; readonly height: number };
  readonly alphaPolicy: AdventureCreativeAlphaPolicy;
  readonly preserveNativeCanvas: boolean;
  readonly style: AdventureCreativeStyleLock;
  readonly framePlan?: readonly AdventureCreativeFramePlan[];
  readonly loop?: boolean;
  readonly artDirection: readonly string[];
  readonly reviewChecklist: readonly string[];
  readonly rejectionRules: readonly string[];
  readonly iterationPolicy: {
    readonly maximumRevisionPasses: number;
    readonly compareAgainstPreviousApproved: boolean;
    readonly requireIssueClosureEvidence: boolean;
  };
  readonly transparencyPolicy: {
    readonly checkerboardForbidden: true;
    readonly decodedAlphaRequired: boolean;
    readonly transparentCanvasEdgeRequired: boolean;
    readonly matteResidueForbidden: true;
    readonly haloFringeForbidden: true;
    readonly hostilePlateReviewRequired: boolean;
  };
  readonly sequencePolicy?: {
    readonly independentFrameGenerationForbidden: true;
    readonly neighbourConditioningRequired: boolean;
    readonly modelSheetConformanceRequired: boolean;
    readonly xSheetDigest?: string;
    readonly xSheetConformanceRequired: boolean;
    readonly loopClosureReviewRequired: boolean;
    readonly exactExposureTimingRequired: true;
  };
}

export interface AdventureCreativeReviewIssue {
  readonly code:
    | "wrong-canvas"
    | "wrong-frame-count"
    | "frame-order"
    | "timing-mismatch"
    | "pivot-drift"
    | "foot-contact"
    | "anchor-drift"
    | "identity-drift"
    | "style-drift"
    | "palette-drift"
    | "fake-transparency"
    | "matte-residue"
    | "alpha-halo"
    | "soft-alpha-forbidden"
    | "crop"
    | "neighbour-discontinuity"
    | "loop-seam"
    | "unreviewed";
  readonly severity: "error" | "warning";
  readonly frameId?: string;
  readonly message: string;
  readonly evidenceDigest?: string;
}

export interface AdventureCreativeReviewResultV2 {
  readonly contractVersion: 2;
  readonly workOrderId: string;
  readonly revision: number;
  readonly candidateDigest: string;
  readonly decision: AdventureCreativeReviewDecision;
  readonly issues: readonly AdventureCreativeReviewIssue[];
  readonly reviewedFrameIds: readonly string[];
  readonly alphaEvidenceDigest?: string;
  readonly sequenceEvidenceDigest?: string;
  readonly styleEvidenceDigest?: string;
  readonly reviewer: string;
  readonly reviewedAt: string;
}

export type AdventureCreativeContractIssueCode =
  | "invalid-id"
  | "invalid-revision"
  | "invalid-size"
  | "destination-task-mismatch"
  | "alpha-policy"
  | "frame-plan-required"
  | "duplicate-frame"
  | "frame-outside-canvas"
  | "invalid-exposure"
  | "sequence-policy-required"
  | "style-authority-missing"
  | "review-policy-missing";

export interface AdventureCreativeContractIssue {
  readonly code: AdventureCreativeContractIssueCode;
  readonly path: string;
  readonly message: string;
}

const isNonEmpty = (value: string | undefined): boolean => Boolean(value?.trim());
const isAnimationTask = (kind: AdventureCreativeTaskKind): boolean =>
  kind === "animation-sequence" || kind === "cutscene-shot";
const destinationAccepts = (
  destination: AdventureCreativeDestination,
  kind: AdventureCreativeTaskKind,
): boolean =>
  destination === "art-studio"
    ? ["background", "foreground-plate", "prop", "ui-art"].includes(kind)
    : ["character-model-sheet", "character-key-pose", "animation-sequence", "cutscene-shot"].includes(kind);

export const validateAdventureCreativeWorkOrderV2 = (
  order: AdventureCreativeWorkOrderV2,
): readonly AdventureCreativeContractIssue[] => {
  const issues: AdventureCreativeContractIssue[] = [];
  if (!isNonEmpty(order.workOrderId) || !isNonEmpty(String(order.projectId)) || !isNonEmpty(String(order.assetId))) {
    issues.push({ code: "invalid-id", path: "workOrderId", message: "Work order, project and asset IDs must be non-empty." });
  }
  if (!Number.isSafeInteger(order.revision) || order.revision <= 0 || (order.replacesRevision !== undefined && order.replacesRevision >= order.revision)) {
    issues.push({ code: "invalid-revision", path: "revision", message: "Revision must be positive and newer than any replaced revision." });
  }
  if (!Number.isSafeInteger(order.nativeSize.width) || !Number.isSafeInteger(order.nativeSize.height) || order.nativeSize.width <= 0 || order.nativeSize.height <= 0) {
    issues.push({ code: "invalid-size", path: "nativeSize", message: "Native canvas dimensions must be positive integers." });
  }
  if (!destinationAccepts(order.destinationStudio, order.taskKind)) {
    issues.push({ code: "destination-task-mismatch", path: "taskKind", message: `${order.destinationStudio} does not own task '${order.taskKind}'.` });
  }
  const alphaRequired = order.alphaPolicy !== "opaque";
  if (order.transparencyPolicy.checkerboardForbidden !== true || order.transparencyPolicy.matteResidueForbidden !== true || order.transparencyPolicy.haloFringeForbidden !== true || (alphaRequired && (!order.transparencyPolicy.decodedAlphaRequired || !order.transparencyPolicy.transparentCanvasEdgeRequired))) {
    issues.push({ code: "alpha-policy", path: "transparencyPolicy", message: "Transparent adventure assets must require decoded alpha, transparent canvas edges, no checkerboard, no matte residue and no halo fringe." });
  }
  if (!isNonEmpty(order.style.profileId) || !isNonEmpty(order.style.styleDigest)) {
    issues.push({ code: "style-authority-missing", path: "style", message: "Style profile and immutable style authority digest are required." });
  }
  if (!Number.isSafeInteger(order.iterationPolicy.maximumRevisionPasses) || order.iterationPolicy.maximumRevisionPasses <= 0 || !order.iterationPolicy.requireIssueClosureEvidence) {
    issues.push({ code: "review-policy-missing", path: "iterationPolicy", message: "Iteration policy must bound revision passes and require issue-closure evidence." });
  }
  if (isAnimationTask(order.taskKind)) {
    if (!order.framePlan || order.framePlan.length < 2) {
      issues.push({ code: "frame-plan-required", path: "framePlan", message: "Animation/cutscene work requires at least two authored frame/exposure entries." });
    }
    if (!order.sequencePolicy) {
      issues.push({ code: "sequence-policy-required", path: "sequencePolicy", message: "Animation/cutscene work requires sequence continuity policy." });
    }
  }
  const frameIds = new Set<string>();
  for (let index = 0; index < (order.framePlan ?? []).length; index += 1) {
    const frame = order.framePlan?.[index];
    if (!frame) continue;
    if (frameIds.has(frame.frameId)) {
      issues.push({ code: "duplicate-frame", path: `framePlan[${index}].frameId`, message: `Frame '${frame.frameId}' is duplicated.` });
    }
    frameIds.add(frame.frameId);
    if (!Number.isSafeInteger(frame.exposureTicks) || frame.exposureTicks <= 0) {
      issues.push({ code: "invalid-exposure", path: `framePlan[${index}].exposureTicks`, message: `Frame '${frame.frameId}' requires a positive integer exposure.` });
    }
    if (frame.sourceRect && (frame.sourceRect.x < 0 || frame.sourceRect.y < 0 || frame.sourceRect.x + frame.sourceRect.width > order.nativeSize.width || frame.sourceRect.y + frame.sourceRect.height > order.nativeSize.height)) {
      issues.push({ code: "frame-outside-canvas", path: `framePlan[${index}].sourceRect`, message: `Frame '${frame.frameId}' exceeds the native canvas.` });
    }
  }
  return issues;
};

export const validateAdventureCreativeReviewResultV2 = (
  order: AdventureCreativeWorkOrderV2,
  result: AdventureCreativeReviewResultV2,
): readonly AdventureCreativeContractIssue[] => {
  const issues: AdventureCreativeContractIssue[] = [];
  if (result.workOrderId !== order.workOrderId || result.revision !== order.revision) {
    issues.push({ code: "invalid-revision", path: "review", message: "Review must target the exact work-order ID and revision." });
  }
  if (result.decision === "accepted") {
    const blocking = result.issues.filter((issue) => issue.severity === "error");
    if (blocking.length > 0) {
      issues.push({ code: "review-policy-missing", path: "review.issues", message: "Accepted creative work cannot retain blocking review issues." });
    }
    const requiredFrames = new Set((order.framePlan ?? []).map((frame) => frame.frameId));
    const reviewed = new Set(result.reviewedFrameIds);
    for (const frameId of requiredFrames) {
      if (!reviewed.has(frameId)) {
        issues.push({ code: "review-policy-missing", path: "review.reviewedFrameIds", message: `Accepted animation is missing review evidence for frame '${frameId}'.` });
      }
    }
    if (!result.styleEvidenceDigest) {
      issues.push({ code: "review-policy-missing", path: "review.styleEvidenceDigest", message: "Accepted creative work requires retained style/identity consistency evidence." });
    }
    if (order.alphaPolicy !== "opaque" && !result.alphaEvidenceDigest) {
      issues.push({ code: "alpha-policy", path: "review.alphaEvidenceDigest", message: "Accepted transparent work requires retained alpha evidence." });
    }
    if (isAnimationTask(order.taskKind) && !result.sequenceEvidenceDigest) {
      issues.push({ code: "review-policy-missing", path: "review.sequenceEvidenceDigest", message: "Accepted animation/cutscene work requires retained sequence evidence." });
    }
  }
  return issues;
};
