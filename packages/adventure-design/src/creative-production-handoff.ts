import type { Id, Point, Rectangle, Size } from "@evavo/adventure-project-schema";

export type AdventureCreativeStudio = "art-studio" | "cel-animation-studio";
export type AdventureCreativeTaskKind =
  | "background"
  | "foreground-plate"
  | "prop"
  | "ui-art"
  | "character-model-sheet"
  | "character-key-pose"
  | "animation-sequence";

export type AdventureAlphaPolicy = "opaque" | "binary" | "soft" | "required";
export type AdventureCreativeReviewSeverity = "error" | "warning" | "note";
export type AdventureCreativeDecision = "revise" | "accepted" | "rejected";

export interface AdventureAnimationFramePlan {
  readonly frameId: string;
  readonly exposureTicks: number;
  readonly role: "hold" | "contact" | "passing" | "extreme" | "breakdown" | "inbetween" | "smear";
  readonly sourceRect?: Rectangle;
  readonly pivot?: Point;
  readonly footPoint?: Point;
  readonly handAnchor?: Point;
  readonly shadowAnchor?: Point;
}

export interface AdventureCreativeWorkOrder {
  readonly contractVersion: 1;
  readonly workOrderId: string;
  readonly projectId: Id<"project">;
  readonly assetId: Id<"asset">;
  readonly destinationStudio: AdventureCreativeStudio;
  readonly taskKind: AdventureCreativeTaskKind;
  readonly briefRevision: number;
  readonly sourceRevisionDigest: string;
  readonly visualStandardDigest: string;
  readonly styleBankDigest?: string;
  readonly characterModelSheetDigest?: string;
  readonly xSheetDigest?: string;
  readonly nativeSize: Size;
  readonly alphaPolicy: AdventureAlphaPolicy;
  readonly checkerboardForbidden: true;
  readonly canvasEdgeMustBeTransparent: boolean;
  readonly preserveNativeCanvas: boolean;
  readonly requiredReferenceDigests: readonly string[];
  readonly framePlan?: readonly AdventureAnimationFramePlan[];
  readonly artDirection: readonly string[];
  readonly rejectionRules: readonly string[];
}

export interface AdventureCreativeAlphaEvidence {
  readonly decodedAlphaPresent: boolean;
  readonly fullyTransparentCanvasEdge: boolean;
  readonly checkerboardDetected: boolean;
  readonly matteResidueDetected: boolean;
  readonly haloOrFringeDetected: boolean;
  readonly alphaMaskReviewed: boolean;
  readonly hostilePlateProofs: readonly ("black" | "white" | "grey" | "green" | "magenta")[];
}

export interface AdventureCreativeAnimationEvidence {
  readonly frameIds: readonly string[];
  readonly frameTimingTicks: readonly number[];
  readonly neighbourContinuityReviewed: boolean;
  readonly loopClosureReviewed: boolean;
  readonly identityLocked: boolean;
  readonly anchorsStable: boolean;
  readonly paletteStable: boolean;
  readonly lineAndConstructionStable: boolean;
  readonly independentlyGeneratedFrames: boolean;
  readonly xSheetDigest?: string;
}

export interface AdventureCreativeCandidateEvidence {
  readonly contractVersion: 1;
  readonly workOrderId: string;
  readonly candidateRevision: number;
  readonly previousCandidateDigest?: string;
  readonly sourceDigest: string;
  readonly candidateDigest: string;
  readonly width: number;
  readonly height: number;
  readonly mediaType: "image/png" | "image/webp" | "application/x-aseprite";
  readonly alpha?: AdventureCreativeAlphaEvidence;
  readonly animation?: AdventureCreativeAnimationEvidence;
  readonly styleStandardDigest: string;
  readonly modelSheetDigest?: string;
  readonly reviewScaleVerified: boolean;
}

export type AdventureCreativeIssueCode =
  | "wrong-native-size"
  | "style-standard-mismatch"
  | "model-sheet-mismatch"
  | "checkerboard-baked"
  | "missing-alpha"
  | "nontransparent-canvas-edge"
  | "matte-residue"
  | "halo-fringe"
  | "alpha-proof-incomplete"
  | "frame-count-mismatch"
  | "frame-order-mismatch"
  | "exposure-timing-mismatch"
  | "anchor-drift"
  | "identity-drift"
  | "construction-drift"
  | "palette-drift"
  | "loop-closure-fail"
  | "independent-frame-regeneration"
  | "x-sheet-mismatch"
  | "runtime-scale-not-reviewed";

export interface AdventureCreativeReviewIssue {
  readonly code: AdventureCreativeIssueCode;
  readonly severity: AdventureCreativeReviewSeverity;
  readonly message: string;
  readonly requiredFix?: string;
}

export interface AdventureCreativeReview {
  readonly contractVersion: 1;
  readonly workOrderId: string;
  readonly candidateDigest: string;
  readonly reviewRevision: number;
  readonly decision: AdventureCreativeDecision;
  readonly issues: readonly AdventureCreativeReviewIssue[];
}

export interface AdventureCreativeReworkRequest {
  readonly contractVersion: 1;
  readonly workOrderId: string;
  readonly rejectedCandidateDigest: string;
  readonly nextCandidateRevision: number;
  readonly requiredFixes: readonly AdventureCreativeReviewIssue[];
  readonly preserveApprovedAspects: readonly string[];
}

export interface AdventureCreativeAcceptance {
  readonly contractVersion: 1;
  readonly workOrderId: string;
  readonly candidateDigest: string;
  readonly acceptedRevision: number;
  readonly sourceDigest: string;
  readonly visualStandardDigest: string;
  readonly alphaAccepted: boolean;
  readonly animationAccepted: boolean;
}

const unique = <T extends string>(values: readonly T[]): readonly T[] => [...new Set(values)];

const alphaIssues = (
  order: AdventureCreativeWorkOrder,
  candidate: AdventureCreativeCandidateEvidence,
): AdventureCreativeReviewIssue[] => {
  if (order.alphaPolicy === "opaque") return [];
  const alpha = candidate.alpha;
  if (!alpha) {
    return [{ code: "missing-alpha", severity: "error", message: "Required alpha evidence is missing.", requiredFix: "Master and review real alpha before resubmission." }];
  }
  const issues: AdventureCreativeReviewIssue[] = [];
  if (alpha.checkerboardDetected) issues.push({ code: "checkerboard-baked", severity: "error", message: "A transparency checkerboard is baked into image pixels.", requiredFix: "Return to an immutable source and produce real transparency; never key a painted checkerboard as final alpha." });
  if (!alpha.decodedAlphaPresent) issues.push({ code: "missing-alpha", severity: "error", message: "Decoded image contains no meaningful alpha channel.", requiredFix: "Provide real decoded alpha or remaster from a governed matte/source." });
  if (order.canvasEdgeMustBeTransparent && !alpha.fullyTransparentCanvasEdge) issues.push({ code: "nontransparent-canvas-edge", severity: "error", message: "Canvas edge is not fully transparent.", requiredFix: "Correct edge alpha without eroding legitimate subject detail." });
  if (alpha.matteResidueDetected) issues.push({ code: "matte-residue", severity: "error", message: "Source matte colour remains around the subject.", requiredFix: "Repair matte residue and rerun hostile-plate review." });
  if (alpha.haloOrFringeDetected) issues.push({ code: "halo-fringe", severity: "error", message: "Visible halo or premultiplication fringe remains on the cut-out.", requiredFix: "Repair edge colour/alpha and review over hostile solid plates." });
  const proofs = new Set(alpha.hostilePlateProofs);
  if (!alpha.alphaMaskReviewed || ["black", "white", "grey", "green", "magenta"].some((plate) => !proofs.has(plate as never))) {
    issues.push({ code: "alpha-proof-incomplete", severity: "error", message: "Alpha admission evidence is incomplete.", requiredFix: "Review alpha mask and black/white/grey/green/magenta solid-plate proofs." });
  }
  return issues;
};

const animationIssues = (
  order: AdventureCreativeWorkOrder,
  candidate: AdventureCreativeCandidateEvidence,
): AdventureCreativeReviewIssue[] => {
  if (order.taskKind !== "animation-sequence") return [];
  const plan = order.framePlan ?? [];
  const evidence = candidate.animation;
  if (!evidence) return [{ code: "frame-count-mismatch", severity: "error", message: "Animation evidence is missing.", requiredFix: "Return a reviewed frame-sequence/X-sheet evidence record." }];
  const issues: AdventureCreativeReviewIssue[] = [];
  if (plan.length !== evidence.frameIds.length) issues.push({ code: "frame-count-mismatch", severity: "error", message: `Expected ${plan.length} drawings/frames, received ${evidence.frameIds.length}.`, requiredFix: "Conform the candidate to the approved X-sheet/frame plan." });
  if (plan.some((frame, index) => frame.frameId !== evidence.frameIds[index])) issues.push({ code: "frame-order-mismatch", severity: "error", message: "Animation frame identity/order differs from the approved plan.", requiredFix: "Restore approved frame IDs and exposure order." });
  if (plan.some((frame, index) => frame.exposureTicks !== evidence.frameTimingTicks[index])) issues.push({ code: "exposure-timing-mismatch", severity: "error", message: "Animation exposures differ from the approved timing plan.", requiredFix: "Use the approved X-sheet exposure timing; do not retime by interpolation." });
  if (!evidence.neighbourContinuityReviewed) issues.push({ code: "construction-drift", severity: "error", message: "Immediate-neighbour continuity was not reviewed.", requiredFix: "Review each replacement drawing against previous/next approved poses." });
  if (!evidence.identityLocked) issues.push({ code: "identity-drift", severity: "error", message: "Character identity is not locked across the sequence.", requiredFix: "Repair construction/identity against the approved model sheet." });
  if (!evidence.anchorsStable) issues.push({ code: "anchor-drift", severity: "error", message: "Foot/pivot/hand/shadow anchors drift across the sequence.", requiredFix: "Correct anchor positions without independently redesigning poses." });
  if (!evidence.paletteStable) issues.push({ code: "palette-drift", severity: "error", message: "Palette or lighting treatment drifts between drawings.", requiredFix: "Match approved palette/light roles across the sequence." });
  if (!evidence.lineAndConstructionStable) issues.push({ code: "construction-drift", severity: "error", message: "Line/construction language changes across frames.", requiredFix: "Repair the inconsistent frames against neighbouring approved drawings." });
  if (evidence.independentlyGeneratedFrames) issues.push({ code: "independent-frame-regeneration", severity: "error", message: "Frames were independently regenerated instead of authored as one controlled animation sequence.", requiredFix: "Return to key poses/X-sheet and regenerate or repair only the bounded drawings that fail continuity." });
  if (plan.length > 1 && !evidence.loopClosureReviewed && plan[0]?.role === "contact") issues.push({ code: "loop-closure-fail", severity: "warning", message: "Loop closure has not been explicitly reviewed.", requiredFix: "Review final-to-first closure at runtime scale." });
  if (order.xSheetDigest && evidence.xSheetDigest !== order.xSheetDigest) issues.push({ code: "x-sheet-mismatch", severity: "error", message: "Returned sequence does not bind the approved X-sheet digest.", requiredFix: "Rebuild the review/render packet against the approved X-sheet." });
  return issues;
};

export const reviewAdventureCreativeCandidate = (
  order: AdventureCreativeWorkOrder,
  candidate: AdventureCreativeCandidateEvidence,
  reviewRevision = 1,
): AdventureCreativeReview => {
  const issues: AdventureCreativeReviewIssue[] = [];
  if (candidate.workOrderId !== order.workOrderId) throw new Error("Creative candidate belongs to a different work order.");
  if (candidate.width !== order.nativeSize.width || candidate.height !== order.nativeSize.height) issues.push({ code: "wrong-native-size", severity: "error", message: `Candidate is ${candidate.width}×${candidate.height}; expected ${order.nativeSize.width}×${order.nativeSize.height}.`, requiredFix: "Return the exact approved native canvas without arbitrary resampling." });
  if (candidate.styleStandardDigest !== order.visualStandardDigest) issues.push({ code: "style-standard-mismatch", severity: "error", message: "Candidate was reviewed against the wrong visual-standard authority.", requiredFix: "Rebind production to the approved visual standard before revision." });
  if (order.characterModelSheetDigest && candidate.modelSheetDigest !== order.characterModelSheetDigest) issues.push({ code: "model-sheet-mismatch", severity: "error", message: "Character candidate does not bind the approved model sheet.", requiredFix: "Use the exact approved model-sheet source and preserve construction landmarks." });
  if (!candidate.reviewScaleVerified) issues.push({ code: "runtime-scale-not-reviewed", severity: "error", message: "Candidate has not been inspected at actual Adventure Studio runtime scale.", requiredFix: "Review final pixels at native/runtime scale before acceptance." });
  issues.push(...alphaIssues(order, candidate), ...animationIssues(order, candidate));
  const deduped = unique(issues.map((issue) => `${issue.code}\u0000${issue.message}`)).map((key) => issues.find((issue) => `${issue.code}\u0000${issue.message}` === key)!);
  return {
    contractVersion: 1,
    workOrderId: order.workOrderId,
    candidateDigest: candidate.candidateDigest,
    reviewRevision,
    decision: deduped.some((issue) => issue.severity === "error") ? "revise" : "accepted",
    issues: deduped,
  };
};

export const createAdventureCreativeReworkRequest = (
  order: AdventureCreativeWorkOrder,
  candidate: AdventureCreativeCandidateEvidence,
  review: AdventureCreativeReview,
  preserveApprovedAspects: readonly string[] = [],
): AdventureCreativeReworkRequest => {
  if (review.decision === "accepted") throw new Error("Accepted candidate does not require rework.");
  return {
    contractVersion: 1,
    workOrderId: order.workOrderId,
    rejectedCandidateDigest: candidate.candidateDigest,
    nextCandidateRevision: candidate.candidateRevision + 1,
    requiredFixes: review.issues.filter((issue) => issue.severity === "error"),
    preserveApprovedAspects,
  };
};

export const acceptAdventureCreativeCandidate = (
  order: AdventureCreativeWorkOrder,
  candidate: AdventureCreativeCandidateEvidence,
  review: AdventureCreativeReview,
): AdventureCreativeAcceptance => {
  if (review.decision !== "accepted" || review.issues.some((issue) => issue.severity === "error")) throw new Error("Candidate cannot be accepted while blocking review issues remain.");
  return {
    contractVersion: 1,
    workOrderId: order.workOrderId,
    candidateDigest: candidate.candidateDigest,
    acceptedRevision: candidate.candidateRevision,
    sourceDigest: candidate.sourceDigest,
    visualStandardDigest: order.visualStandardDigest,
    alphaAccepted: order.alphaPolicy === "opaque" || Boolean(candidate.alpha),
    animationAccepted: order.taskKind !== "animation-sequence" || Boolean(candidate.animation),
  };
};
