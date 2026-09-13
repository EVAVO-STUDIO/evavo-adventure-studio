import { describe, expect, it } from "vitest";
import {
  compileIllustratedConspiracyWorkOrder,
  ninthReliquaryAssetSpecs,
  type IllustratedConspiracyProductionAuthority,
} from "../src/illustrated-conspiracy-production.js";
import {
  validateAdventureCreativeStrictQualityV3,
  type AdventureCreativeStrictQualityEvidenceV3,
} from "../src/creative-production-quality-v3.js";
import type { AdventureCreativeReviewV3 } from "../src/creative-production-handoff-v3.js";

const authority: IllustratedConspiracyProductionAuthority = {
  sourceRevisionDigest: "sha256:source",
  styleDigest: "sha256:style",
  paletteDigest: "sha256:palette",
  modelSheetDigest: "sha256:model",
  xSheetDigest: "sha256:xsheet",
  referenceDigests: ["sha256:reference"],
};

const walkSpec = ninthReliquaryAssetSpecs.find(
  (candidate) => candidate.assetId === "asset.ninth-reliquary.mara.walk-east",
)!;
const order = compileIllustratedConspiracyWorkOrder(
  "project.ninth-reliquary",
  "work.ninth-reliquary.mara.walk-east",
  walkSpec,
  authority,
);

const review = (issues: AdventureCreativeReviewV3["issues"] = []): AdventureCreativeReviewV3 => ({
  reviewVersion: 3,
  workOrderId: order.workOrderId,
  revision: order.revision,
  candidateArtifactDigest: "sha256:candidate",
  disposition: "accepted",
  issues,
  closedIssueIds: [],
  alphaEvidenceDigest: "sha256:alpha",
  sequenceEvidenceDigest: "sha256:sequence",
  styleEvidenceDigest: "sha256:style-review",
  reviewerEvidenceDigest: "sha256:review",
});

const evidence = (): AdventureCreativeStrictQualityEvidenceV3 => ({
  qualityVersion: 1,
  workOrderId: order.workOrderId,
  revision: order.revision,
  candidateArtifactDigest: "sha256:candidate",
  styleEvidenceDigest: "sha256:style-review",
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
    fullyTransparentPixels: 12000,
    fullyOpaquePixels: order.nativeSize.width * order.nativeSize.height - 12000,
    partialAlphaPixels: 0,
    checkerboardLikePixels: 0,
    matteResiduePixels: 0,
    haloPixels: 0,
    transparentRgbContaminatedPixels: 0,
    transparentCanvasEdge: true,
    hostilePlateEvidenceDigests: ["sha256:black", "sha256:white", "sha256:green"],
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
        frame.requiredNeighbourFrameIds.map((neighbour) => [neighbour, `sha256:${frame.frameId}:${neighbour}`]),
      ),
    })),
    totalExposureTicks: order.framePlan!.reduce((total, frame) => total + frame.exposureTicks, 0),
    xSheetDigest: authority.xSheetDigest!,
    modelSheetDigest: authority.modelSheetDigest!,
    loopClosureDigest: "sha256:loop",
    sequencePreviewDigest: "sha256:flipbook",
  },
  issueClosures: [],
});

describe("strict creative production quality v3", () => {
  it("accepts a fully evidenced Ninth Reliquary cel sequence", () => {
    expect(validateAdventureCreativeStrictQualityV3(order, review(), evidence())).toEqual([]);
  });

  it("rejects fake/contaminated transparency even when a review carries an alpha digest", () => {
    const bad = evidence();
    const result = validateAdventureCreativeStrictQualityV3(order, review(), {
      ...bad,
      alpha: {
        ...bad.alpha!,
        checkerboardLikePixels: 64,
        matteResiduePixels: 12,
        haloPixels: 3,
        transparentRgbContaminatedPixels: 9,
      },
    });
    expect(result.map((entry) => entry.code)).toContain("strict-alpha-contamination");
  });

  it("rejects missing frames, exposure drift and missing neighbour continuity", () => {
    const bad = evidence();
    const frames = bad.sequence!.frames.slice(0, -1).map((frame, index) =>
      index === 1
        ? { ...frame, exposureTicks: frame.exposureTicks + 1, neighbourPairDigests: {} }
        : frame,
    );
    const result = validateAdventureCreativeStrictQualityV3(order, review(), {
      ...bad,
      sequence: {
        ...bad.sequence!,
        frameOrder: bad.sequence!.frameOrder.slice(0, -1),
        frames,
      },
    });
    expect(result.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "strict-frame-order",
        "strict-frame-coverage",
        "strict-exposure-timing",
        "strict-neighbour-evidence",
      ]),
    );
  });

  it("does not allow accepted work to retain an unresolved major identity issue", () => {
    const result = validateAdventureCreativeStrictQualityV3(
      order,
      review([
        {
          issueId: "issue.face",
          code: "identity-drift",
          severity: "major",
          message: "Face construction drifts from the approved model sheet.",
          frameIds: [order.framePlan![3]!.frameId],
          evidenceDigests: ["sha256:face-drift"],
          suggestedRepair: "Repair only the affected face construction and preserve the approved body drawing.",
        },
      ]),
      evidence(),
    );
    expect(result.map((entry) => entry.code)).toContain("strict-accepted-with-serious-issues");
  });
});
