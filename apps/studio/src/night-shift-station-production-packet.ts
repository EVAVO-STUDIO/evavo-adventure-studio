import { nightShiftCompleteInstances } from "./night-shift-complete-proof.js";
import { nightShiftAudioMix, nightShiftRuntimeProject } from "./night-shift-runtime-contracts.js";
import { nightShiftStationRuntimeIndexBuildPlan } from "./night-shift-runtime-index-build-plan.js";
import { nightShiftRuntimeIndexedAssetIds } from "./night-shift-runtime-index-requirements.js";
import { nightShiftRuntimeStaging } from "./night-shift-runtime-staging.js";
import { nightShiftProductionAssets } from "./night-shift-production-assets.js";
import { nightShiftProductionWaves } from "./night-shift-production-waves.js";

const STATION_SCENE_ID = "scene.night-shift.station";
const stationScene = nightShiftRuntimeProject.scenes.find((scene) => scene.id === STATION_SCENE_ID);
const stationComposition = nightShiftCompleteInstances.scenes.find(
  (scene) => scene.sceneId === STATION_SCENE_ID,
);
const stationStaging = nightShiftRuntimeStaging.scenes.find(
  (scene) => scene.sceneId === STATION_SCENE_ID,
);
const foundationWave = nightShiftProductionWaves.find((wave) => wave.id === "foundation");
const stationWave = nightShiftProductionWaves.find((wave) => wave.id === "station");

if (!stationScene || !stationComposition || !stationStaging || !foundationWave || !stationWave) {
  throw new Error("Night Shift Station production packet cannot resolve canonical source documents.");
}

const packetAssetIds = new Set([...foundationWave.assetIds, ...stationWave.assetIds] as readonly string[]);
const stationAudioAssetIds = new Set(
  nightShiftProductionAssets
    .filter(
      (asset) =>
        packetAssetIds.has(asset.assetId) &&
        (asset.role === "audio-effect" || asset.role === "audio-ambience"),
    )
    .map((asset) => asset.assetId as string),
);
const stationCueIds = new Set(
  nightShiftAudioMix.cues
    .filter((cue) => stationAudioAssetIds.has(cue.assetId))
    .map((cue) => cue.id as string),
);

export const nightShiftStationProductionPacket = {
  packetVersion: 1,
  projectId: nightShiftRuntimeProject.id,
  sceneId: STATION_SCENE_ID,
  nativeCanvas: {
    width: nightShiftRuntimeProject.presentation.nativeWidth,
    height: nightShiftRuntimeProject.presentation.nativeHeight,
  },
  productionLanguage: {
    profileId: "early-procedural-icon-vga",
    referenceLane: "police-quest-i-vga-remake",
    rule: "Grounded early-SCI1 municipal VGA: small actors, practical targets, restrained fluorescent values and no modern HUD/effects language.",
  },
  scene: stationScene,
  composition: stationComposition,
  staging: stationStaging,
  assets: nightShiftProductionAssets.filter((asset) => packetAssetIds.has(asset.assetId)),
  runtimeIndexedAssetIds: nightShiftRuntimeIndexedAssetIds.filter((assetId) =>
    packetAssetIds.has(assetId),
  ),
  runtimeIndexBuildPlan: nightShiftStationRuntimeIndexBuildPlan,
  audio: {
    cues: nightShiftAudioMix.cues.filter((cue) => stationCueIds.has(cue.id)),
    soundscape: nightShiftAudioMix.soundscapes.find(
      (soundscape) => soundscape.sceneId === STATION_SCENE_ID,
    ) ?? null,
  },
  waveAcceptance: {
    foundation: [...foundationWave.acceptance],
    station: [...stationWave.acceptance],
  },
  evidence: {
    requiredRawOneToOneScreenshots: [
      "station initial state",
      "officer behind desk foreground",
      "officer in fluorescent palette treatment",
      "briefing/radio/keys ready state",
    ],
    requiredReplay: "briefing → radio → keys → ready station exit",
    expectedScoreAtExit: 14,
  },
} as const;

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort((left, right) =>
      left.localeCompare(right),
    )) {
      const child = (value as Record<string, unknown>)[key];
      if (child !== undefined) output[key] = canonical(child);
    }
    return output;
  }
  return value;
};

export const nightShiftStationProductionPacketJson = (): string =>
  `${JSON.stringify(canonical(nightShiftStationProductionPacket), null, 2)}\n`;

export const nightShiftStationProductionPacketFileName =
  "night-shift.station-production-packet.json";

export const downloadNightShiftStationProductionPacket = (): void => {
  const blob = new Blob([nightShiftStationProductionPacketJson()], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nightShiftStationProductionPacketFileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
