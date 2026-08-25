import { describe, expect, it } from "vitest";
import type { AdventureCreativeWorkOrderV3 } from "../src/creative-production-handoff-v3.js";
import {
  type AdventureCreativeMeasuredEvidenceV3,
  validateAdventureCreativeMeasuredEvidenceV3,
} from "../src/creative-production-evidence-v3.js";

const order = (): AdventureCreativeWorkOrderV3 => ({
  contractVersion: 3,
  workOrderId: "work.test.walk",
  projectId: "project.test",
  assetId: "asset.test.walk",
  destinationStudio: "cel-animation-studio",
  taskKind: "animation-sequence",
  revision: 1,
  sourceRevisionDigest: "source-1",
  nativeSize: { width: 96, height: 48 },
  alphaPolicy: "required",
  preserveNativeCanvas: true,
  authorities: {
    profileId: "cinematic-handdrawn-conspiracy",
    styleDigest: "style-v1",
    paletteDigest: "palette-v1",
    modelSheetDigest: "model-v1",
    xSheetDigest: "xsheet-v1",
    referenceDigests: ["reference-v1"],
  },
  invariants: ["identity", "costume", "foot baseline"],
  forbiddenDrift: ["identity drift", "fake transparency"],
  artDirection: ["clean cel animation"],
  reviewChecklist: ["alpha", "anchors", "timing"],
  rejectionRules: ["missing frame", "checkerboard"],
  framePlan: [
    {
      frameId: "frame.01",
      role: "contact",
      exposureTicks: 2,
      sourceRect: { x: 0, y: 0, width: 48, height: 48 },
      pivot: { x: 24, y: 46 },
      footPoint: { x: 24, y: 46 },
      handAnchors: { right: { x: 34, y: 24 } },
      shadowAnchor: { x: 24, y: 46 },
      requiredNeighbourFrameIds: ["frame.02"],
    },
    {
      frameId: "frame.02",
      role: "passing",
      exposureTicks: 2,
      sourceRect: { x: 48, y: 0, width: 48, height: 48 },
      pivot: { x: 24, y: 46 },
      footPoint: { x: 24, y: 46 },
      handAnchors: { right: { x: 34, y: 24 } },
      shadowAnchor: { x: 24, y: 46 },
      requiredNeighbourFrameIds: ["frame.01"],
    },
  ],
  sequencePolicy: {
    independentFrameGenerationForbidden: true,
    exactExposureTimingRequired: true,
    modelSheetConformanceRequired: true,
    xSheetConformanceRequired: true,
    immediateNeighbourReviewRequired: true,
    loopClosureReviewRequired: true,
  },
  transparencyPolicy: {
    checkerboardForbidden: true,
    decodedAlphaRequired: true,
    transparentCanvasEdgeRequired: true,
    matteResidueForbidden: true,
    haloFringeForbidden: true,
    transparentRgbContaminationForbidden: true,
    hostilePlateReviewRequired: true,
  },
  iterationPolicy: {
    maximumRevisionPasses: 5,
    compareAgainstPreviousApproved: true,
    requireIssueClosureEvidence: true,
    preferTargetedRepair: true,
    fullRegenerationRequiresExplicitReason: true,
  },
  requestedRepairs: [],
});

const cleanAlpha = () => ({
  width: 96,
  height: 48,
  hasAlphaChannel: true,
  zeroAlphaPixels: 1000,
  partialAlphaPixels: 0,
  opaquePixels: 3608,
  minimumAlpha: 0,
  maximumAlpha: 255,
  checkerboardDetected: false,
  checkerboardScore: 0,
  matteResiduePixels: 0,
  alphaHaloPixels: 0,
  transparentRgbContaminationPixels: 0,
});

const evidence = (): AdventureCreativeMeasuredEvidenceV3 => ({
  evidenceVersion: 3,
  workOrderId: "work.test.walk",
  revision: 1,
  artifactWidth: 96,
  artifactHeight: 48,
  artifactByteLength: 4096,
  alpha: cleanAlpha(),
  styleDigest: "style-v1",
  paletteDigest: "palette-v1",
  modelSheetDigest: "model-v1",
  xSheetDigest: "xsheet-v1",
  protectedInvariantDigests: {
    identity: "identity-ok",
    costume: "costume-ok",
    "foot baseline": "feet-ok",
  },
  sequence: {
    actualFrameIds: ["frame.01", "frame.02"],
    duplicateFrameIds: [],
    missingFrameIds: [],
    unexpectedFrameIds: [],
    frames: [
      {
        frameId: "frame.01",
        width: 48,
        height: 48,
        trimX: 0,
        trimY: 0,
        trimWidth: 48,
        trimHeight: 48,
        exposureTicks: 2,
        pivot: { x: 24, y: 46 },
        footPoint: { x: 24, y: 46 },
        handAnchors: { right: { x: 34, y: 24 } },
        shadowAnchor: { x: 24, y: 46 },
        contactStable: true,
        alpha: cleanAlpha(),
      },
      {
        frameId: "frame.02",
        width: 48,
        height: 48,
        trimX: 48,
        trimY: 0,
        trimWidth: 48,
        trimHeight: 48,
        exposureTicks: 2,
        pivot: { x: 24, y: 46 },
        footPoint: { x: 24, y: 46 },
        handAnchors: { right: { x: 34, y: 24 } },
        shadowAnchor: { x: 24, y: 46 },
        contactStable: true,
        alpha: cleanAlpha(),
      },
    ],
    maximumObservedTrimJitterPixels: 0,
    maximumObservedAnchorDriftPixels: 0,
    loopClosureDeltaPixels: 0,
    neighbourContinuityScore: 1,
    modelSheetConformanceScore: 1,
    xSheetConformanceScore: 1,
    styleConsistencyScore: 1,
    proportionConsistencyScore: 1,
    paletteConsistencyScore: 1,
  },
});

describe("creative measured delivery evidence v3", () => {
  it("accepts a clean transparent animation delivery", () => {
    expect(validateAdventureCreativeMeasuredEvidenceV3(order(), evidence())).toEqual([]);
  });

  it("rejects fake checkerboard transparency and binary-alpha leakage", () => {
    const bad = evidence();
    const issues = validateAdventureCreativeMeasuredEvidenceV3(order(), {
      ...bad,
      alpha: {
        ...bad.alpha,
        checkerboardDetected: true,
        checkerboardScore: 0.92,
        partialAlphaPixels: 18,
        matteResiduePixels: 7,
        alphaHaloPixels: 11,
        transparentRgbContaminationPixels: 23,
      },
    });
    expect(issues.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "fake-transparency-checkerboard",
        "soft-alpha-when-binary-required",
        "matte-residue",
        "alpha-halo",
        "transparent-rgb-contamination",
      ]),
    );
  });

  it("rejects missing/duplicate frames, wrong timing and anchor drift", () => {
    const bad = evidence();
    const sequence = bad.sequence!;
    const issues = validateAdventureCreativeMeasuredEvidenceV3(order(), {
      ...bad,
      sequence: {
        ...sequence,
        actualFrameIds: ["frame.02", "frame.02"],
        missingFrameIds: ["frame.01"],
        duplicateFrameIds: ["frame.02"],
        unexpectedFrameIds: ["frame.extra"],
        frames: sequence.frames.map((frame) =>
          frame.frameId === "frame.02"
            ? { ...frame, exposureTicks: 5, pivot: { x: 29, y: 46 } }
            : frame,
        ),
        maximumObservedAnchorDriftPixels: 5,
        maximumObservedTrimJitterPixels: 4,
      },
    });
    expect(issues.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "frame-missing",
        "frame-duplicate",
        "frame-unexpected",
        "frame-order-mismatch",
        "exposure-timing-mismatch",
        "anchor-mismatch",
        "trim-jitter",
      ]),
    );
  });

  it("rejects style, model-sheet, X-sheet and palette drift", () => {
    const bad = evidence();
    const issues = validateAdventureCreativeMeasuredEvidenceV3(order(), {
      ...bad,
      styleDigest: "wrong-style",
      paletteDigest: "wrong-palette",
      modelSheetDigest: "wrong-model",
      xSheetDigest: "wrong-xsheet",
      sequence: {
        ...bad.sequence!,
        styleConsistencyScore: 0.7,
        proportionConsistencyScore: 0.8,
        paletteConsistencyScore: 0.75,
      },
    });
    expect(issues.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "style-drift",
        "palette-drift",
        "model-sheet-conformance",
        "x-sheet-conformance",
        "proportion-drift",
      ]),
    );
  });
});
