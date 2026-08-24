import { describe, expect, it } from "vitest";
import { nightShiftProductionWaves } from "../src/night-shift-production-waves.js";
import { evaluateNightShiftStationSliceReadiness } from "../src/night-shift-station-slice-readiness.js";

describe("Night Shift station vertical slice readiness", () => {
  it("is authored-ready but evidence-blocked before final Foundation/Station media exists", () => {
    const report = evaluateNightShiftStationSliceReadiness();
    expect(report.authoredReady).toBe(true);
    expect(report.shippableReady).toBe(false);
    expect(report.gates.find((gate) => gate.id === "authored-source")?.ready).toBe(true);
    expect(report.gates.find((gate) => gate.id === "station-art-intake")?.ready).toBe(false);
    expect(report.gates.find((gate) => gate.id === "station-package")?.ready).toBe(false);
  });

  it("uses exactly the Foundation and Station production-wave asset set", () => {
    const expected = nightShiftProductionWaves
      .filter((wave) => wave.id === "foundation" || wave.id === "station")
      .flatMap((wave) => wave.assetIds);
    const report = evaluateNightShiftStationSliceReadiness();
    expect(report.expectedAssetIds).toEqual(expected);
    expect(report.missingCompiledAssetIds).toEqual(expected);
  });

  it("does not require foreground plates to have runtime index maps", () => {
    const report = evaluateNightShiftStationSliceReadiness();
    expect(report.missingIndexedAssetIds).not.toContain("asset.night-shift.foreground.desk");
    expect(report.missingIndexedAssetIds).not.toContain("asset.night-shift.foreground.door-frame");
    expect(report.missingIndexedAssetIds).toContain("asset.night-shift.background.station");
    expect(report.missingIndexedAssetIds).toContain("asset.night-shift.actor.officer");
    expect(report.missingIndexedAssetIds).toContain("asset.night-shift.font.system");
  });

  it("does not accept a clean but incomplete art intake report", () => {
    const report = evaluateNightShiftStationSliceReadiness({
      artMasterIntake: {
        status: "blocked",
        expectedMasters: 20,
        observedMasters: 1,
        missingAssetIds: ["asset.night-shift.background.station" as never],
        issues: [],
      },
    });
    expect(report.gates.find((gate) => gate.id === "station-art-intake")?.ready).toBe(false);
  });
});
