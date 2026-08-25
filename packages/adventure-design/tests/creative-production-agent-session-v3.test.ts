import { describe, expect, it } from "vitest";
import {
  compileIllustratedConspiracyWorkOrder,
  ninthReliquaryAssetSpecs,
} from "../src/illustrated-conspiracy-production.js";
import {
  createAdventureCreativeProductionSessionV3,
  submitAdventureCreativeCandidateV3,
} from "../src/creative-production-session-v3.js";
import { advanceAdventureCreativeSessionFromEvidenceV3 } from "../src/creative-production-agent-session-v3.js";
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
  "work.agent.mara.walk",
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
    fullyTransparentPixels: 1000,
    fullyOpaquePixels: order.nativeSize.width * order.nativeSize.height - 1000,
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

const submitted = () =>
  submitAdventureCreativeCandidateV3(
    createAdventureCreativeProductionSessionV3(order),
    "sha256:candidate",
  );

describe("creative production agent session v3", () => {
  it("advances clean evidence to awaiting delivery", () => {
    const step = advanceAdventureCreativeSessionFromEvidenceV3(
      submitted(),
      evidence(),
      "sha256:reviewer",
    );
    expect(step.disposition).toBe("accepted");
    expect(step.session.status).toBe("awaiting-delivery");
    expect(step.nextRevision).toBeNull();
  });

  it("automatically prepares a targeted next revision for a broken frame", () => {
    const bad = evidence();
    const targetId = order.framePlan![4]!.frameId;
    const step = advanceAdventureCreativeSessionFromEvidenceV3(
      submitted(),
      {
        ...bad,
        sequence: {
          ...bad.sequence!,
          frames: bad.sequence!.frames.map((frame) =>
            frame.frameId === targetId
              ? { ...frame, silhouetteConformant: false }
              : frame,
          ),
        },
      },
      "sha256:reviewer",
    );
    expect(step.disposition).toBe("repair-required");
    expect(step.session.status).toBe("awaiting-candidate");
    expect(step.nextRevision).toBe(2);
    const repair = step.session.revisions.at(-1)!.workOrder.requestedRepairs[0]!;
    expect(repair.targetFrameIds).toEqual([targetId]);
    expect(repair.preserveFrameIds).toHaveLength(order.framePlan!.length - 1);
    expect(repair.allowRegenerateWholeAsset).toBe(false);
  });
});
