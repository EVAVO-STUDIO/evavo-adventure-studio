import { describe, expect, it } from "vitest";
import {
  nightShiftRuntimeIndexBuildPlan,
  nightShiftStationRuntimeIndexBuildPlan,
  validateNightShiftRuntimeIndexBuildPlan,
} from "../src/night-shift-runtime-index-build-plan.js";

describe("Night Shift runtime index build plan", () => {
  it("covers all 13 scene runtime index assets with unique runtime paths", () => {
    expect(validateNightShiftRuntimeIndexBuildPlan()).toEqual([]);
    expect(nightShiftRuntimeIndexBuildPlan).toHaveLength(13);
    expect(new Set(nightShiftRuntimeIndexBuildPlan.map((entry) => entry.runtimePath)).size).toBe(13);
  });

  it("produces exactly seven Foundation plus Station runtime index records", () => {
    expect(nightShiftStationRuntimeIndexBuildPlan.map((entry) => entry.assetId)).toEqual(
      expect.arrayContaining([
        "asset.night-shift.actor.officer",
        "asset.night-shift.background.station",
        "asset.night-shift.actor.sergeant",
        "asset.night-shift.object.radio",
        "asset.night-shift.object.keys",
        "asset.night-shift.object.door",
        "asset.night-shift.object.briefing",
      ]),
    );
    expect(nightShiftStationRuntimeIndexBuildPlan).toHaveLength(7);
  });

  it("keeps the officer as a single-page 264x50 indexed spritesheet with all twelve frame records", () => {
    const officer = nightShiftRuntimeIndexBuildPlan.find(
      (entry) => entry.assetId === "asset.night-shift.actor.officer",
    );
    expect(officer).toMatchObject({
      assetKind: "spritesheet",
      width: 264,
      height: 50,
      transparentIndex: 0,
      defaultPalette: {
        paletteAssetId: "asset.palette.night-shift.actor-lighting",
        paletteOffset: 0,
      },
    });
    expect(officer?.frames).toHaveLength(12);
    expect(officer?.frames[0]).toMatchObject({
      sourceRect: { x: 0, y: 0, width: 20, height: 46 },
      originalSize: { width: 24, height: 50 },
      trimOffset: { x: 2, y: 3 },
    });
  });

  it("binds Station room/object index maps to the Station palette", () => {
    for (const assetId of [
      "asset.night-shift.background.station",
      "asset.night-shift.object.radio",
      "asset.night-shift.object.keys",
      "asset.night-shift.object.door",
      "asset.night-shift.object.briefing",
    ]) {
      expect(
        nightShiftRuntimeIndexBuildPlan.find((entry) => entry.assetId === assetId)?.defaultPalette.paletteAssetId,
      ).toBe("asset.palette.night-shift.station");
    }
  });
});
