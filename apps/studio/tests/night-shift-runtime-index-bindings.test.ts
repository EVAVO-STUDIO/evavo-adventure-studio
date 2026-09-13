import { describe, expect, it } from "vitest";
import {
  nightShiftRuntimeIndexBindingForAsset,
  nightShiftRuntimeIndexBindings,
  validateNightShiftRuntimeIndexBindings,
} from "../src/night-shift-runtime-index-bindings.js";
import { nightShiftRuntimeIndexedAssetIds } from "../src/night-shift-runtime-index-requirements.js";

describe("Night Shift runtime index palette bindings", () => {
  it("covers every required scene index asset exactly once", () => {
    expect(validateNightShiftRuntimeIndexBindings()).toEqual([]);
    expect(nightShiftRuntimeIndexBindings).toHaveLength(nightShiftRuntimeIndexedAssetIds.length);
    expect(new Set(nightShiftRuntimeIndexBindings.map((entry) => entry.assetId)).size).toBe(
      nightShiftRuntimeIndexedAssetIds.length,
    );
  });

  it("keeps actors on the neutral actor-lighting palette", () => {
    for (const actorId of [
      "asset.night-shift.actor.officer",
      "asset.night-shift.actor.sergeant",
      "asset.night-shift.actor.driver",
      "asset.night-shift.actor.server",
    ]) {
      expect(nightShiftRuntimeIndexBindingForAsset(actorId)).toMatchObject({
        paletteAssetId: "asset.palette.night-shift.actor-lighting",
        paletteOffset: 0,
      });
    }
  });

  it("binds each room background and practical prop to its room palette", () => {
    expect(nightShiftRuntimeIndexBindingForAsset("asset.night-shift.background.station")?.paletteAssetId).toBe(
      "asset.palette.night-shift.station",
    );
    expect(nightShiftRuntimeIndexBindingForAsset("asset.night-shift.object.radio")?.paletteAssetId).toBe(
      "asset.palette.night-shift.station",
    );
    expect(nightShiftRuntimeIndexBindingForAsset("asset.night-shift.background.roadside")?.paletteAssetId).toBe(
      "asset.palette.night-shift.roadside",
    );
    expect(nightShiftRuntimeIndexBindingForAsset("asset.night-shift.object.sedan")?.paletteAssetId).toBe(
      "asset.palette.night-shift.roadside",
    );
    expect(nightShiftRuntimeIndexBindingForAsset("asset.night-shift.background.diner")?.paletteAssetId).toBe(
      "asset.palette.night-shift.diner",
    );
    expect(nightShiftRuntimeIndexBindingForAsset("asset.night-shift.object.receipt")?.paletteAssetId).toBe(
      "asset.palette.night-shift.diner",
    );
  });
});
