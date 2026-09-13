import { describe, expect, it } from "vitest";
import {
  nightShiftProductionManifest,
  nightShiftProductionManifestFileName,
  nightShiftProductionManifestJson,
} from "../src/night-shift-production-manifest.js";
import {
  nightShiftPeriodVgaProductionAssetIds,
  nightShiftProductionAssets,
} from "../src/night-shift-production-assets.js";
import { nightShiftProductionWaves } from "../src/night-shift-production-waves.js";
import { nightShiftRuntimeIndexedAssetIds } from "../src/night-shift-runtime-index-requirements.js";

describe("Night Shift production manifest", () => {
  it("encodes the early procedural VGA lane and complete proof contract", () => {
    expect(nightShiftProductionManifest).toMatchObject({
      manifestVersion: 1,
      productionProfileId: "early-procedural-icon-vga",
      referenceLane: "police-quest-i-vga-remake",
      nativeCanvas: { width: 320, height: 200 },
      proof: {
        scenes: [
          "scene.night-shift.station",
          "scene.night-shift.roadside",
          "scene.night-shift.diner",
        ],
        successScore: 32,
        minimumNativeScreenshots: 6,
      },
    });
  });

  it("contains every production asset and separates Period VGA masters from runtime index maps", () => {
    expect(nightShiftProductionManifest.assets).toHaveLength(nightShiftProductionAssets.length);
    expect(nightShiftProductionManifest.evidencePolicy.runtimeIndexedAssetIds).toEqual(
      nightShiftRuntimeIndexedAssetIds,
    );
    expect(nightShiftProductionManifest.evidencePolicy.periodVgaAssetIds).toEqual(
      nightShiftPeriodVgaProductionAssetIds,
    );
    expect(nightShiftProductionManifest.evidencePolicy.runtimeIndexedAssetIds).not.toContain(
      "asset.night-shift.font.system",
    );
    expect(nightShiftProductionManifest.evidencePolicy.runtimeIndexedAssetIds).not.toContain(
      "asset.night-shift.ui.walk",
    );
  });

  it("embeds the ordered Foundation, Station, Roadside and Diner build waves", () => {
    expect(nightShiftProductionManifest.waves.map((wave) => wave.id)).toEqual(
      nightShiftProductionWaves.map((wave) => wave.id),
    );
    expect(nightShiftProductionManifest.waves.flatMap((wave) => wave.assetIds)).toHaveLength(
      nightShiftProductionAssets.length,
    );
    expect(nightShiftProductionManifest.waves.find((wave) => wave.id === "station")?.dependsOn).toEqual([
      "foundation",
    ]);
  });

  it("serialises deterministically with a stable filename", () => {
    const first = nightShiftProductionManifestJson();
    const second = nightShiftProductionManifestJson();
    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    expect(JSON.parse(first).projectId).toBe(nightShiftProductionManifest.projectId);
    expect(nightShiftProductionManifestFileName).toBe("night-shift.production-manifest.json");
  });
});
