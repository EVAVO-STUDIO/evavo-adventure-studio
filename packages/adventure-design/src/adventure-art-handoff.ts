import type { AdventureProductionProfileId } from "./production-profile-types.js";

export type AdventureArtAssetRole =
  | "room-background"
  | "foreground-occluder"
  | "character-model-sheet"
  | "character-animation"
  | "portrait"
  | "prop"
  | "ui"
  | "cutaway";

export type AdventureArtTargetStudio = "evavo-art-studio" | "cel-animation-studio";
export type AdventureArtFindingSeverity = "blocking" | "warning" | "note";
export type AdventureArtFindingCode =
  | "dimension-mismatch"
  | "fake-transparency"
  | "alpha-missing"
  | "alpha-policy"
  | "frame-count"
  | "frame-order"
  | "frame-geometry"
  | "timing"
  | "pivot-drift"
  | "foot-anchor-drift"
  | "hand-anchor-drift"
  | "shadow-anchor-drift"
  | "identity-drift"
  | "style-drift"
  | "palette-drift"
  | "background-perspective-drift"
  | "silhouette-failure"
  | "edge-halo"
  | "generic-ai-detail"
  | "missing-evidence";

export interface AdventureArtSize {
  readonly width: number;
  readonly height: number;
}

export interface AdventureArtPoint {
  readonly x: number;
  readonly y: number;
}

export interface AdventureAnimationFrameContract {
  readonly id: string;
  readonly order: number;
  readonly sourceRect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly durationTicks: number;
  readonly pivot: AdventureArtPoint;
  readonly footPoint?: AdventureArtPoint;
  readonly handLeft?: AdventureArtPoint;
  readonly handRight?: AdventureArtPoint;
  readonly shadowAnchor?: AdventureArtPoint;
  readonly contact?: "none" | "left-foot" | "right-foot" | "both-feet";
  readonly intentionalHold?: boolean;
}

export interface AdventureTransparencyContract {
  readonly mode: "opaque" | "binary-alpha" | "soft-alpha";
  readonly requireRealAlphaChannel: boolean;
  readonly forbidCheckerboardPixels: true;
  readonly forbidBakedMatte: true;
  readonly forbidEdgeHalo: true;
}

export interface AdventureArtStyleContract {
  readonly styleId: string;
  readonly thesis: string;
  readonly continuityAnchors: readonly string[];
  readonly specificityAnchors: readonly string[];
  readonly forbiddenShortcuts: readonly string[];
  readonly modelSheetAssetId?: string;
  readonly colourScriptId?: string;
  readonly backgroundKeyAssetId?: string;
}

export interface AdventureAnimationContract {
  readonly sequenceId: string;
  readonly logicalTicksPerSecond: number;
  readonly frames: readonly AdventureAnimationFrameContract[];
  readonly requireExactFrameSet: true;
  readonly forbidIndependentFrameRegeneration: true;
  readonly requireModelSheetLock: true;
  readonly requireTimingReview: true;
  readonly requireLoopClosureReview: boolean;
}

export interface AdventureArtReviewFinding {
  readonly id: string;
  readonly attempt: number;
  readonly severity: AdventureArtFindingSeverity;
  readonly code: AdventureArtFindingCode;
  readonly message: string;
  readonly frameId?: string;
  readonly repairScope: "pixel" | "frame" | "sequence" | "asset";
  readonly resolved: boolean;
  readonly resolutionNote?: string;
}

export interface AdventureArtEvidence {
  readonly dimensionsVerified: boolean;
  readonly realAlphaVerified: boolean;
  readonly checkerboardAbsent: boolean;
  readonly matteAbsent: boolean;
  readonly haloAbsent: boolean;
  readonly frameSetVerified?: boolean;
  readonly frameOrderVerified?: boolean;
  readonly timingVerified?: boolean;
  readonly anchorsVerified?: boolean;
  readonly identityContinuityVerified?: boolean;
  readonly styleContinuityVerified?: boolean;
  readonly nativeRuntimePreviewVerified: boolean;
  readonly reviewer: string;
  readonly reviewedAt: string;
}

export interface AdventureArtHandoffV1 {
  readonly schema: "evavo_adventure_art_handoff_v1";
  readonly handoffId: string;
  readonly projectId: string;
  readonly profileId: AdventureProductionProfileId;
  readonly targetStudio: AdventureArtTargetStudio;
  readonly assetId: string;
  readonly role: AdventureArtAssetRole;
  readonly runtimeSize: AdventureArtSize;
  readonly sourceMasterSize: AdventureArtSize;
  readonly runtimeScalePolicy: "exact-native" | "reviewed-downsample";
  readonly transparency: AdventureTransparencyContract;
  readonly style: AdventureArtStyleContract;
  readonly animation?: AdventureAnimationContract;
  readonly iteration: {
    readonly attempt: number;
    readonly maxAttempts: 3;
    readonly smallestScopeRepairOnly: true;
    readonly onExhaustion: "human-review";
  };
  readonly findings: readonly AdventureArtReviewFinding[];
  readonly evidence?: AdventureArtEvidence;
}

export interface AdventureArtHandoffIssue {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

const positiveSize = (size: AdventureArtSize): boolean =>
  Number.isSafeInteger(size.width) && size.width > 0 && Number.isSafeInteger(size.height) && size.height > 0;

const samePoint = (left: AdventureArtPoint | undefined, right: AdventureArtPoint | undefined): boolean =>
  left === undefined && right === undefined
    ? true
    : left !== undefined && right !== undefined && left.x === right.x && left.y === right.y;

export const validateAdventureArtHandoff = (
  handoff: AdventureArtHandoffV1,
): readonly AdventureArtHandoffIssue[] => {
  const issues: AdventureArtHandoffIssue[] = [];
  const error = (code: string, path: string, message: string) =>
    issues.push({ severity: "error" as const, code, path, message });

  if (!positiveSize(handoff.runtimeSize)) error("invalid-runtime-size", "runtimeSize", "Runtime size must use positive integer dimensions.");
  if (!positiveSize(handoff.sourceMasterSize)) error("invalid-master-size", "sourceMasterSize", "Source master size must use positive integer dimensions.");
  if (handoff.runtimeScalePolicy === "exact-native" && (
    handoff.runtimeSize.width !== handoff.sourceMasterSize.width ||
    handoff.runtimeSize.height !== handoff.sourceMasterSize.height
  )) {
    error("native-size-mismatch", "sourceMasterSize", "Exact-native handoffs require source and runtime dimensions to match exactly.");
  }
  if (handoff.transparency.mode !== "opaque" && !handoff.transparency.requireRealAlphaChannel) {
    error("real-alpha-required", "transparency.requireRealAlphaChannel", "Transparent adventure assets must require a real alpha channel.");
  }
  if (handoff.iteration.attempt < 0 || handoff.iteration.attempt > handoff.iteration.maxAttempts) {
    error("invalid-attempt", "iteration.attempt", "Repair attempt is outside the governed 0–3 range.");
  }

  const animation = handoff.animation;
  if (handoff.role === "character-animation" && !animation) {
    error("animation-contract-required", "animation", "Character animation handoffs require an explicit frame/timing contract.");
  }
  if (animation) {
    if (animation.frames.length === 0) error("empty-frame-set", "animation.frames", "Animation requires at least one authored frame.");
    const ids = new Set<string>();
    const orders = new Set<number>();
    for (let index = 0; index < animation.frames.length; index += 1) {
      const frame = animation.frames[index]!;
      if (ids.has(frame.id)) error("duplicate-frame-id", `animation.frames[${index}].id`, `Frame '${frame.id}' is duplicated.`);
      if (orders.has(frame.order)) error("duplicate-frame-order", `animation.frames[${index}].order`, `Frame order '${frame.order}' is duplicated.`);
      ids.add(frame.id);
      orders.add(frame.order);
      if (!Number.isSafeInteger(frame.durationTicks) || frame.durationTicks <= 0) {
        error("invalid-frame-duration", `animation.frames[${index}].durationTicks`, `Frame '${frame.id}' must have a positive logical-tick duration.`);
      }
      if (frame.sourceRect.width <= 0 || frame.sourceRect.height <= 0) {
        error("invalid-frame-rect", `animation.frames[${index}].sourceRect`, `Frame '${frame.id}' has invalid source geometry.`);
      }
    }
    const sorted = [...animation.frames].sort((left, right) => left.order - right.order);
    for (let index = 0; index < sorted.length; index += 1) {
      if (sorted[index]!.order !== index) {
        error("non-contiguous-frame-order", "animation.frames", "Animation frame order must be contiguous from zero.");
        break;
      }
    }
  }

  for (const finding of handoff.findings) {
    if (finding.attempt > handoff.iteration.attempt) {
      error("future-review-attempt", `findings.${finding.id}`, `Finding '${finding.id}' belongs to a future repair attempt.`);
    }
    if (finding.resolved && !finding.resolutionNote) {
      error("resolution-note-required", `findings.${finding.id}.resolutionNote`, `Resolved finding '${finding.id}' needs an explicit resolution note.`);
    }
  }
  return issues;
};

export const adventureArtHandoffReadyForAcceptance = (
  handoff: AdventureArtHandoffV1,
): boolean => {
  if (validateAdventureArtHandoff(handoff).some((issue) => issue.severity === "error")) return false;
  if (!handoff.evidence) return false;
  if (handoff.findings.some((finding) => finding.severity === "blocking" && !finding.resolved)) return false;
  const evidence = handoff.evidence;
  if (
    !evidence.dimensionsVerified ||
    !evidence.nativeRuntimePreviewVerified ||
    !evidence.checkerboardAbsent ||
    !evidence.matteAbsent ||
    !evidence.haloAbsent
  ) return false;
  if (handoff.transparency.mode !== "opaque" && !evidence.realAlphaVerified) return false;
  if (handoff.animation && (
    !evidence.frameSetVerified ||
    !evidence.frameOrderVerified ||
    !evidence.timingVerified ||
    !evidence.anchorsVerified ||
    !evidence.identityContinuityVerified ||
    !evidence.styleContinuityVerified
  )) return false;
  return true;
};

export const compareAnimationAnchorContinuity = (
  frames: readonly AdventureAnimationFrameContract[],
): readonly AdventureArtHandoffIssue[] => {
  if (frames.length < 2) return [];
  const issues: AdventureArtHandoffIssue[] = [];
  const baseline = frames[0]!;
  for (let index = 1; index < frames.length; index += 1) {
    const frame = frames[index]!;
    if (!samePoint(frame.pivot, baseline.pivot)) {
      issues.push({ severity: "warning", code: "pivot-varies", path: `frames[${index}].pivot`, message: `Frame '${frame.id}' changes pivot from the sequence baseline; verify this is authored.` });
    }
    if (baseline.shadowAnchor && frame.shadowAnchor && !samePoint(frame.shadowAnchor, baseline.shadowAnchor)) {
      issues.push({ severity: "warning", code: "shadow-anchor-varies", path: `frames[${index}].shadowAnchor`, message: `Frame '${frame.id}' changes the shadow anchor; verify planted contact intentionally.` });
    }
  }
  return issues;
};
