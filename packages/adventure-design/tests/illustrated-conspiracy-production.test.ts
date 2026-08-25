import { describe, expect, it } from "vitest";
import {
  createNinthReliquaryProductionPlan,
  ninthReliquaryAssetSpecs,
} from "../src/illustrated-conspiracy-production.js";
import { validateAdventureCreativeWorkOrderV3 } from "../src/creative-production-handoff-v3.js";

const authorities = Object.fromEntries(
  ninthReliquaryAssetSpecs.map((spec) => [
    spec.assetId,
    {
      sourceRevisionDigest: `sha256:source:${spec.assetId}`,
      styleDigest: "sha256:style:ninth-reliquary",
      paletteDigest: "sha256:palette:ninth-reliquary",
      environmentLayoutDigest: "sha256:layout:old-city",
      modelSheetDigest: "sha256:model:mara",
      xSheetDigest: "sha256:xsheet:shared",
      referenceDigests: ["sha256:identity:mara", "sha256:environment:old-city"],
    },
  ]),
);

describe("The Ninth Reliquary production plan", () => {
  it("builds valid cross-studio work orders for the complete proof slice", () => {
    const plan = createNinthReliquaryProductionPlan(authorities);
    expect(plan).toHaveLength(ninthReliquaryAssetSpecs.length);
    expect(plan.flatMap((order) => validateAdventureCreativeWorkOrderV3(order))).toEqual([]);
    expect(new Set(plan.map((order) => order.destinationStudio))).toEqual(
      new Set(["art-studio", "cel-animation-studio"]),
    );
  });

  it("locks the walk cycle to eight neighbour-reviewed frames", () => {
    const plan = createNinthReliquaryProductionPlan(authorities);
    const walk = plan.find((order) => order.assetId === "asset.ninth-reliquary.mara.walk-east");
    expect(walk?.framePlan).toHaveLength(8);
    expect(walk?.sequencePolicy).toMatchObject({
      independentFrameGenerationForbidden: true,
      exactExposureTimingRequired: true,
      modelSheetConformanceRequired: true,
      xSheetConformanceRequired: true,
      immediateNeighbourReviewRequired: true,
      loopClosureReviewRequired: true,
    });
    expect(walk?.framePlan?.every((frame) => frame.requiredNeighbourFrameIds.length === 2)).toBe(true);
  });

  it("keeps foreground transparency and close-up identity governed separately", () => {
    const plan = createNinthReliquaryProductionPlan(authorities);
    const foreground = plan.find((order) => order.taskKind === "foreground-plate");
    const closeup = plan.find((order) => order.taskKind === "portrait-closeup");
    expect(foreground).toMatchObject({
      destinationStudio: "art-studio",
      alphaPolicy: "required",
      transparencyPolicy: {
        checkerboardForbidden: true,
        decodedAlphaRequired: true,
        hostilePlateReviewRequired: true,
      },
    });
    expect(closeup?.authorities.modelSheetDigest).toBe("sha256:model:mara");
  });

  it("fails when one asset has no immutable production authority", () => {
    const incomplete = { ...authorities };
    delete incomplete["asset.ninth-reliquary.mara.walk-east"];
    expect(() => createNinthReliquaryProductionPlan(incomplete)).toThrow(/Missing production authority/u);
  });
});
