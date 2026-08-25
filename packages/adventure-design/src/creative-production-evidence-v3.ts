import type {
  CreativeProductionRequestV3,
  CreativeTransparencyModeV3,
} from "./creative-production-handoff-v3.js";

export interface CreativeAlphaEvidenceV3 {
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
  readonly matteContaminationPixels: number;
  readonly backgroundBleedPixels: number;
  readonly edgeContaminationPixels: number;
}

export interface CreativeFrameGeometryEvidenceV3 {
  readonly frameId: string;
  readonly width: number;
  readonly height: number;
  readonly trimX: number;
  readonly trimY: number;
  readonly trimWidth: number;
  readonly trimHeight: number;
  readonly durationTicks: number;
  readonly anchors: Readonly<Record<string, { readonly x: number; readonly y: number }>>;
  readonly contactStable: boolean;
  readonly alpha: CreativeAlphaEvidenceV3;
}

export interface CreativeAnimationEvidenceV3 {
  readonly actualFrameIds: readonly string[];
  readonly duplicateFrameIds: readonly string[];
  readonly missingFrameIds: readonly string[];
  readonly unexpectedFrameIds: readonly string[];
  readonly frames: readonly CreativeFrameGeometryEvidenceV3[];
  readonly maximumObservedTrimJitterPixels: number;
  readonly maximumObservedAnchorDriftPixels: Readonly<Record<string, number>>;
  readonly loopClosureDeltaPixels: number;
  readonly styleConsistencyScore: number;
  readonly proportionConsistencyScore: number;
  readonly paletteConsistencyScore: number;
}

export interface CreativeMeasuredDeliveryEvidenceV3 {
  readonly evidenceVersion: 3;
  readonly artifactWidth: number;
  readonly artifactHeight: number;
  readonly alpha: CreativeAlphaEvidenceV3;
  readonly animation?: CreativeAnimationEvidenceV3;
  readonly styleLockId: string;
  readonly styleGuideHash: string;
  readonly paletteContractHash: string;
  readonly measuredAtRevision: number;
}

export type CreativeEvidenceIssueCodeV3 =
  | "dimension-mismatch"
  | "missing-alpha-channel"
  | "missing-zero-alpha"
  | "partial-alpha-forbidden"
  | "fake-checkerboard-transparency"
  | "matte-contamination"
  | "background-bleed"
  | "edge-contamination"
  | "animation-evidence-missing"
  | "frame-missing"
  | "frame-duplicate"
  | "frame-unexpected"
  | "frame-order-mismatch"
  | "frame-duration-mismatch"
  | "frame-dimension-mismatch"
  | "contact-frame-unstable"
  | "anchor-track-missing"
  | "anchor-drift"
  | "trim-jitter"
  | "loop-closure"
  | "style-lock-mismatch"
  | "style-guide-mismatch"
  | "palette-contract-mismatch"
  | "style-consistency"
  | "proportion-consistency"
  | "palette-consistency";

export interface CreativeEvidenceIssueV3 {
  readonly code: CreativeEvidenceIssueCodeV3;
  readonly severity: "error" | "warning";
  readonly path: string;
  readonly message: string;
  readonly frameIds?: readonly string[];
}

const acceptsPartialAlpha = (mode: CreativeTransparencyModeV3): boolean =>
  mode === "controlled-soft-alpha";

const expectedDimensions = (request: CreativeProductionRequestV3): { width: number; height: number } | null => {
  const output = request.output;
  if (!output) return null;
  if ("width" in output && "height" in output) return { width: output.width, height: output.height };
  return null;
};

const push = (
  issues: CreativeEvidenceIssueV3[],
  code: CreativeEvidenceIssueCodeV3,
  path: string,
  message: string,
  frameIds?: readonly string[],
): void => {
  issues.push({ code, severity: "error", path, message, ...(frameIds ? { frameIds } : {}) });
};

export const validateCreativeMeasuredEvidenceV3 = (
  request: CreativeProductionRequestV3,
  evidence: CreativeMeasuredDeliveryEvidenceV3,
): readonly CreativeEvidenceIssueV3[] => {
  const issues: CreativeEvidenceIssueV3[] = [];
  const expected = expectedDimensions(request);
  if (expected && (evidence.artifactWidth !== expected.width || evidence.artifactHeight !== expected.height)) {
    push(
      issues,
      "dimension-mismatch",
      "artifact",
      `Measured artifact is ${evidence.artifactWidth}×${evidence.artifactHeight}; expected ${expected.width}×${expected.height}.`,
    );
  }

  const alpha = evidence.alpha;
  const transparency = request.transparency;
  if (transparency.acceptance.alphaChannelRequired && !alpha.hasAlphaChannel) {
    push(issues, "missing-alpha-channel", "alpha", "Delivery has no real alpha channel.");
  }
  if (transparency.acceptance.zeroAlphaRequired && alpha.zeroAlphaPixels <= 0) {
    push(
      issues,
      "missing-zero-alpha",
      "alpha.zeroAlphaPixels",
      "Transparent-background delivery contains no fully transparent pixels.",
    );
  }
  if (!acceptsPartialAlpha(transparency.mode) && alpha.partialAlphaPixels > 0) {
    push(
      issues,
      "partial-alpha-forbidden",
      "alpha.partialAlphaPixels",
      `${alpha.partialAlphaPixels} partially transparent pixels violate '${transparency.mode}' alpha policy.`,
    );
  }
  if (transparency.acceptance.checkerboardBakeDetectionRequired && alpha.checkerboardDetected) {
    push(
      issues,
      "fake-checkerboard-transparency",
      "alpha.checkerboardDetected",
      "Checkerboard pixels are baked into the image instead of represented by alpha transparency.",
    );
  }
  if (transparency.acceptance.matteContaminationDetection && alpha.matteContaminationPixels > 0) {
    push(
      issues,
      "matte-contamination",
      "alpha.matteContaminationPixels",
      `${alpha.matteContaminationPixels} pixels contain matte contamination at transparent boundaries.`,
    );
  }
  if (transparency.acceptance.backgroundBleedDetection && alpha.backgroundBleedPixels > 0) {
    push(
      issues,
      "background-bleed",
      "alpha.backgroundBleedPixels",
      `${alpha.backgroundBleedPixels} pixels contain source-background bleed.`,
    );
  }
  if (alpha.edgeContaminationPixels > 0) {
    push(
      issues,
      "edge-contamination",
      "alpha.edgeContaminationPixels",
      `${alpha.edgeContaminationPixels} edge pixels are contaminated and require cleanup.`,
    );
  }

  if (evidence.styleLockId !== request.style.styleLockId) {
    push(issues, "style-lock-mismatch", "styleLockId", "Delivery style-lock ID does not match the request.");
  }
  if (evidence.styleGuideHash !== request.style.styleGuideHash) {
    push(issues, "style-guide-mismatch", "styleGuideHash", "Delivery style-guide hash does not match the request.");
  }
  if (evidence.paletteContractHash !== request.style.paletteContractHash) {
    push(issues, "palette-contract-mismatch", "paletteContractHash", "Delivery palette contract does not match the request.");
  }

  const animationRequest = request.animation;
  if (!animationRequest) return issues;
  const animation = evidence.animation;
  if (!animation) {
    push(issues, "animation-evidence-missing", "animation", "Animation request requires measured frame evidence.");
    return issues;
  }

  if (animation.missingFrameIds.length > 0) {
    push(issues, "frame-missing", "animation.missingFrameIds", "Required animation frames are missing.", animation.missingFrameIds);
  }
  if (animation.duplicateFrameIds.length > 0) {
    push(issues, "frame-duplicate", "animation.duplicateFrameIds", "Animation contains duplicate frame IDs.", animation.duplicateFrameIds);
  }
  if (animation.unexpectedFrameIds.length > 0) {
    push(issues, "frame-unexpected", "animation.unexpectedFrameIds", "Animation contains unexpected frame IDs.", animation.unexpectedFrameIds);
  }
  if (animation.actualFrameIds.join("\u0000") !== animationRequest.frameOrder.join("\u0000")) {
    push(issues, "frame-order-mismatch", "animation.actualFrameIds", "Measured frame order does not match the authored frame order.");
  }

  const measuredFrames = new Map(animation.frames.map((frame) => [frame.frameId, frame] as const));
  for (const timing of animationRequest.timings) {
    const frame = measuredFrames.get(timing.frameId);
    if (!frame) continue;
    if (frame.durationTicks !== timing.durationTicks) {
      push(
        issues,
        "frame-duration-mismatch",
        `animation.frames.${timing.frameId}.durationTicks`,
        `Frame '${timing.frameId}' measured ${frame.durationTicks} ticks; expected ${timing.durationTicks}.`,
        [timing.frameId],
      );
    }
  }
  for (const frameId of animationRequest.contactFrameIds) {
    const frame = measuredFrames.get(frameId);
    if (frame && !frame.contactStable) {
      push(
        issues,
        "contact-frame-unstable",
        `animation.frames.${frameId}.contactStable`,
        `Contact frame '${frameId}' does not preserve planted contact.`,
        [frameId],
      );
    }
  }
  for (const track of animationRequest.anchorTracks) {
    const observed = animation.maximumObservedAnchorDriftPixels[track.anchorId];
    if (observed === undefined) {
      push(issues, "anchor-track-missing", `animation.anchor.${track.anchorId}`, `Anchor '${track.anchorId}' has no measured drift evidence.`);
    } else if (observed > animationRequest.maxAnchorDriftPixels) {
      push(
        issues,
        "anchor-drift",
        `animation.anchor.${track.anchorId}`,
        `Anchor '${track.anchorId}' drifts ${observed}px; allowed maximum is ${animationRequest.maxAnchorDriftPixels}px.`,
      );
    }
  }
  if (animation.maximumObservedTrimJitterPixels > animationRequest.maxTrimJitterPixels) {
    push(
      issues,
      "trim-jitter",
      "animation.maximumObservedTrimJitterPixels",
      `Measured trim jitter ${animation.maximumObservedTrimJitterPixels}px exceeds ${animationRequest.maxTrimJitterPixels}px.`,
    );
  }
  if (animationRequest.loop && animation.loopClosureDeltaPixels > animationRequest.maxAnchorDriftPixels) {
    push(
      issues,
      "loop-closure",
      "animation.loopClosureDeltaPixels",
      `Loop closure delta ${animation.loopClosureDeltaPixels}px exceeds ${animationRequest.maxAnchorDriftPixels}px.`,
    );
  }
  if (animation.styleConsistencyScore < 0.9) {
    push(issues, "style-consistency", "animation.styleConsistencyScore", "Animation style consistency score is below 0.90.");
  }
  if (animation.proportionConsistencyScore < 0.9) {
    push(issues, "proportion-consistency", "animation.proportionConsistencyScore", "Animation proportion consistency score is below 0.90.");
  }
  if (animation.paletteConsistencyScore < 0.9) {
    push(issues, "palette-consistency", "animation.paletteConsistencyScore", "Animation palette consistency score is below 0.90.");
  }
  return issues;
};
