import { describe, expect, it } from "vitest";
import { evaluateNightShiftProductionProgress } from "../src/night-shift-production-progress.js";
import { nightShiftProductionWaves } from "../src/night-shift-production-waves.js";

describe("Night Shift production progress", () => {
  it("starts with Foundation as the next production wave", () => {
    const progress = evaluateNightShiftProductionProgress(new Set());
    expect(progress.complete).toBe(false);
    expect(progress.nextWave?.id).toBe("foundation");
    expect(progress.completedAssets).toBe(0);
  });

  it("advances to Station only after every Foundation asset is complete", () => {
    const foundation = nightShiftProductionWaves[0]!;
    const progress = evaluateNightShiftProductionProgress(new Set(foundation.assetIds));
    expect(progress.waves.find((wave) => wave.id === "foundation")?.ready).toBe(true);
    expect(progress.nextWave?.id).toBe("station");
  });

  it("does not mark Roadside ready when its files exist but upstream waves are incomplete", () => {
    const roadside = nightShiftProductionWaves.find((wave) => wave.id === "roadside")!;
    const progress = evaluateNightShiftProductionProgress(new Set(roadside.assetIds));
    const roadsideProgress = progress.waves.find((wave) => wave.id === "roadside")!;
    expect(roadsideProgress.ready).toBe(false);
    expect(roadsideProgress.missingAssetIds).toEqual([]);
    expect(roadsideProgress.blockedBy).toEqual(["foundation", "station"]);
    expect(progress.nextWave?.id).toBe("foundation");
  });

  it("reports the proof complete only when all wave assets are complete", () => {
    const all = new Set(nightShiftProductionWaves.flatMap((wave) => wave.assetIds));
    const progress = evaluateNightShiftProductionProgress(all);
    expect(progress.complete).toBe(true);
    expect(progress.nextWave).toBeNull();
    expect(progress.waves.every((wave) => wave.ready)).toBe(true);
  });
});
