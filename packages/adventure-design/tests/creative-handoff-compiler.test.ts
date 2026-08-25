import { describe, expect, it } from "vitest";
import {
  compileAnimationAdventureCreativeWorkOrder,
  compileStaticAdventureCreativeWorkOrder,
} from "../src/creative-handoff-compiler.js";
import { adventureProductionProfiles } from "../src/production-profile-presets.js";
import {
  compileNinthReliquaryCreativeProofWorkOrders,
  ninthReliquaryMaraActor,
} from "../src/ninth-reliquary-creative-proof.js";

const profile = adventureProductionProfiles.find(
  (candidate) => candidate.id === "cinematic-handdrawn-conspiracy",
)!;

const authority = {
  sourceRevisionDigest: "sha256:source-proof",
  styleDigest: "sha256:style-proof",
  paletteDigest: "sha256:palette-proof",
  environmentLayoutDigest: "sha256:layout-proof",
  modelSheetDigest: "sha256:model-proof",
  xSheetDigest: "sha256:xsheet-proof",
  referenceDigests: ["sha256:ref-b", "sha256:ref-a", "sha256:ref-a"],
};

describe("Adventure creative handoff compiler", () => {
  it("routes the Ninth Reliquary background to Art Studio", () => {
    const proof = compileNinthReliquaryCreativeProofWorkOrders(authority);
    expect(proof.background).toMatchObject({
      contractVersion: 2,
      destinationStudio: "art-studio",
      taskKind: "background",
      nativeSize: { width: 640, height: 360 },
      alphaPolicy: "opaque",
      style: {
        profileId: "cinematic-handdrawn-conspiracy",
        styleDigest: "sha256:style-proof",
        environmentLayoutDigest: "sha256:layout-proof",
        referenceDigests: ["sha256:ref-a", "sha256:ref-b"],
      },
    });
    expect(proof.background.rejectionRules.join(" ")).toMatch(/generic anime|checkerboard|signage/iu);
  });

  it("derives the exact eight-frame walk contract from runtime actor frames", () => {
    const proof = compileNinthReliquaryCreativeProofWorkOrders(authority);
    const order = proof.maraWalkEast;
    expect(order.destinationStudio).toBe("cel-animation-studio");
    expect(order.taskKind).toBe("animation-sequence");
    expect(order.framePlan).toHaveLength(8);
    expect(order.framePlan?.map((frame) => frame.frameId)).toEqual(
      ninthReliquaryMaraActor.animations[0]?.frameIds,
    );
    expect(order.framePlan?.map((frame) => frame.exposureTicks)).toEqual(new Array(8).fill(3));
    expect(order.framePlan?.[0]).toMatchObject({
      role: "contact",
      sourceRect: { x: 0, y: 0, width: 32, height: 64 },
      pivot: { x: 16, y: 62 },
      footPoint: { x: 16, y: 62 },
      shadowAnchor: { x: 16, y: 61 },
      handAnchor: { x: 21, y: 37 },
    });
    expect(order.framePlan?.[0]?.requiredNeighbourFrameIds).toEqual([
      "frame.ninth-reliquary.mara.walk-east.02",
      "frame.ninth-reliquary.mara.walk-east.08",
    ]);
    expect(order.framePlan?.[7]?.requiredNeighbourFrameIds).toEqual([
      "frame.ninth-reliquary.mara.walk-east.01",
      "frame.ninth-reliquary.mara.walk-east.07",
    ]);
    expect(order.sequencePolicy).toMatchObject({
      independentFrameGenerationForbidden: true,
      neighbourConditioningRequired: true,
      modelSheetConformanceRequired: true,
      xSheetDigest: "sha256:xsheet-proof",
      xSheetConformanceRequired: true,
      loopClosureReviewRequired: true,
      exactExposureTimingRequired: true,
    });
  });

  it("builds static and animation orders through the same production profile", () => {
    const staticOrder = compileStaticAdventureCreativeWorkOrder({
      workOrderId: "creative.test.foreground.r1",
      projectId: "project.test",
      assetId: "asset.test.foreground",
      taskKind: "foreground-plate",
      revision: 1,
      nativeSize: { width: 200, height: 120 },
      alphaPolicy: "required",
      profile,
      authority,
    });
    const animationOrder = compileAnimationAdventureCreativeWorkOrder({
      workOrderId: "creative.test.walk.r1",
      projectId: "project.test",
      assetId: "asset.ninth-reliquary.mara.walk-east",
      revision: 1,
      nativeSize: { width: 256, height: 64 },
      alphaPolicy: "required",
      profile,
      actor: ninthReliquaryMaraActor,
      animationClipId: "animation.ninth-reliquary.mara.walk-east" as never,
      authority,
    });
    expect(staticOrder.style.profileId).toBe(animationOrder.style.profileId);
    expect(staticOrder.destinationStudio).toBe("art-studio");
    expect(animationOrder.destinationStudio).toBe("cel-animation-studio");
  });
});
