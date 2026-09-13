import { describe, expect, it } from "vitest";
import {
  nightShiftScenePaletteSourceBackground,
  validateNightShiftScenePalette,
} from "../src/night-shift-scene-palette-intake.js";

describe("Night Shift scene palette intake", () => {
  it("accepts a palette locked from the matching approved room background", () => {
    expect(
      validateNightShiftScenePalette({
        assetId: "asset.palette.night-shift.station" as never,
        sourceFormat: "palette",
        derivedFromAssetId: "asset.night-shift.background.station" as never,
        entryCount: 192,
        rgbaByteLength: 768,
        opaqueEntries: true,
      }),
    ).toEqual([]);
  });

  it("rejects a palette detached from its room master or malformed RGBA table", () => {
    const issues = validateNightShiftScenePalette({
      assetId: "asset.palette.night-shift.station" as never,
      sourceFormat: "other",
      derivedFromAssetId: "asset.night-shift.background.roadside" as never,
      entryCount: 300,
      rgbaByteLength: 100,
      opaqueEntries: false,
    });
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "source-format-mismatch",
        "background-mismatch",
        "entry-count-invalid",
        "byte-length-mismatch",
        "non-opaque-entry",
      ]),
    );
  });

  it("keeps each scene palette bound to its canonical background", () => {
    expect(nightShiftScenePaletteSourceBackground("asset.palette.night-shift.station")).toBe(
      "asset.night-shift.background.station",
    );
    expect(nightShiftScenePaletteSourceBackground("asset.palette.night-shift.roadside")).toBe(
      "asset.night-shift.background.roadside",
    );
    expect(nightShiftScenePaletteSourceBackground("asset.palette.night-shift.diner")).toBe(
      "asset.night-shift.background.diner",
    );
  });
});
