import { describe, expect, it } from "vitest";
import {
  nightShiftAssetRequiresRuntimeIndexMap,
  nightShiftPaletteIndexedMasterAssetIds,
  nightShiftRuntimeIndexedAssetIds,
} from "../src/night-shift-runtime-index-requirements.js";

describe("Night Shift runtime index-map requirements", () => {
  it("requires exactly the scene-rendered backgrounds, actors and props", () => {
    expect(nightShiftRuntimeIndexedAssetIds).toHaveLength(13);
    expect(nightShiftRuntimeIndexedAssetIds).toEqual(
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
      ]),
    );
  });

  it("keeps native indexed UI/font masters out of the scene palette-remap sidecar", () => {
    for (const assetId of [
      "asset.night-shift.font.system",
      "asset.night-shift.ui.walk",
      "asset.night-shift.ui.look",
      "asset.night-shift.ui.use",
      "asset.night-shift.ui.talk",
      "asset.night-shift.foreground.desk",
      "asset.night-shift.foreground.door-frame",
      "asset.night-shift.foreground.sedan",
      "asset.night-shift.foreground.counter",
    ]) {
      expect(nightShiftAssetRequiresRuntimeIndexMap(assetId)).toBe(false);
    }
  });

  it("still treats font and icons as Period VGA visual masters", () => {
    expect(nightShiftPaletteIndexedMasterAssetIds).toEqual(
      expect.arrayContaining([
        "asset.night-shift.font.system",
        "asset.night-shift.ui.walk",
        "asset.night-shift.ui.look",
        "asset.night-shift.ui.use",
        "asset.night-shift.ui.talk",
      ]),
    );
  });
});
