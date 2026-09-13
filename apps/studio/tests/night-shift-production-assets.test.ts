import { describe, expect, it } from "vitest";
import {
  nightShiftIndexedProductionAssetIds,
  nightShiftPeriodVgaProductionAssetIds,
  nightShiftProductionAssets,
  validateNightShiftProductionAssetPlan,
} from "../src/night-shift-production-assets.js";
import { nightShiftRuntimeProject } from "../src/night-shift-runtime-contracts.js";

describe("Night Shift production asset plan", () => {
  it("covers every runtime project asset exactly once", () => {
    expect(validateNightShiftProductionAssetPlan()).toEqual([]);
    expect(new Set(nightShiftProductionAssets.map((asset) => asset.assetId)).size).toBe(
      nightShiftProductionAssets.length,
    );
    expect(new Set(nightShiftProductionAssets.map((asset) => asset.assetId))).toEqual(
      new Set(nightShiftRuntimeProject.assets.map((asset) => asset.id)),
    );
  });

  it("locks exact native dimensions for backgrounds, officer strip, font and icons", () => {
    const byId = new Map(nightShiftProductionAssets.map((asset) => [asset.assetId, asset] as const));
    expect(byId.get("asset.night-shift.background.station")?.nativeSize).toEqual({ width: 320, height: 200 });
    expect(byId.get("asset.night-shift.background.roadside")?.nativeSize).toEqual({ width: 320, height: 200 });
    expect(byId.get("asset.night-shift.background.diner")?.nativeSize).toEqual({ width: 320, height: 200 });
    expect(byId.get("asset.night-shift.actor.officer")?.nativeSize).toEqual({ width: 264, height: 50 });
    expect(byId.get("asset.night-shift.font.system")?.nativeSize).toEqual({ width: 96, height: 48 });
    for (const verb of ["walk", "look", "use", "talk"]) {
      expect(byId.get(`asset.night-shift.ui.${verb}`)?.nativeSize).toEqual({ width: 16, height: 16 });
    }
  });

  it("marks every final native indexed visual master without conflating that with runtime .idx remapping", () => {
    expect(nightShiftIndexedProductionAssetIds).toEqual(
      expect.arrayContaining([
        "asset.night-shift.background.station",
        "asset.night-shift.background.roadside",
        "asset.night-shift.background.diner",
        "asset.night-shift.actor.officer",
        "asset.night-shift.actor.sergeant",
        "asset.night-shift.actor.driver",
        "asset.night-shift.actor.server",
        "asset.night-shift.object.radio",
        "asset.night-shift.object.keys",
        "asset.night-shift.object.door",
        "asset.night-shift.object.sedan",
        "asset.night-shift.object.briefing",
        "asset.night-shift.object.receipt",
        "asset.night-shift.font.system",
        "asset.night-shift.ui.walk",
        "asset.night-shift.ui.look",
        "asset.night-shift.ui.use",
        "asset.night-shift.ui.talk",
      ]),
    );
    expect(nightShiftIndexedProductionAssetIds).not.toContain("asset.night-shift.foreground.desk");
  });

  it("requires explicit palette production assets for actor lighting and all three rooms", () => {
    const paletteIds = nightShiftProductionAssets
      .filter((asset) => asset.role === "palette")
      .map((asset) => asset.assetId);
    expect(paletteIds).toEqual([
      "asset.palette.night-shift.actor-lighting",
      "asset.palette.night-shift.station",
      "asset.palette.night-shift.roadside",
      "asset.palette.night-shift.diner",
    ]);
  });

  it("requires Period VGA review for all authored final pixel masters but not audio/palette binaries", () => {
    expect(nightShiftPeriodVgaProductionAssetIds).toEqual(
      expect.arrayContaining([
        "asset.night-shift.background.station",
        "asset.night-shift.actor.officer",
        "asset.night-shift.foreground.counter",
        "asset.night-shift.font.system",
        "asset.night-shift.ui.walk",
      ]),
    );
    expect(nightShiftPeriodVgaProductionAssetIds).not.toContain("asset.palette.night-shift.actor-lighting");
    expect(nightShiftPeriodVgaProductionAssetIds).not.toContain("asset.palette.night-shift.station");
    expect(nightShiftPeriodVgaProductionAssetIds).not.toContain("asset.audio.night-shift.roadside-rain");
  });
});
