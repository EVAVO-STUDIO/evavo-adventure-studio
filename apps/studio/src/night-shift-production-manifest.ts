import { nightShiftRuntimeProject } from "./night-shift-runtime-contracts.js";
import {
  nightShiftIndexedProductionAssetIds,
  nightShiftPeriodVgaProductionAssetIds,
  nightShiftProductionAssets,
} from "./night-shift-production-assets.js";
import { nightShiftProductionWaves } from "./night-shift-production-waves.js";
import { nightShiftRuntimeSourceSummary } from "./night-shift-runtime-source.js";

export const nightShiftProductionManifest = {
  manifestVersion: 1,
  projectId: nightShiftRuntimeProject.id,
  productionProfileId: "early-procedural-icon-vga",
  referenceLane: "police-quest-i-vga-remake",
  nativeCanvas: { width: 320, height: 200 },
  presentation: {
    integerScale: true,
    textureSampling: "nearest",
    pixelMotionPolicy: "strict",
    interactionMode: "icon-bar",
    scoreVisible: true,
  },
  proof: {
    scenes: [
      "scene.night-shift.station",
      "scene.night-shift.roadside",
      "scene.night-shift.diner",
    ],
    successScore: 32,
    requiredDeterministicReplays: ["success", "failure-retry"],
    minimumNativeScreenshots: 6,
  },
  evidencePolicy: {
    periodVgaAssetIds: [...nightShiftPeriodVgaProductionAssetIds],
    indexedAssetIds: [...nightShiftIndexedProductionAssetIds],
    requireRawOneToOneReview: true,
    requireIntegerScaleReview: true,
    requireBinarySpriteAlpha: true,
    requireOpaqueBackgrounds: true,
    prohibitModernEffects: true,
    prohibitSyntheticMicrotexture: true,
  },
  sourceSummary: nightShiftRuntimeSourceSummary,
  waves: nightShiftProductionWaves.map((wave) => ({
    id: wave.id,
    label: wave.label,
    dependsOn: [...wave.dependsOn],
    goal: wave.goal,
    assetIds: [...wave.assetIds],
    acceptance: [...wave.acceptance],
  })),
  assets: [...nightShiftProductionAssets],
} as const;

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort((left, right) => left.localeCompare(right))) {
      const child = (value as Record<string, unknown>)[key];
      if (child !== undefined) output[key] = canonical(child);
    }
    return output;
  }
  return value;
};

export const nightShiftProductionManifestJson = (): string =>
  `${JSON.stringify(canonical(nightShiftProductionManifest), null, 2)}\n`;

export const nightShiftProductionManifestFileName = "night-shift.production-manifest.json";
