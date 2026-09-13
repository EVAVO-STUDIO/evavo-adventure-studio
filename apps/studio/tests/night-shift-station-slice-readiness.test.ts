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
    expect(report.gates.find((gate) => gate.id === "station-officer-review")?.ready).toBe(false);
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

  it("requires runtime index maps only for scene-rendered palette-remapped assets", () => {
    const report = evaluateNightShiftStationSliceReadiness();
    expect(report.missingIndexedAssetIds).not.toContain("asset.night-shift.foreground.desk");
    expect(report.missingIndexedAssetIds).not.toContain("asset.night-shift.foreground.door-frame");
    expect(report.missingIndexedAssetIds).not.toContain("asset.night-shift.font.system");
    expect(report.missingIndexedAssetIds).not.toContain("asset.night-shift.ui.walk");
    expect(report.missingIndexedAssetIds).not.toContain("asset.night-shift.ui.look");
    expect(report.missingIndexedAssetIds).not.toContain("asset.night-shift.ui.use");
    expect(report.missingIndexedAssetIds).not.toContain("asset.night-shift.ui.talk");
    expect(report.missingIndexedAssetIds).toContain("asset.night-shift.background.station");
    expect(report.missingIndexedAssetIds).toContain("asset.night-shift.actor.officer");
    expect(report.missingIndexedAssetIds).toContain("asset.night-shift.actor.sergeant");
    expect(report.missingIndexedAssetIds).toContain("asset.night-shift.object.radio");
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

  it("does not let a generic art intake substitute for the twelve-frame officer review", () => {
    const report = evaluateNightShiftStationSliceReadiness({
      officerMasterIntake: {
        status: "blocked",
        reviewedFrames: 11,
        requiredFrames: 12,
        issues: [
          {
            severity: "error",
            code: "missing-frame-review",
            frameId: "frame.night-shift.officer.notebook",
            message: "Missing retained notebook frame review.",
          },
        ],
      },
    });
    expect(report.gates.find((gate) => gate.id === "station-officer-review")?.ready).toBe(false);
  });
});
