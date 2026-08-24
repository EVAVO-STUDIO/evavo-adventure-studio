import { describe, expect, it } from "vitest";
import { evaluateNightShiftStationMediaPreflight } from "../src/night-shift-station-media-preflight.js";

describe("Night Shift Station media preflight", () => {
  it("separates station visual, foreground, audio and runtime-index work", () => {
    const report = evaluateNightShiftStationMediaPreflight();
    expect(report.stationAssetIds).toHaveLength(13);
    expect(report.visualMasterIds).toEqual(
      expect.arrayContaining([
        "asset.night-shift.background.station",
        "asset.night-shift.actor.sergeant",
        "asset.night-shift.object.radio",
        "asset.night-shift.object.keys",
        "asset.night-shift.object.door",
        "asset.night-shift.object.briefing",
        "asset.night-shift.foreground.desk",
        "asset.night-shift.foreground.door-frame",
      ]),
    );
    expect(report.foregroundPlateIds).toEqual([
      "asset.night-shift.foreground.desk",
      "asset.night-shift.foreground.door-frame",
    ]);
    expect(report.audioMasterIds).toHaveLength(5);
    expect(report.runtimeIndexedAssetIds).toEqual(
      expect.arrayContaining([
        "asset.night-shift.background.station",
        "asset.night-shift.actor.sergeant",
        "asset.night-shift.object.radio",
        "asset.night-shift.object.keys",
        "asset.night-shift.object.door",
        "asset.night-shift.object.briefing",
      ]),
    );
    expect(report.runtimeIndexedAssetIds).not.toContain("asset.night-shift.foreground.desk");
  });

  it("allows Station media authoring in parallel while keeping acceptance dependent on Foundation", () => {
    const report = evaluateNightShiftStationMediaPreflight();
    expect(report.canAuthorStationMediaInParallel).toBe(true);
    expect(report.stationAcceptanceDependsOnFoundation).toBe(true);
    expect(report.foundation.remainingAuthoredMasterIds).toEqual([
      "asset.night-shift.actor.officer",
    ]);
  });
});
