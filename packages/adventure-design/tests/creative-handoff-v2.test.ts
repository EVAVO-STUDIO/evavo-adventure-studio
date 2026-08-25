import { describe, expect, it } from "vitest";
import {
  type AdventureCreativeReviewResultV2,
  type AdventureCreativeWorkOrderV2,
  validateAdventureCreativeReviewResultV2,
  validateAdventureCreativeWorkOrderV2,
} from "../src/creative-handoff-v2.js";

const animationOrder = (): AdventureCreativeWorkOrderV2 => ({
  contractVersion: 2,
  workOrderId: "adventure-work.cel.hero.walk-east.r2",
  projectId: "project.templar-cel-proof",
  assetId: "asset.hero.walk-east",
  destinationStudio: "cel-animation-studio",
  taskKind: "animation-sequence",
  revision: 2,
  replacesRevision: 1,
  sourceRevisionDigest: "sha256:source",
  nativeSize: { width: 256, height: 64 },
  alphaPolicy: "required",
  preserveNativeCanvas: true,
  style: {
    profileId: "modern-cinematic-cel-conspiracy",
    styleDigest: "sha256:style",
    paletteDigest: "sha256:palette",
    modelSheetDigest: "sha256:model",
    referenceDigests: ["sha256:hero-front", "sha256:hero-side"],
    invariants: [
      "same face construction and hair silhouette across every frame",
      "clean cel contour with restrained interior line weight",
      "grounded European-travel wardrobe with original design details",
    ],
    forbiddenDrift: [
      "do not change eye shape, nose length, jacket construction or body proportions between frames",
      "do not introduce painterly texture into transparent character cels",
    ],
  },
  framePlan: [
    { frameId: "walk.01.contact-left", role: "contact", exposureTicks: 3, sourceRect: { x: 0, y: 0, width: 32, height: 64 }, pivot: { x: 16, y: 62 }, footPoint: { x: 16, y: 62 }, requiredNeighbourFrameIds: ["walk.02.passing-left", "walk.08.passing-right"] },
    { frameId: "walk.02.passing-left", role: "passing", exposureTicks: 3, sourceRect: { x: 32, y: 0, width: 32, height: 64 }, pivot: { x: 16, y: 62 }, footPoint: { x: 16, y: 62 }, requiredNeighbourFrameIds: ["walk.01.contact-left", "walk.03.extreme-left"] },
    { frameId: "walk.03.extreme-left", role: "extreme", exposureTicks: 3, sourceRect: { x: 64, y: 0, width: 32, height: 64 }, pivot: { x: 16, y: 62 }, footPoint: { x: 16, y: 62 }, requiredNeighbourFrameIds: ["walk.02.passing-left", "walk.04.contact-right"] },
    { frameId: "walk.04.contact-right", role: "contact", exposureTicks: 3, sourceRect: { x: 96, y: 0, width: 32, height: 64 }, pivot: { x: 16, y: 62 }, footPoint: { x: 16, y: 62 }, requiredNeighbourFrameIds: ["walk.03.extreme-left", "walk.05.contact-right"] },
    { frameId: "walk.05.contact-right", role: "contact", exposureTicks: 3, sourceRect: { x: 128, y: 0, width: 32, height: 64 }, pivot: { x: 16, y: 62 }, footPoint: { x: 16, y: 62 }, requiredNeighbourFrameIds: ["walk.04.contact-right", "walk.06.passing-right"] },
    { frameId: "walk.06.passing-right", role: "passing", exposureTicks: 3, sourceRect: { x: 160, y: 0, width: 32, height: 64 }, pivot: { x: 16, y: 62 }, footPoint: { x: 16, y: 62 }, requiredNeighbourFrameIds: ["walk.05.contact-right", "walk.07.extreme-right"] },
    { frameId: "walk.07.extreme-right", role: "extreme", exposureTicks: 3, sourceRect: { x: 192, y: 0, width: 32, height: 64 }, pivot: { x: 16, y: 62 }, footPoint: { x: 16, y: 62 }, requiredNeighbourFrameIds: ["walk.06.passing-right", "walk.08.passing-right"] },
    { frameId: "walk.08.passing-right", role: "passing", exposureTicks: 3, sourceRect: { x: 224, y: 0, width: 32, height: 64 }, pivot: { x: 16, y: 62 }, footPoint: { x: 16, y: 62 }, requiredNeighbourFrameIds: ["walk.07.extreme-right", "walk.01.contact-left"] },
  ],
  loop: true,
  artDirection: [
    "modern cel/anime-adjacent adventure character, original design, cinematic but practical silhouette",
    "consistent cel flats and controlled two-tone shadow families; no generated microtexture",
  ],
  reviewChecklist: [
    "compare every frame at 1x and onion-skin against immediate neighbours",
    "verify planted foot does not skate and pivot remains pixel registered",
    "verify transparent canvas edge and hostile-matte compositing",
  ],
  rejectionRules: [
    "reject fake checkerboard transparency or solid matte background",
    "reject missing, duplicated, reordered or independently generated-looking frames",
    "reject face/costume/proportion drift between neighbouring cels",
  ],
  iterationPolicy: {
    maximumRevisionPasses: 5,
    compareAgainstPreviousApproved: true,
    requireIssueClosureEvidence: true,
  },
  transparencyPolicy: {
    checkerboardForbidden: true,
    decodedAlphaRequired: true,
    transparentCanvasEdgeRequired: true,
    matteResidueForbidden: true,
    haloFringeForbidden: true,
    hostilePlateReviewRequired: true,
  },
  sequencePolicy: {
    independentFrameGenerationForbidden: true,
    neighbourConditioningRequired: true,
    modelSheetConformanceRequired: true,
    xSheetDigest: "sha256:x-sheet",
    xSheetConformanceRequired: true,
    loopClosureReviewRequired: true,
    exactExposureTimingRequired: true,
  },
});

describe("Adventure creative handoff v2", () => {
  it("accepts a governed transparent cel-animation sequence", () => {
    expect(validateAdventureCreativeWorkOrderV2(animationOrder())).toEqual([]);
  });

  it("rejects fake/weak transparency and incomplete sequence authority", () => {
    const order = animationOrder();
    const invalid = {
      ...order,
      transparencyPolicy: {
        ...order.transparencyPolicy,
        decodedAlphaRequired: false,
        transparentCanvasEdgeRequired: false,
      },
      sequencePolicy: undefined,
    } as AdventureCreativeWorkOrderV2;
    expect(validateAdventureCreativeWorkOrderV2(invalid).map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["alpha-policy", "sequence-policy-required"]),
    );
  });

  it("requires accepted animation review to cover every frame and retain alpha/sequence evidence", () => {
    const order = animationOrder();
    const incomplete: AdventureCreativeReviewResultV2 = {
      contractVersion: 2,
      workOrderId: order.workOrderId,
      revision: order.revision,
      candidateDigest: "sha256:candidate",
      decision: "accepted",
      issues: [],
      reviewedFrameIds: ["walk.01.contact-left"],
      reviewer: "animation-director",
      reviewedAt: "2026-08-25T00:00:00Z",
    };
    expect(validateAdventureCreativeReviewResultV2(order, incomplete).map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["review-policy-missing", "alpha-policy"]),
    );

    const complete: AdventureCreativeReviewResultV2 = {
      ...incomplete,
      reviewedFrameIds: order.framePlan?.map((frame) => frame.frameId) ?? [],
      alphaEvidenceDigest: "sha256:alpha-evidence",
      sequenceEvidenceDigest: "sha256:sequence-evidence",
      styleEvidenceDigest: "sha256:style-evidence",
    };
    expect(validateAdventureCreativeReviewResultV2(order, complete)).toEqual([]);
  });

  it("does not allow a review with blocking errors to be accepted", () => {
    const order = animationOrder();
    const review: AdventureCreativeReviewResultV2 = {
      contractVersion: 2,
      workOrderId: order.workOrderId,
      revision: order.revision,
      candidateDigest: "sha256:candidate",
      decision: "accepted",
      reviewedFrameIds: order.framePlan?.map((frame) => frame.frameId) ?? [],
      alphaEvidenceDigest: "sha256:alpha",
      sequenceEvidenceDigest: "sha256:sequence",
      issues: [{ code: "identity-drift", severity: "error", frameId: "walk.05.contact-right", message: "Face shape drifted." }],
      reviewer: "animation-director",
      reviewedAt: "2026-08-25T00:00:00Z",
    };
    expect(validateAdventureCreativeReviewResultV2(order, review)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "review-policy-missing" })]),
    );
  });
});
