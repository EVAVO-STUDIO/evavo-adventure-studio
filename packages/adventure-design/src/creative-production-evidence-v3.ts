import type { AdventureCreativeWorkOrderV3 } from "./creative-production-handoff-v3.js";

export interface AdventureCreativeAlphaEvidenceV3 {
  readonly width: number;
  readonly height: number;
  readonly hasAlphaChannel: boolean;
  readonly zeroAlphaPixels: number;
  readonly partialAlphaPixels: number;
  readonly opaquePixels: number;
  readonly minimumAlpha: number;
  readonly maximumAlpha: number;
  readonly checkerboardDetected: boolean;
  readonly checkerboardScore: number;
  readonly matteResiduePixels: number;
  readonly alphaHaloPixels: number;
  readonly transparentRgbContaminationPixels: number;
}

export interface AdventureCreativeMeasuredFrameV3 {
  readonly frameId: string;
  readonly width: number;
  readonly height: number;
  readonly trimX: number;
  readonly trimY: number;
  readonly trimWidth: number;
  readonly trimHeight: number;
  readonly exposureTicks: number;
  readonly pivot?: { readonly x: number; readonly y: number };
  readonly footPoint?: { readonly x: number; readonly y: number };
  readonly handAnchors: Readonly<Record<string, { readonly x: number; readonly y: number }>>;
  readonly shadowAnchor?: { readonly x: number; readonly y: number };
  readonly contactStable: boolean;
  readonly alpha: AdventureCreativeAlphaEvidenceV3;
}

export interface AdventureCreativeSequenceEvidenceV3 {
  readonly actualFrameIds: readonly string[];
  readonly duplicateFrameIds: readonly string[];
  readonly missingFrameIds: readonly string[];
  readonly unexpectedFrameIds: readonly string[];
  readonly frames: readonly AdventureCreativeMeasuredFrameV3[];
  readonly maximumObservedTrimJitterPixels: number;
  readonly maximumObservedAnchorDriftPixels: number;
  readonly loopClosureDeltaPixels: number;
  readonly neighbourContinuityScore: number;
  readonly modelSheetConformanceScore: number;
  readonly xSheetConformanceScore: number;
  readonly styleConsistencyScore: number;
  readonly proportionConsistencyScore: number;
  readonly paletteConsistencyScore: number;
}

export interface AdventureCreativeMeasuredEvidenceV3 {
  readonly evidenceVersion: 3;
  readonly workOrderId: string;
  readonly revision: number;
  readonly artifactWidth: number;
  readonly artifactHeight: number;
  readonly artifactByteLength: number;
  readonly alpha: AdventureCreativeAlphaEvidenceV3;
  readonly sequence?: AdventureCreativeSequenceEvidenceV3;
  readonly styleDigest: string;
  readonly paletteDigest?: string;
  readonly modelSheetDigest?: string;
  readonly xSheetDigest?: string;
  readonly protectedInvariantDigests: Readonly<Record<string, string>>;
}

export type AdventureCreativeEvidenceIssueCodeV3 =
  | "authority-mismatch"
  | "dimension-mismatch"
  | "missing-alpha-channel"
  | "missing-zero-alpha"
  | "soft-alpha-when-binary-required"
  | "fake-transparency-checkerboard"
  | "matte-residue"
  | "alpha-halo"
  | "transparent-rgb-contamination"
  | "sequence-evidence-missing"
  | "frame-missing"
  | "frame-duplicate"
  | "frame-unexpected"
  | "frame-order-mismatch"
  | "exposure-timing-mismatch"
  | "frame-geometry-mismatch"
  | "anchor-mismatch"
  | "contact-instability"
  | "trim-jitter"
  | "loop-closure"
  | "neighbour-continuity"
  | "model-sheet-conformance"
  | "x-sheet-conformance"
  | "style-drift"
  | "proportion-drift"
  | "palette-drift"
  | "protected-invariant-missing";

export interface AdventureCreativeEvidenceIssueV3 {
  readonly code: AdventureCreativeEvidenceIssueCodeV3;
  readonly severity: "blocking" | "major" | "minor";
  readonly path: string;
  readonly message: string;
  readonly frameIds: readonly string[];
}

const animationKinds = new Set<AdventureCreativeWorkOrderV3["taskKind"]>([
  "animation-sequence",
  "cutscene-shot",
  "effects-sequence",
]);

const issue = (
  issues: AdventureCreativeEvidenceIssueV3[],
  code: AdventureCreativeEvidenceIssueCodeV3,
  path: string,
  message: string,
  frameIds: readonly string[] = [],
): void => {
  issues.push({ code, severity: "blocking", path, message, frameIds });
};

const pointMatches = (
  expected: { readonly x: number; readonly y: number } | undefined,
  actual: { readonly x: number; readonly y: number } | undefined,
  tolerance = 0,
): boolean => {
  if (!expected && !actual) return true;
  if (!expected || !actual) return false;
  return Math.abs(expected.x - actual.x) <= tolerance && Math.abs(expected.y - actual.y) <= tolerance;
};

export const validateAdventureCreativeMeasuredEvidenceV3 = (
  order: AdventureCreativeWorkOrderV3,
  evidence: AdventureCreativeMeasuredEvidenceV3,
): readonly AdventureCreativeEvidenceIssueV3[] => {
  const issues: AdventureCreativeEvidenceIssueV3[] = [];
  if (evidence.evidenceVersion !== 3 || evidence.workOrderId !== order.workOrderId || evidence.revision !== order.revision) {
    issue(issues, "authority-mismatch", "evidence", "Measured evidence must target the exact v3 work-order revision.");
  }
  if (evidence.artifactWidth !== order.nativeSize.width || evidence.artifactHeight !== order.nativeSize.height) {
    issue(
      issues,
      "dimension-mismatch",
      "artifact",
      `Measured artifact is ${evidence.artifactWidth}×${evidence.artifactHeight}; expected ${order.nativeSize.width}×${order.nativeSize.height}.`,
    );
  }
  if (evidence.styleDigest !== order.authorities.styleDigest) {
    issue(issues, "style-drift", "styleDigest", "Measured style authority does not match the immutable work-order style digest.");
  }
  if (order.authorities.paletteDigest && evidence.paletteDigest !== order.authorities.paletteDigest) {
    issue(issues, "palette-drift", "paletteDigest", "Measured palette authority does not match the requested palette digest.");
  }
  if (order.authorities.modelSheetDigest && evidence.modelSheetDigest !== order.authorities.modelSheetDigest) {
    issue(issues, "model-sheet-conformance", "modelSheetDigest", "Measured model-sheet authority does not match the approved model sheet.");
  }
  if (order.authorities.xSheetDigest && evidence.xSheetDigest !== order.authorities.xSheetDigest) {
    issue(issues, "x-sheet-conformance", "xSheetDigest", "Measured X-sheet authority does not match the approved X-sheet.");
  }
  for (const invariant of order.invariants) {
    if (!evidence.protectedInvariantDigests[invariant]) {
      issue(issues, "protected-invariant-missing", `protectedInvariantDigests.${invariant}`, `Protected invariant '${invariant}' has no retained evidence digest.`);
    }
  }

  const alpha = evidence.alpha;
  const alphaRequired = order.alphaPolicy !== "opaque";
  if (alphaRequired && order.transparencyPolicy.decodedAlphaRequired && !alpha.hasAlphaChannel) {
    issue(issues, "missing-alpha-channel", "alpha.hasAlphaChannel", "Delivery has no decoded alpha channel.");
  }
  if (alphaRequired && order.transparencyPolicy.transparentCanvasEdgeRequired && alpha.zeroAlphaPixels <= 0) {
    issue(issues, "missing-zero-alpha", "alpha.zeroAlphaPixels", "Transparent delivery contains no fully transparent pixels.");
  }
  if ((order.alphaPolicy === "binary" || order.alphaPolicy === "required") && alpha.partialAlphaPixels > 0) {
    issue(issues, "soft-alpha-when-binary-required", "alpha.partialAlphaPixels", `${alpha.partialAlphaPixels} partially transparent pixels violate binary-alpha delivery.`);
  }
  if (order.transparencyPolicy.checkerboardForbidden && alpha.checkerboardDetected) {
    issue(issues, "fake-transparency-checkerboard", "alpha.checkerboardDetected", "Checkerboard pixels are baked into the image. This is fake transparency and is never accepted.");
  }
  if (order.transparencyPolicy.matteResidueForbidden && alpha.matteResiduePixels > 0) {
    issue(issues, "matte-residue", "alpha.matteResiduePixels", `${alpha.matteResiduePixels} pixels contain matte residue.`);
  }
  if (order.transparencyPolicy.haloFringeForbidden && alpha.alphaHaloPixels > 0) {
    issue(issues, "alpha-halo", "alpha.alphaHaloPixels", `${alpha.alphaHaloPixels} pixels contain an alpha halo/fringe.`);
  }
  if (order.transparencyPolicy.transparentRgbContaminationForbidden && alpha.transparentRgbContaminationPixels > 0) {
    issue(issues, "transparent-rgb-contamination", "alpha.transparentRgbContaminationPixels", `${alpha.transparentRgbContaminationPixels} fully transparent pixels retain contaminated RGB.`);
  }

  if (!animationKinds.has(order.taskKind)) return issues;
  const plan = order.framePlan ?? [];
  const sequence = evidence.sequence;
  if (!sequence) {
    issue(issues, "sequence-evidence-missing", "sequence", "Animation delivery requires measured sequence evidence.");
    return issues;
  }
  if (sequence.missingFrameIds.length > 0) issue(issues, "frame-missing", "sequence.missingFrameIds", "Required frames are missing.", sequence.missingFrameIds);
  if (sequence.duplicateFrameIds.length > 0) issue(issues, "frame-duplicate", "sequence.duplicateFrameIds", "Duplicate frame IDs were delivered.", sequence.duplicateFrameIds);
  if (sequence.unexpectedFrameIds.length > 0) issue(issues, "frame-unexpected", "sequence.unexpectedFrameIds", "Unexpected frames were delivered.", sequence.unexpectedFrameIds);
  const expectedOrder = plan.map((frame) => frame.frameId);
  if (sequence.actualFrameIds.join("\u0000") !== expectedOrder.join("\u0000")) {
    issue(issues, "frame-order-mismatch", "sequence.actualFrameIds", "Delivered frame order does not match the authored X-sheet/frame plan.");
  }

  const measured = new Map(sequence.frames.map((frame) => [frame.frameId, frame] as const));
  for (const expected of plan) {
    const frame = measured.get(expected.frameId);
    if (!frame) continue;
    if (frame.exposureTicks !== expected.exposureTicks) {
      issue(issues, "exposure-timing-mismatch", `sequence.frames.${expected.frameId}.exposureTicks`, `Frame '${expected.frameId}' exposure is ${frame.exposureTicks} ticks; expected ${expected.exposureTicks}.`, [expected.frameId]);
    }
    if (expected.sourceRect && (frame.trimX !== expected.sourceRect.x || frame.trimY !== expected.sourceRect.y || frame.trimWidth !== expected.sourceRect.width || frame.trimHeight !== expected.sourceRect.height)) {
      issue(issues, "frame-geometry-mismatch", `sequence.frames.${expected.frameId}`, `Frame '${expected.frameId}' trim/source geometry does not match the authored frame plan.`, [expected.frameId]);
    }
    if (!pointMatches(expected.pivot, frame.pivot)) {
      issue(issues, "anchor-mismatch", `sequence.frames.${expected.frameId}.pivot`, `Frame '${expected.frameId}' pivot does not match its approved anchor.`, [expected.frameId]);
    }
    if (!pointMatches(expected.footPoint, frame.footPoint)) {
      issue(issues, "anchor-mismatch", `sequence.frames.${expected.frameId}.footPoint`, `Frame '${expected.frameId}' foot point does not match its approved contact anchor.`, [expected.frameId]);
    }
    for (const [anchorId, anchorPoint] of Object.entries(expected.handAnchors ?? {})) {
      if (!pointMatches(anchorPoint, frame.handAnchors[anchorId])) {
        issue(issues, "anchor-mismatch", `sequence.frames.${expected.frameId}.handAnchors.${anchorId}`, `Frame '${expected.frameId}' hand anchor '${anchorId}' drifted from the approved plan.`, [expected.frameId]);
      }
    }
    if (!pointMatches(expected.shadowAnchor, frame.shadowAnchor)) {
      issue(issues, "anchor-mismatch", `sequence.frames.${expected.frameId}.shadowAnchor`, `Frame '${expected.frameId}' shadow anchor drifted from the approved plan.`, [expected.frameId]);
    }
    if (expected.role === "contact" && !frame.contactStable) {
      issue(issues, "contact-instability", `sequence.frames.${expected.frameId}.contactStable`, `Contact frame '${expected.frameId}' does not preserve planted contact.`, [expected.frameId]);
    }
  }
  if (sequence.maximumObservedTrimJitterPixels > 1) {
    issue(issues, "trim-jitter", "sequence.maximumObservedTrimJitterPixels", `Measured trim jitter is ${sequence.maximumObservedTrimJitterPixels}px; animation masters must remain spatially stable.`);
  }
  if (sequence.maximumObservedAnchorDriftPixels > 1) {
    issue(issues, "anchor-mismatch", "sequence.maximumObservedAnchorDriftPixels", `Measured anchor drift is ${sequence.maximumObservedAnchorDriftPixels}px; approved anchors must remain stable.`);
  }
  if (order.sequencePolicy?.loopClosureReviewRequired && sequence.loopClosureDeltaPixels > 1) {
    issue(issues, "loop-closure", "sequence.loopClosureDeltaPixels", `Loop closure delta is ${sequence.loopClosureDeltaPixels}px.`);
  }
  if (order.sequencePolicy?.immediateNeighbourReviewRequired && sequence.neighbourContinuityScore < 0.95) {
    issue(issues, "neighbour-continuity", "sequence.neighbourContinuityScore", "Immediate-neighbour continuity score is below 0.95.");
  }
  if (order.sequencePolicy?.modelSheetConformanceRequired && sequence.modelSheetConformanceScore < 0.95) {
    issue(issues, "model-sheet-conformance", "sequence.modelSheetConformanceScore", "Model-sheet conformance score is below 0.95.");
  }
  if (order.sequencePolicy?.xSheetConformanceRequired && sequence.xSheetConformanceScore < 0.95) {
    issue(issues, "x-sheet-conformance", "sequence.xSheetConformanceScore", "X-sheet conformance score is below 0.95.");
  }
  if (sequence.styleConsistencyScore < 0.95) issue(issues, "style-drift", "sequence.styleConsistencyScore", "Frame-to-frame style consistency score is below 0.95.");
  if (sequence.proportionConsistencyScore < 0.95) issue(issues, "proportion-drift", "sequence.proportionConsistencyScore", "Frame-to-frame proportion consistency score is below 0.95.");
  if (sequence.paletteConsistencyScore < 0.95) issue(issues, "palette-drift", "sequence.paletteConsistencyScore", "Frame-to-frame palette consistency score is below 0.95.");
  return issues;
};
