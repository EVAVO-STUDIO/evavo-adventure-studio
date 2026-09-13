import { describe, expect, it } from "vitest";
import { nightShiftProductionAssets } from "../src/night-shift-production-assets.js";
import {
  nightShiftProductionWaveForAsset,
  nightShiftProductionWaves,
  validateNightShiftProductionWaves,
} from "../src/night-shift-production-waves.js";

describe("Night Shift production waves", () => {
  it("assigns every production asset exactly once", () => {
    expect(validateNightShiftProductionWaves()).toEqual([]);
    const assigned = nightShiftProductionWaves.flatMap((wave) => wave.assetIds);
    expect(assigned).toHaveLength(nightShiftProductionAssets.length);
    expect(new Set(assigned)).toEqual(new Set(nightShiftProductionAssets.map((asset) => asset.assetId)));
  });

  it("orders the shortest useful production path from shared foundation to full diner proof", () => {
    expect(nightShiftProductionWaves.map((wave) => wave.id)).toEqual([
      "foundation",
      "station",
      "roadside",
      "diner",
    ]);
    expect(nightShiftProductionWaves.find((wave) => wave.id === "station")?.dependsOn).toEqual([
      "foundation",
    ]);
    expect(nightShiftProductionWaves.find((wave) => wave.id === "roadside")?.dependsOn).toEqual([
      "foundation",
      "station",
    ]);
  });

  it("puts shared UI/palette/officer work in foundation and room-specific assets in their own waves", () => {
    expect(nightShiftProductionWaveForAsset("asset.night-shift.actor.officer")?.id).toBe("foundation");
    expect(nightShiftProductionWaveForAsset("asset.night-shift.ui.walk")?.id).toBe("foundation");
    expect(nightShiftProductionWaveForAsset("asset.night-shift.background.station")?.id).toBe("station");
    expect(nightShiftProductionWaveForAsset("asset.night-shift.background.roadside")?.id).toBe("roadside");
    expect(nightShiftProductionWaveForAsset("asset.night-shift.background.diner")?.id).toBe("diner");
  });

  it("keeps each wave tied to concrete play-quality acceptance rather than file completion alone", () => {
    for (const wave of nightShiftProductionWaves) {
      expect(wave.acceptance.length).toBeGreaterThanOrEqual(3);
      expect(wave.goal.length).toBeGreaterThan(40);
    }
    expect(nightShiftProductionWaves.find((wave) => wave.id === "roadside")?.acceptance.join(" ")).toMatch(
      /Bayer-4.*private pre-action retry/u,
    );
  });
});
