import type { Point, Rectangle } from "@evavo/adventure-project-schema";
import {
  type AdventureCreativeReviewResultV2,
  type AdventureCreativeWorkOrderV2,
  validateAdventureCreativeReviewResultV2,
} from "./creative-handoff-v2.js";

export interface AdventureCreativeCandidateFrameV2 {
  readonly frameId: string;
  readonly exposureTicks: number;
  readonly sourceRect?: Rectangle;
  readonly pivot?: Point;
  readonly footPoint?: Point;
  readonly handAnchor?: Point;
  readonly shadowAnchor?: Point;
}

export interface AdventureCreativeCandidateManifestV2 {
  readonly contractVersion: 2;
  readonly workOrderId: string;
  readonly projectId: string;
  readonly assetId: string;
  readonly revision: number;
  readonly candidateDigest: string;
  readonly nativeSize: { readonly width: number; readonly height: number };
  readonly alpha: {
    readonly decoded: boolean;
    readonly mode: "opaque" | "binary" | "soft";
    readonly transparentCanvasEdge: boolean;
    readonly checkerboardDetected: boolean;
    readonly matteResidueDetected: boolean;
    readonly haloFringeDetected: boolean;
  };
  readonly frames?: readonly AdventureCreativeCandidateFrameV2[];
}

export type AdventureCreativeAdmissionIssueCode =
  | "candidate-identity"
  | "candidate-revision"
  | "candidate-digest"
  | "wrong-canvas"
  | "alpha-not-decoded"
  | "fake-transparency"
  | "matte-residue"
  | "alpha-halo"
  | "transparent-edge"
  | "alpha-mode"
  | "wrong-frame-count"
  | "frame-order"
  | "timing-mismatch"
  | "source-rect-mismatch"
  | "pivot-drift"
  | "foot-contact"
  | "anchor-drift"
  | "review-invalid"
  | "review-not-accepted";

export interface AdventureCreativeAdmissionIssue {
  readonly code: AdventureCreativeAdmissionIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface AdventureCreativeAdmissionResult {
  readonly accepted: boolean;
  readonly workOrderId: string;
  readonly revision: number;
  readonly candidateDigest: string;
  readonly issues: readonly AdventureCreativeAdmissionIssue[];
}

const samePoint = (left: Point | undefined, right: Point | undefined): boolean =>
  left === undefined && right === undefined ||
  left !== undefined && right !== undefined && left.x === right.x && left.y === right.y;

const sameRect = (left: Rectangle | undefined, right: Rectangle | undefined): boolean =>
  left === undefined && right === undefined ||
  left !== undefined && right !== undefined &&
    left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;

const animationTask = (order: AdventureCreativeWorkOrderV2): boolean =>
  order.taskKind === "animation-sequence" || order.taskKind === "cutscene-shot";

export const evaluateAdventureCreativeCandidateAdmission = (
  order: AdventureCreativeWorkOrderV2,
  candidate: AdventureCreativeCandidateManifestV2,
  review: AdventureCreativeReviewResultV2,
): AdventureCreativeAdmissionResult => {
  const issues: AdventureCreativeAdmissionIssue[] = [];
  if (
    candidate.workOrderId !== order.workOrderId ||
    candidate.projectId !== String(order.projectId) ||
    candidate.assetId !== String(order.assetId)
  ) {
    issues.push({
      code: "candidate-identity",
      path: "candidate",
      message: "Candidate must target the exact work-order, project and asset identities.",
    });
  }
  if (candidate.revision !== order.revision) {
    issues.push({ code: "candidate-revision", path: "candidate.revision", message: "Candidate revision does not match the work-order revision." });
  }
  if (candidate.candidateDigest !== review.candidateDigest) {
    issues.push({ code: "candidate-digest", path: "candidate.candidateDigest", message: "Review evidence does not target the exact candidate digest being admitted." });
  }
  if (candidate.nativeSize.width !== order.nativeSize.width || candidate.nativeSize.height !== order.nativeSize.height) {
    issues.push({ code: "wrong-canvas", path: "candidate.nativeSize", message: `Candidate canvas ${candidate.nativeSize.width}×${candidate.nativeSize.height} does not match required ${order.nativeSize.width}×${order.nativeSize.height}.` });
  }

  const requiresAlpha = order.alphaPolicy !== "opaque";
  if (requiresAlpha && !candidate.alpha.decoded) {
    issues.push({ code: "alpha-not-decoded", path: "candidate.alpha.decoded", message: "Transparent candidate alpha must be decoded and inspected, not inferred from pixels or filename." });
  }
  if (candidate.alpha.checkerboardDetected) {
    issues.push({ code: "fake-transparency", path: "candidate.alpha.checkerboardDetected", message: "Baked checkerboard transparency is blocking." });
  }
  if (candidate.alpha.matteResidueDetected) {
    issues.push({ code: "matte-residue", path: "candidate.alpha.matteResidueDetected", message: "Residual matte/background colour is blocking." });
  }
  if (candidate.alpha.haloFringeDetected) {
    issues.push({ code: "alpha-halo", path: "candidate.alpha.haloFringeDetected", message: "Alpha halo/fringe contamination is blocking." });
  }
  if (requiresAlpha && !candidate.alpha.transparentCanvasEdge) {
    issues.push({ code: "transparent-edge", path: "candidate.alpha.transparentCanvasEdge", message: "Transparent adventure art requires a fully transparent canvas edge." });
  }
  if (order.alphaPolicy === "binary" && candidate.alpha.mode !== "binary") {
    issues.push({ code: "alpha-mode", path: "candidate.alpha.mode", message: "Binary-alpha work cannot be admitted with soft alpha." });
  }
  if (order.alphaPolicy === "opaque" && candidate.alpha.mode !== "opaque") {
    issues.push({ code: "alpha-mode", path: "candidate.alpha.mode", message: "Opaque work must not unexpectedly contain transparent alpha." });
  }

  if (animationTask(order)) {
    const expected = order.framePlan ?? [];
    const actual = candidate.frames ?? [];
    if (actual.length !== expected.length) {
      issues.push({ code: "wrong-frame-count", path: "candidate.frames", message: `Candidate has ${actual.length} frames; work order requires exactly ${expected.length}.` });
    }
    const count = Math.min(expected.length, actual.length);
    for (let index = 0; index < count; index += 1) {
      const required = expected[index];
      const supplied = actual[index];
      if (!required || !supplied) continue;
      const path = `candidate.frames[${index}]`;
      if (required.frameId !== supplied.frameId) {
        issues.push({ code: "frame-order", path: `${path}.frameId`, message: `Expected frame '${required.frameId}' at index ${index}; received '${supplied.frameId}'.` });
      }
      if (required.exposureTicks !== supplied.exposureTicks) {
        issues.push({ code: "timing-mismatch", path: `${path}.exposureTicks`, message: `Frame '${required.frameId}' exposure changed from ${required.exposureTicks} to ${supplied.exposureTicks} ticks.` });
      }
      if (!sameRect(required.sourceRect, supplied.sourceRect)) {
        issues.push({ code: "source-rect-mismatch", path: `${path}.sourceRect`, message: `Frame '${required.frameId}' source rectangle does not match the game contract.` });
      }
      if (!samePoint(required.pivot, supplied.pivot)) {
        issues.push({ code: "pivot-drift", path: `${path}.pivot`, message: `Frame '${required.frameId}' pivot drifted from the authored runtime pivot.` });
      }
      if (!samePoint(required.footPoint, supplied.footPoint)) {
        issues.push({ code: "foot-contact", path: `${path}.footPoint`, message: `Frame '${required.frameId}' foot/contact anchor drifted.` });
      }
      if (!samePoint(required.handAnchor, supplied.handAnchor) || !samePoint(required.shadowAnchor, supplied.shadowAnchor)) {
        issues.push({ code: "anchor-drift", path, message: `Frame '${required.frameId}' hand/shadow anchors do not match the authored game contract.` });
      }
    }
  }

  const reviewIssues = validateAdventureCreativeReviewResultV2(order, review);
  for (const issue of reviewIssues) {
    issues.push({ code: "review-invalid", path: issue.path, message: issue.message });
  }
  if (review.decision !== "accepted") {
    issues.push({ code: "review-not-accepted", path: "review.decision", message: `Creative review decision is '${review.decision}', not accepted.` });
  }

  return {
    accepted: issues.length === 0,
    workOrderId: order.workOrderId,
    revision: order.revision,
    candidateDigest: candidate.candidateDigest,
    issues,
  };
};
