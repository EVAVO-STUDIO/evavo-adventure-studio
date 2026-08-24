import { describe, expect, it } from "vitest";
import { evaluateNightShiftFoundationPreflight } from "../src/night-shift-foundation-preflight.js";

describe("Night Shift Foundation preflight", () => {
  it("reduces Foundation to one deliberately authored officer master", () => {
    const report = evaluateNightShiftFoundationPreflight();
    expect(report.foundationAssetIds).toHaveLength(7);
    expect(report.generatedTechnicalAssetIds).toHaveLength(6);
    expect(report.generatedVisualIntakeReady).toBe(true);
    expect(report.officerContractReady).toBe(true);
    expect(report.remainingAuthoredMasterIds).toEqual(["asset.night-shift.actor.officer"]);
    expect(report.readyForOfficerArt).toBe(true);
  });

  it("requires a runtime index map only for the officer within Foundation", () => {
    expect(evaluateNightShiftFoundationPreflight().foundationRuntimeIndexedAssetIds).toEqual([
      "asset.night-shift.actor.officer",
    ]);
  });
});
