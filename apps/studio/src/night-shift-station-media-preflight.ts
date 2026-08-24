import { evaluateNightShiftFoundationPreflight } from "./night-shift-foundation-preflight.js";
import { nightShiftProductionAssets } from "./night-shift-production-assets.js";
import { nightShiftProductionWaves } from "./night-shift-production-waves.js";
import { nightShiftRuntimeIndexedAssetIds } from "./night-shift-runtime-index-requirements.js";

const stationWave = nightShiftProductionWaves.find((wave) => wave.id === "station");
if (!stationWave) throw new Error("Night Shift Station production wave is missing.");

const stationRequirements = nightShiftProductionAssets.filter((asset) =>
  stationWave.assetIds.includes(asset.assetId),
);

export interface NightShiftStationMediaPreflight {
  readonly reportVersion: 1;
  readonly foundation: ReturnType<typeof evaluateNightShiftFoundationPreflight>;
  readonly stationAssetIds: readonly string[];
  readonly scenePaletteAssetIds: readonly string[];
  readonly visualMasterIds: readonly string[];
  readonly foregroundPlateIds: readonly string[];
  readonly audioMasterIds: readonly string[];
  readonly runtimeIndexedAssetIds: readonly string[];
  readonly canAuthorStationMediaInParallel: true;
  readonly stationAcceptanceDependsOnFoundation: true;
}

export const evaluateNightShiftStationMediaPreflight = (): NightShiftStationMediaPreflight => ({
  reportVersion: 1,
  foundation: evaluateNightShiftFoundationPreflight(),
  stationAssetIds: stationWave.assetIds.map((assetId) => assetId as string),
  scenePaletteAssetIds: stationRequirements
    .filter((asset) => asset.role === "palette")
    .map((asset) => asset.assetId as string),
  visualMasterIds: stationRequirements
    .filter((asset) => asset.evidence.includes("period-vga"))
    .map((asset) => asset.assetId as string),
  foregroundPlateIds: stationRequirements
    .filter((asset) => asset.role === "foreground")
    .map((asset) => asset.assetId as string),
  audioMasterIds: stationRequirements
    .filter((asset) => asset.role === "audio-effect" || asset.role === "audio-ambience")
    .map((asset) => asset.assetId as string),
  runtimeIndexedAssetIds: nightShiftRuntimeIndexedAssetIds
    .filter((assetId) => stationWave.assetIds.includes(assetId))
    .map((assetId) => assetId as string),
  canAuthorStationMediaInParallel: true,
  stationAcceptanceDependsOnFoundation: true,
});
