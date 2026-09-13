import { describe, expect, it } from "vitest";
import { createSceneDirectorOverlay, sceneDirectorModeSummary } from "../src/scene-director-model.js";
import { sceneDirectorSamples } from "../src/scene-director-samples.js";

describe("Scene Director sample palette bindings", () => {
  it("binds every displayed Red Ledger LIGHT zone to an authored palette asset", () => {
    const sample = sceneDirectorSamples.find((candidate) => candidate.id === "red-ledger");
    if (!sample) throw new Error("Red Ledger Director sample is missing.");
    const overlay = createSceneDirectorOverlay(
      sample.project,
      sample.sceneInstances,
      sample.staging,
      sample.project.startSceneId,
      sample.paletteMaps,
    );

    expect(overlay.lightZones.length).toBeGreaterThan(0);
    expect(overlay.lightZones.every((entry) => entry.bindingStatus === "bound")).toBe(true);
    expect(sceneDirectorModeSummary(overlay, "light").note).toContain("concrete palette bindings");
  });

  it("binds every displayed Night Shift LIGHT zone to an authored palette asset", () => {
    const sample = sceneDirectorSamples.find((candidate) => candidate.id === "night-shift");
    if (!sample) throw new Error("Night Shift Director sample is missing.");

    for (const scene of sample.project.scenes) {
      const overlay = createSceneDirectorOverlay(
        sample.project,
        sample.sceneInstances,
        sample.staging,
        scene.id,
        sample.paletteMaps,
      );
      expect(overlay.lightZones.every((entry) => entry.bindingStatus === "bound")).toBe(true);
    }
  });
});
