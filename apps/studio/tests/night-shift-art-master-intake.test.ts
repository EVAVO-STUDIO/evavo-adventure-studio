import { describe, expect, it } from "vitest";
import {
  evaluateNightShiftArtMasterIntake,
  type NightShiftArtMasterObservation,
  validateNightShiftArtMaster,
} from "../src/night-shift-art-master-intake.js";
import { nightShiftPeriodVgaProductionAssetIds } from "../src/night-shift-production-assets.js";

const observation = (
  assetId: string,
  overrides: Partial<NightShiftArtMasterObservation> = {},
): NightShiftArtMasterObservation => ({
  assetId: assetId as never,
  width: 320,
  height: 200,
  paletteIndexed: true,
  colourCount: 96,
  alphaMode: "opaque",
  sourceFormat: "png",
  ...overrides,
});

describe("Night Shift art master intake", () => {
  it("accepts an exact native indexed background master", () => {
    expect(
      validateNightShiftArtMaster(observation("asset.night-shift.background.station")),
    ).toEqual([]);
  });

  it("rejects wrong native dimensions, true-colour output and soft alpha", () => {
    const issues = validateNightShiftArtMaster(
      observation("asset.night-shift.background.station", {
        width: 640,
        height: 400,
        paletteIndexed: false,
        colourCount: 512,
        alphaMode: "full",
      }),
    );
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "exact-size-mismatch",
        "non-indexed-colour",
        "colour-budget-exceeded",
        "soft-alpha",
        "opaque-required",
      ]),
    );
  });

  it("enforces Aseprite source identity and binary alpha for the officer master", () => {
    const issues = validateNightShiftArtMaster(
      observation("asset.night-shift.actor.officer", {
        width: 264,
        height: 50,
        alphaMode: "opaque",
        sourceFormat: "png",
      }),
    );
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["binary-alpha-required", "source-format-mismatch"]),
    );
  });

  it("rejects oversized art-directed foreground plates", () => {
    const issues = validateNightShiftArtMaster(
      observation("asset.night-shift.foreground.counter", {
        width: 400,
        height: 220,
        alphaMode: "binary",
      }),
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "oversized-art-directed-master" }),
      ]),
    );
  });

  it("blocks a proof intake until every required Period VGA master has been observed", () => {
    const report = evaluateNightShiftArtMasterIntake([
      observation("asset.night-shift.background.station"),
    ]);
    expect(report.status).toBe("blocked");
    expect(report.expectedMasters).toBe(nightShiftPeriodVgaProductionAssetIds.length);
    expect(report.missingAssetIds).toContain("asset.night-shift.background.roadside");
  });
});
