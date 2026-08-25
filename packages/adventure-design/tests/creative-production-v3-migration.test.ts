import { describe, expect, it } from "vitest";
import { validateAdventureCreativeWorkOrderV3 } from "../src/creative-production-handoff-v3.js";
import { migrateAdventureCreativePlanV1ToV3 } from "../src/creative-production-v3-migration.js";
import {
  createNinthReliquaryCreativeWorkOrders,
  type NinthReliquaryCreativeAuthorities,
} from "../src/ninth-reliquary-creative-production.js";

const authorities: NinthReliquaryCreativeAuthorities = {
  projectId: "project.ninth-reliquary" as never,
  sourceRevisionDigest: "sha256:source-v1",
  visualStandardDigest: "sha256:visual-standard-v1",
  styleBankDigest: "sha256:style-bank-v1",
  protagonistModelSheetDigest: "sha256:model-sheet-v1",
  protagonistWalkXSheetDigest: "sha256:x-sheet-v1",
  environmentalReferenceDigests: ["sha256:env-a", "sha256:env-b"],
  characterReferenceDigests: ["sha256:char-a", "sha256:char-b"],
};

describe("creative production v1 to v3 migration", () => {
  it("migrates the legacy Ninth Reliquary production set without losing authored directions", () => {
    const legacy = createNinthReliquaryCreativeWorkOrders(authorities);
    const migrated = migrateAdventureCreativePlanV1ToV3(legacy, {
      profileId: "cinematic-handdrawn-conspiracy",
      environmentLayoutDigest: "sha256:old-city-layout",
    });
    expect(migrated).toHaveLength(legacy.length);
    expect(migrated.flatMap((order) => validateAdventureCreativeWorkOrderV3(order))).toEqual([]);
    expect(migrated.map((order) => order.taskKind)).toEqual([
      "background-paint",
      "foreground-plate",
      "character-model-sheet",
      "animation-sequence",
    ]);
    expect(migrated[0]?.artDirection).toEqual(legacy[0]?.artDirection);
  });

  it("turns the legacy ten-drawing walk into a neighbour-aware v3 frame plan", () => {
    const migrated = migrateAdventureCreativePlanV1ToV3(
      createNinthReliquaryCreativeWorkOrders(authorities),
      { profileId: "cinematic-handdrawn-conspiracy" },
    );
    const walk = migrated.find((order) => order.taskKind === "animation-sequence");
    expect(walk?.framePlan).toHaveLength(10);
    expect(walk?.framePlan?.[0]).toMatchObject({
      frameId: "walk-east.01",
      exposureTicks: 3,
      sourceRect: { x: 0, y: 0, width: 96, height: 192 },
      handAnchors: { primary: { x: 56, y: 88 } },
      requiredNeighbourFrameIds: ["walk-east.10", "walk-east.02"],
    });
    expect(walk?.sequencePolicy).toMatchObject({
      independentFrameGenerationForbidden: true,
      exactExposureTimingRequired: true,
      modelSheetConformanceRequired: true,
      xSheetConformanceRequired: true,
      immediateNeighbourReviewRequired: true,
      loopClosureReviewRequired: true,
    });
  });

  it("refuses to invent missing animation authorities during migration", () => {
    const legacy = createNinthReliquaryCreativeWorkOrders(authorities);
    const walk = legacy.find((order) => order.taskKind === "animation-sequence")!;
    expect(() =>
      migrateAdventureCreativePlanV1ToV3(
        [{ ...walk, xSheetDigest: undefined }],
        { profileId: "cinematic-handdrawn-conspiracy" },
      ),
    ).toThrow(/X-sheet authority/u);
  });
});
