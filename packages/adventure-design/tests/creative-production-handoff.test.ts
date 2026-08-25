import { describe, expect, it } from "vitest";
import {
  acceptAdventureCreativeCandidate,
  createAdventureCreativeReworkRequest,
  reviewAdventureCreativeCandidate,
  type AdventureCreativeCandidateEvidence,
  type AdventureCreativeWorkOrder,
} from "../src/creative-production-handoff.js";

const order: AdventureCreativeWorkOrder = {
  contractVersion: 1,
  workOrderId: "creative.the-ninth-reliquary.hero.walk-east",
  projectId: "project.ninth-reliquary" as never,
  assetId: "asset.ninth-reliquary.hero" as never,
  destinationStudio: "cel-animation-studio",
  taskKind: "animation-sequence",
  briefRevision: 3,
  sourceRevisionDigest: "source-3",
  visualStandardDigest: "visual-standard-7",
  styleBankDigest: "style-bank-a",
  characterModelSheetDigest: "model-sheet-hero-2",
  xSheetDigest: "xsheet.walk-east.4",
  nativeSize: { width: 768, height: 192 },
  alphaPolicy: "required",
  checkerboardForbidden: true,
  canvasEdgeMustBeTransparent: true,
  preserveNativeCanvas: true,
  requiredReferenceDigests: ["model-sheet-hero-2", "visual-board-1", "visual-board-2"],
  framePlan: [
    { frameId: "walk-east.01", exposureTicks: 3, role: "contact", pivot: { x: 48, y: 180 }, footPoint: { x: 48, y: 180 } },
    { frameId: "walk-east.02", exposureTicks: 3, role: "passing", pivot: { x: 48, y: 180 }, footPoint: { x: 48, y: 180 } },
    { frameId: "walk-east.03", exposureTicks: 3, role: "contact", pivot: { x: 48, y: 180 }, footPoint: { x: 48, y: 180 } },
  ],
  artDirection: ["Clean hand-drawn cel construction", "Anime-adjacent timing without copying a named production"],
  rejectionRules: ["No baked checkerboard", "No independent frame regeneration", "No identity drift"],
};

const acceptedCandidate = (): AdventureCreativeCandidateEvidence => ({
  contractVersion: 1,
  workOrderId: order.workOrderId,
  candidateRevision: 4,
  previousCandidateDigest: "candidate-3",
  sourceDigest: "immutable-source-1",
  candidateDigest: "candidate-4",
  width: 768,
  height: 192,
  mediaType: "application/x-aseprite",
  styleStandardDigest: "visual-standard-7",
  modelSheetDigest: "model-sheet-hero-2",
  reviewScaleVerified: true,
  alpha: {
    decodedAlphaPresent: true,
    fullyTransparentCanvasEdge: true,
    checkerboardDetected: false,
    matteResidueDetected: false,
    haloOrFringeDetected: false,
    alphaMaskReviewed: true,
    hostilePlateProofs: ["black", "white", "grey", "green", "magenta"],
  },
  animation: {
    frameIds: ["walk-east.01", "walk-east.02", "walk-east.03"],
    frameTimingTicks: [3, 3, 3],
    neighbourContinuityReviewed: true,
    loopClosureReviewed: true,
    identityLocked: true,
    anchorsStable: true,
    paletteStable: true,
    lineAndConstructionStable: true,
    independentlyGeneratedFrames: false,
    xSheetDigest: "xsheet.walk-east.4",
  },
});

describe("cross-studio creative production", () => {
  it("accepts only reviewed alpha-clean, timing-correct continuous animation", () => {
    const candidate = acceptedCandidate();
    const review = reviewAdventureCreativeCandidate(order, candidate, 2);
    expect(review.decision).toBe("accepted");
    expect(review.issues).toEqual([]);
    expect(acceptAdventureCreativeCandidate(order, candidate, review)).toMatchObject({
      candidateDigest: "candidate-4",
      alphaAccepted: true,
      animationAccepted: true,
    });
  });

  it("rejects fake transparency and independent frame regeneration with targeted rework", () => {
    const candidate: AdventureCreativeCandidateEvidence = {
      ...acceptedCandidate(),
      candidateRevision: 1,
      candidateDigest: "bad-candidate",
      alpha: {
        ...acceptedCandidate().alpha!,
        checkerboardDetected: true,
        fullyTransparentCanvasEdge: false,
        haloOrFringeDetected: true,
      },
      animation: {
        ...acceptedCandidate().animation!,
        frameTimingTicks: [2, 2, 2],
        anchorsStable: false,
        identityLocked: false,
        independentlyGeneratedFrames: true,
      },
    };
    const review = reviewAdventureCreativeCandidate(order, candidate);
    expect(review.decision).toBe("revise");
    expect(review.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "checkerboard-baked",
        "nontransparent-canvas-edge",
        "halo-fringe",
        "exposure-timing-mismatch",
        "anchor-drift",
        "identity-drift",
        "independent-frame-regeneration",
      ]),
    );
    const rework = createAdventureCreativeReworkRequest(order, candidate, review, ["approved silhouette", "approved costume colours"]);
    expect(rework.nextCandidateRevision).toBe(2);
    expect(rework.requiredFixes.length).toBeGreaterThan(0);
    expect(rework.preserveApprovedAspects).toEqual(["approved silhouette", "approved costume colours"]);
    expect(() => acceptAdventureCreativeCandidate(order, candidate, review)).toThrow(/cannot be accepted/u);
  });

  it("rejects candidates reviewed against stale style/model/X-sheet authority", () => {
    const candidate: AdventureCreativeCandidateEvidence = {
      ...acceptedCandidate(),
      styleStandardDigest: "stale-style",
      modelSheetDigest: "stale-model",
      animation: { ...acceptedCandidate().animation!, xSheetDigest: "stale-xsheet" },
    };
    const review = reviewAdventureCreativeCandidate(order, candidate);
    expect(review.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["style-standard-mismatch", "model-sheet-mismatch", "x-sheet-mismatch"]),
    );
  });
});
