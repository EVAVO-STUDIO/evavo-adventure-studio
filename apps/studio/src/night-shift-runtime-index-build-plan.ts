import type { Id } from "@evavo/adventure-project-schema";
import { nightShiftProductionAssets } from "./night-shift-production-assets.js";
import { nightShiftProductionWaves } from "./night-shift-production-waves.js";
import { nightShiftRuntimeIndexBindingForAsset } from "./night-shift-runtime-index-bindings.js";
import { nightShiftRuntimeIndexedAssetIds } from "./night-shift-runtime-index-requirements.js";
import { nightShiftRuntimeProject } from "./night-shift-runtime-contracts.js";

export interface NightShiftRuntimeIndexFramePlan {
  readonly frameId: Id<"sprite-frame">;
  readonly sourceRect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly originalSize: { readonly width: number; readonly height: number };
  readonly trimOffset: { readonly x: number; readonly y: number };
}

export interface NightShiftRuntimeIndexAssetPlan {
  readonly assetId: Id<"asset">;
  readonly assetKind: "image" | "spritesheet";
  readonly width: number;
  readonly height: number;
  readonly runtimePath: string;
  readonly transparentIndex: number | null;
  readonly defaultPalette: {
    readonly paletteAssetId: Id<"asset">;
    readonly paletteOffset: number;
  };
  readonly frames: readonly NightShiftRuntimeIndexFramePlan[];
}

const safeStem = (assetId: string): string =>
  assetId
    .replace(/^asset\.night-shift\./u, "")
    .replace(/[^a-z0-9.-]+/gu, "-")
    .replace(/\./gu, "-");

const actorFramesForAsset = (assetId: string): readonly NightShiftRuntimeIndexFramePlan[] =>
  nightShiftRuntimeProject.actors
    .flatMap((actor) => actor.frames)
    .filter((frame) => frame.assetId === assetId)
    .map((frame) => ({
      frameId: frame.id,
      sourceRect: frame.sourceRect,
      originalSize: frame.sourceSize,
      trimOffset: frame.trimOffset,
    }))
    .sort((left, right) => left.frameId.localeCompare(right.frameId));

const planForAsset = (assetId: Id<"asset">): NightShiftRuntimeIndexAssetPlan => {
  const asset = nightShiftRuntimeProject.assets.find((candidate) => candidate.id === assetId);
  const requirement = nightShiftProductionAssets.find((candidate) => candidate.assetId === assetId);
  const binding = nightShiftRuntimeIndexBindingForAsset(assetId);
  if (!asset || (asset.kind !== "image" && asset.kind !== "spritesheet")) {
    throw new Error(`Runtime index plan source '${assetId}' is missing or not an image/spritesheet asset.`);
  }
  if (!requirement?.nativeSize || requirement.sizePolicy !== "exact") {
    throw new Error(`Runtime index plan source '${assetId}' requires exact native production dimensions.`);
  }
  if (!binding) throw new Error(`Runtime index plan source '${assetId}' has no default palette binding.`);
  const frames = asset.kind === "spritesheet" ? actorFramesForAsset(assetId) : [];
  if (asset.kind === "spritesheet" && frames.length === 0) {
    throw new Error(`Runtime indexed spritesheet '${assetId}' has no actor frame geometry.`);
  }
  return {
    assetId,
    assetKind: asset.kind,
    width: requirement.nativeSize.width,
    height: requirement.nativeSize.height,
    runtimePath: `indexed/night-shift/${safeStem(assetId)}.idx`,
    transparentIndex: requirement.alpha === "binary" ? 0 : null,
    defaultPalette: {
      paletteAssetId: binding.paletteAssetId,
      paletteOffset: binding.paletteOffset,
    },
    frames,
  };
};

export const nightShiftRuntimeIndexBuildPlan: readonly NightShiftRuntimeIndexAssetPlan[] =
  nightShiftRuntimeIndexedAssetIds.map(planForAsset);

const stationInputAssetIds = new Set(
  nightShiftProductionWaves
    .filter((wave) => wave.id === "foundation" || wave.id === "station")
    .flatMap((wave) => wave.assetIds)
    .map((assetId) => assetId as string),
);

export const nightShiftStationRuntimeIndexBuildPlan = nightShiftRuntimeIndexBuildPlan.filter(
  (entry) => stationInputAssetIds.has(entry.assetId),
);

export const validateNightShiftRuntimeIndexBuildPlan = (): readonly string[] => {
  const issues: string[] = [];
  const required = new Set(nightShiftRuntimeIndexedAssetIds.map((assetId) => assetId as string));
  const seen = new Set<string>();
  const paths = new Set<string>();
  for (const entry of nightShiftRuntimeIndexBuildPlan) {
    if (seen.has(entry.assetId)) issues.push(`Duplicate index build entry '${entry.assetId}'.`);
    seen.add(entry.assetId);
    if (!required.has(entry.assetId)) issues.push(`Unexpected index build entry '${entry.assetId}'.`);
    if (paths.has(entry.runtimePath)) issues.push(`Duplicate index runtime path '${entry.runtimePath}'.`);
    paths.add(entry.runtimePath);
    if (entry.width <= 0 || entry.height <= 0) issues.push(`Index build entry '${entry.assetId}' has invalid dimensions.`);
    if (entry.assetKind === "spritesheet" && entry.frames.length === 0) {
      issues.push(`Indexed spritesheet '${entry.assetId}' has no frame metadata.`);
    }
    if (entry.assetKind === "image" && entry.frames.length > 0) {
      issues.push(`Indexed image '${entry.assetId}' unexpectedly declares frame metadata.`);
    }
  }
  for (const assetId of required) {
    if (!seen.has(assetId)) issues.push(`Runtime index asset '${assetId}' has no build-plan entry.`);
  }
  return issues.sort((left, right) => left.localeCompare(right));
};
