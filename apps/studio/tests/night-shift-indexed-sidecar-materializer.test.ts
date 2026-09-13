import { describe, expect, it } from "vitest";
import {
  materializeNightShiftStationIndexedAssetManifest,
  type NightShiftCompiledIndexEvidence,
} from "../src/night-shift-indexed-sidecar-materializer.js";
import { nightShiftStationRuntimeIndexBuildPlan } from "../src/night-shift-runtime-index-build-plan.js";

const evidence = (): readonly NightShiftCompiledIndexEvidence[] =>
  nightShiftStationRuntimeIndexBuildPlan.map((entry, index) => ({
    assetId: entry.assetId,
    sha256: index.toString(16).padStart(64, "0"),
    byteLength: entry.width * entry.height,
    maximumSourceIndex: entry.assetId.includes("background") ? 127 : 31,
  }));

describe("Night Shift indexed sidecar materializer", () => {
  it("materializes the exact seven-record Station indexed manifest from measured evidence", () => {
    const manifest = materializeNightShiftStationIndexedAssetManifest(evidence());
    expect(manifest.projectId).toBe("project.night-shift-director");
    expect(manifest.assets).toHaveLength(7);
    expect(manifest.assets.find((entry) => entry.assetId === "asset.night-shift.background.station")).toMatchObject({
      width: 320,
      height: 200,
      indexByteLength: 64000,
      maximumSourceIndex: 127,
      defaultPalette: {
        paletteAssetId: "asset.palette.night-shift.station",
        paletteOffset: 0,
      },
    });
    expect(manifest.assets.find((entry) => entry.assetId === "asset.night-shift.actor.officer")).toMatchObject({
      width: 264,
      height: 50,
      indexByteLength: 13200,
      maximumSourceIndex: 31,
      transparentIndex: 0,
      defaultPalette: {
        paletteAssetId: "asset.palette.night-shift.actor-lighting",
        paletteOffset: 0,
      },
    });
    expect(
      manifest.assets.find((entry) => entry.assetId === "asset.night-shift.actor.officer")?.frames,
    ).toHaveLength(12);
  });

  it("rejects incomplete or out-of-plan compiler evidence", () => {
    expect(() => materializeNightShiftStationIndexedAssetManifest(evidence().slice(1))).toThrow(
      /Missing compiled index evidence/u,
    );
    expect(() =>
      materializeNightShiftStationIndexedAssetManifest([
        ...evidence(),
        {
          assetId: "asset.night-shift.background.roadside" as never,
          sha256: "f".repeat(64),
          byteLength: 64000,
          maximumSourceIndex: 100,
        },
      ]),
    ).toThrow(/not part of this Night Shift build plan/u);
  });
});
