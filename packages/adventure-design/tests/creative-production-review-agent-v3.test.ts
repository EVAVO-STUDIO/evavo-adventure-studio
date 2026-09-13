import { describe, expect, it } from "vitest";
import {
  compileIllustratedConspiracyWorkOrder,
  ninthReliquaryAssetSpecs,
} from "../src/illustrated-conspiracy-production.js";
import { createAdventureCreativeAutomatedReviewV3 } from "../src/creative-production-review-agent-v3.js";
import type { AdventureCreativeStrictQualityEvidenceV3 } from "../src/creative-production-quality-v3.js";

const spec = ninthReliquaryAssetSpecs.find(
  (candidate) => candidate.assetId === "asset.ninth-reliquary.mara.walk-east",
)!;
const authority = {
  sourceRevisionDigest: "sha256:source",
  styleDigest: "sha256:style",
  paletteDigest: "sha256:palette",
  modelSheetDigest: "sha256:model",
  xSheetDigest: "sha256:xsheet",
  referenceDigests: ["sha256:ref"],
};
const order = compileIllustratedConspiracyWorkOrder(
  "project.ninth-reliquary",
  "work.mara.walk",
  spec,
  authority,
);

const evidence = (): AdventureCreativeStrictQualityEvidenceV3 => ({
  qualityVersion: 1,
  workOrderId: order.workOrderId,
  revision: order.revision,
  candidateArtifactDigest: "sha256:candidate",
  styleEvidenceDigest: "sha256:style-proof",
  authorityDigests: {
    sourceRevisionDigest: authority.sourceRevisionDigest,
    styleDigest: authority.styleDigest,
    paletteDigest: authority.paletteDigest,
    modelSheetDigest: authority.modelSheetDigest,
    xSheetDigest: authority.xSheetDigest,
  },
  alpha: {
    evidenceVersion: 1,
    artifactDigest: "sha256:candidate",
    decodedWidth: order.nativeSize.width,
    decodedHeight: order.nativeSize.height,
    totalPixels: order.nativeSize.width * order.nativeSize.height,
    fullyTransparentPixels: 10000,
    fullyOpaquePixels: order.nativeSize.width * order.nativeSize.height - 10000,
    partialAlphaPixels: 0,
    checkerboardLikePixels: 0,
    matteResiduePixels: 0,
    haloPixels: 0,
    transparentRgbContaminatedPixels: 0,
    transparentCanvasEdge: true,
    hostilePlateEvidenceDigests: ["black", "white", "green"],
  },
  sequence: {
    evidenceVersion: 1,
    artifactDigest: "sha256:candidate",
    frameOrder: order.framePlan!.map((frame) => frame.frameId),
    frames: order.framePlan!.map((frame) => ({
      frameId: frame.frameId,
      artifactDigest: `sha256:${frame.frameId}`,
      exposureTicks: frame.exposureTicks,
      modelSheetConformant: true,
      styleConformant: true,
      paletteConformant: true,
      anchorConformant: true,
      silhouetteConformant: true,
      alphaConformant: true,
      neighbourPairDigests: Object.fromEntries(
        frame.requiredNeighbourFrameIds.map((id) => [id, `sha256:${frame.frameId}:${id}`]),
      ),
    })),
    totalExposureTicks: order.framePlan!.reduce((sum, frame) => sum + frame.exposureTicks, 0),
    xSheetDigest: authority.xSheetDigest,
    modelSheetDigest: authority.modelSheetDigest,
    loopClosureDigest: "sha256:loop",
    sequencePreviewDigest: "sha256:preview",
  },
  issueClosures: [],
});

describe("creative production review agent v3", () => {
  it("accepts a clean fully evidenced sequence without creating a repair revision", () => {
    const result = createAdventureCreativeAutomatedReviewV3(order, evidence(), "sha256:reviewer");
    expect(result.review.disposition).toBe("accepted");
    expect(result.repairOrder).toBeNull();
    expect(result.issueCount).toBe(0);
  });

  it("targets only the broken frame and preserves every unaffected drawing", () => {
    const bad = evidence();
    const targetId = order.framePlan![3]!.frameId;
    const result = createAdventureCreativeAutomatedReviewV3(
      order,
      {
        ...bad,
        sequence: {
          ...bad.sequence!,
          frames: bad.sequence!.frames.map((frame) =>
            frame.frameId === targetId
              ? { ...frame, modelSheetConformant: false, anchorConformant: false }
              : frame,
          ),
        },
      },
      "sha256:reviewer",
    );

    expect(result.review.disposition).toBe("repair-required");
    expect(result.repairOrder?.revision).toBe(2);
    expect(result.repairOrder?.requestedRepairs.length).toBeGreaterThan(0);
    for (const repair of result.repairOrder?.requestedRepairs ?? []) {
      expect(repair.targetFrameIds).toEqual([targetId]);
      expect(repair.allowRegenerateWholeAsset).toBe(false);
      expect(repair.preserveFrameIds).toHaveLength(order.framePlan!.length - 1);
      expect(repair.preserveFrameIds).not.toContain(targetId);
    }
  });
});
