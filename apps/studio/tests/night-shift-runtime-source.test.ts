import { describe, expect, it } from "vitest";
import {
  nightShiftRuntimeSource,
  nightShiftRuntimeSourceSummary,
  validateNightShiftRuntimeSource,
} from "../src/night-shift-runtime-source.js";

describe("Night Shift reproducible runtime source", () => {
  it("validates the complete authored source package as one coherent project", () => {
    expect(validateNightShiftRuntimeSource()).toEqual([]);
    expect(nightShiftRuntimeSource.project.id).toBe("project.night-shift-director");
    expect(nightShiftRuntimeSource.sceneInstances.projectId).toBe(nightShiftRuntimeSource.project.id);
    expect(nightShiftRuntimeSource.sceneStaging.projectId).toBe(nightShiftRuntimeSource.project.id);
    expect(nightShiftRuntimeSource.paletteMaps.projectId).toBe(nightShiftRuntimeSource.project.id);
    expect(nightShiftRuntimeSource.bitmapFonts.projectId).toBe(nightShiftRuntimeSource.project.id);
    expect(nightShiftRuntimeSource.uiSkins.projectId).toBe(nightShiftRuntimeSource.project.id);
    expect(nightShiftRuntimeSource.audioMix.projectId).toBe(nightShiftRuntimeSource.project.id);
    expect(nightShiftRuntimeSource.frontEnd.projectId).toBe(nightShiftRuntimeSource.project.id);
    expect(nightShiftRuntimeSource.lifecycle.projectId).toBe(nightShiftRuntimeSource.project.id);
  });

  it("summarises one three-room source with complete production contracts", () => {
    expect(nightShiftRuntimeSourceSummary).toMatchObject({
      scenes: 3,
      actors: 4,
      paletteMaps: 3,
      bitmapFonts: 1,
      uiSkins: 1,
      lifecycleOutcomes: 2,
    });
    expect(nightShiftRuntimeSourceSummary.runtimeAssets).toBe(
      nightShiftRuntimeSourceSummary.productionAssets,
    );
    expect(nightShiftRuntimeSourceSummary.audioCues).toBeGreaterThanOrEqual(11);
  });
});
