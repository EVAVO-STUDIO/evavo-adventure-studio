import { describe, expect, it } from "vitest";
import type { AdventureCreativeReviewV3 } from "../src/creative-production-handoff-v3.js";
import { decideAdventureCreativeIterationV3 } from "../src/creative-production-orchestrator-v3.js";
import type { AdventureCreativeStrictQualityEvidenceV3 } from "../src/creative-production-quality-v3.js";
import { compileNinthReliquaryCreativeProofV3 } from "../src/ninth-reliquary-creative-proof-v3.js";

const order = () =>
  compileNinthReliquaryCreativeProofV3({
    sourceRevisionDigest: "sha256:source",
    styleDigest: "sha256:style",
    paletteDigest: "sha256:palette",
    environmentLayoutDigest: "sha256:layout",
    modelSheetDigest: "sha256:model",
    xSheetDigest: "sha256:sheet",
  }).maraWalkEast;

const acceptedReview = (revision = 1): AdventureCreativeReviewV3 => ({
  reviewVersion: 3,
  workOrderId: "creative.ninth-reliquary.mara.walk-east.v3",
  revision,
  candidateArtifactDigest: `sha256:candidate-r${revision}`,
  disposition: "accepted",
  issues: [],
  closedIssueIds: [],
  alphaEvidenceDigest: `sha256:alpha-r${revision}`,
  sequenceEvidenceDigest: `sha256:sequence-r${revision}`,
  styleEvidenceDigest: `sha256:style-review-r${revision}`,
  reviewerEvidenceDigest: `sha256:review-r${revision}`,
});

const qualityFor = (
  workOrder = order(),
  failingFrameId?: string,
): AdventureCreativeStrictQualityEvidenceV3 => {
  const plan = workOrder.framePlan ?? [];
  const candidate = `sha256:candidate-r${workOrder.revision}`;
  return {
    qualityVersion: 1,
    workOrderId: workOrder.workOrderId,
    revision: workOrder.revision,
    candidateArtifactDigest: candidate,
    styleEvidenceDigest: `sha256:strict-style-r${workOrder.revision}`,
    authorityDigests: {
      sourceRevisionDigest: workOrder.sourceRevisionDigest,
      styleDigest: workOrder.authorities.styleDigest,
      paletteDigest: workOrder.authorities.paletteDigest,
      modelSheetDigest: workOrder.authorities.modelSheetDigest,
      environmentLayoutDigest: workOrder.authorities.environmentLayoutDigest,
      xSheetDigest: workOrder.authorities.xSheetDigest,
    },
    alpha: {
      evidenceVersion: 1,
      artifactDigest: candidate,
      decodedWidth: workOrder.nativeSize.width,
      decodedHeight: workOrder.nativeSize.height,
      totalPixels: workOrder.nativeSize.width * workOrder.nativeSize.height,
      fullyTransparentPixels: 10_000,
      fullyOpaquePixels: workOrder.nativeSize.width * workOrder.nativeSize.height - 10_000,
      partialAlphaPixels: 0,
      checkerboardLikePixels: 0,
      matteResiduePixels: 0,
      haloPixels: 0,
      transparentRgbContaminatedPixels: 0,
      transparentCanvasEdge: true,
      hostilePlateEvidenceDigests: ["sha256:black", "sha256:white", "sha256:magenta"],
    },
    sequence: {
      evidenceVersion: 1,
      artifactDigest: candidate,
      frameOrder: plan.map((frame) => frame.frameId),
      frames: plan.map((frame) => ({
        frameId: frame.frameId,
        artifactDigest: `sha256:${frame.frameId}`,
        exposureTicks: frame.exposureTicks,
        modelSheetConformant: true,
        styleConformant: true,
        paletteConformant: true,
        anchorConformant: frame.frameId !== failingFrameId,
        silhouetteConformant: true,
        alphaConformant: true,
        neighbourPairDigests: Object.fromEntries(
          frame.requiredNeighbourFrameIds.map((neighbour) => [neighbour, `sha256:${frame.frameId}->${neighbour}`]),
        ),
      })),
      totalExposureTicks: plan.reduce((sum, frame) => sum + frame.exposureTicks, 0),
      xSheetDigest: workOrder.authorities.xSheetDigest ?? "",
      modelSheetDigest: workOrder.authorities.modelSheetDigest ?? "",
      loopClosureDigest: "sha256:loop-closure",
      sequencePreviewDigest: "sha256:flipbook",
    },
    issueClosures: [],
  };
};

describe("creative production iteration orchestrator v3", () => {
  it("delivers only when sibling review and strict Adventure quality both pass", () => {
    const workOrder = order();
    const result = decideAdventureCreativeIterationV3(workOrder, acceptedReview(), qualityFor(workOrder));
    expect(result.kind).toBe("deliver");
  });

  it("requests a targeted repair for the exact frame that fails strict anchor review", () => {
    const workOrder = order();
    const result = decideAdventureCreativeIterationV3(
      workOrder,
      acceptedReview(),
      qualityFor(workOrder, "walk-east.05"),
    );
    expect(result.kind).toBe("targeted-repair");
    if (result.kind !== "targeted-repair") return;
    expect(result.nextWorkOrder.revision).toBe(2);
    expect(result.nextWorkOrder.requestedRepairs).toHaveLength(1);
    expect(result.nextWorkOrder.requestedRepairs[0]).toMatchObject({
      issueCode: "anchor-drift",
      targetFrameIds: ["walk-east.05"],
      allowRegenerateWholeAsset: false,
    });
    expect(result.nextWorkOrder.requestedRepairs[0]?.preserveFrameIds).toHaveLength(9);
    expect(result.nextWorkOrder.requestedRepairs[0]?.preserveFrameIds).not.toContain("walk-east.05");
  });

  it("holds an accepted sibling review for human review when strict Adventure evidence is missing", () => {
    const result = decideAdventureCreativeIterationV3(order(), acceptedReview());
    expect(result).toMatchObject({ kind: "human-review" });
  });

  it("rejects further automatic repair when the bounded revision budget is exhausted", () => {
    const base = order();
    const maxed = { ...base, revision: 6, replacesRevision: 5 };
    const result = decideAdventureCreativeIterationV3(
      maxed,
      acceptedReview(6),
      qualityFor(maxed, "walk-east.05"),
    );
    expect(result.kind).toBe("reject");
    if (result.kind !== "reject") return;
    expect(result.reasons.join(" ")).toMatch(/Maximum revision passes/u);
  });
});
