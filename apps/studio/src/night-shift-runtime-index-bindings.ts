import type { Id } from "@evavo/adventure-project-schema";
import { nightShiftRuntimeIndexedAssetIds } from "./night-shift-runtime-index-requirements.js";
import { nightShiftRuntimeProject } from "./night-shift-runtime-contracts.js";

export interface NightShiftRuntimeIndexBinding {
  readonly assetId: Id<"asset">;
  readonly paletteAssetId: Id<"asset">;
  readonly paletteOffset: number;
}

const binding = (
  assetId: string,
  paletteAssetId: string,
  paletteOffset = 0,
): NightShiftRuntimeIndexBinding => ({
  assetId: assetId as Id<"asset">,
  paletteAssetId: paletteAssetId as Id<"asset">,
  paletteOffset,
});

export const nightShiftRuntimeIndexBindings: readonly NightShiftRuntimeIndexBinding[] = [
  binding("asset.night-shift.background.station", "asset.palette.night-shift.station"),
  binding("asset.night-shift.background.roadside", "asset.palette.night-shift.roadside"),
  binding("asset.night-shift.background.diner", "asset.palette.night-shift.diner"),

  binding("asset.night-shift.actor.officer", "asset.palette.night-shift.actor-lighting"),
  binding("asset.night-shift.actor.sergeant", "asset.palette.night-shift.actor-lighting"),
  binding("asset.night-shift.actor.driver", "asset.palette.night-shift.actor-lighting"),
  binding("asset.night-shift.actor.server", "asset.palette.night-shift.actor-lighting"),

  binding("asset.night-shift.object.radio", "asset.palette.night-shift.station"),
  binding("asset.night-shift.object.keys", "asset.palette.night-shift.station"),
  binding("asset.night-shift.object.door", "asset.palette.night-shift.station"),
  binding("asset.night-shift.object.briefing", "asset.palette.night-shift.station"),
  binding("asset.night-shift.object.sedan", "asset.palette.night-shift.roadside"),
  binding("asset.night-shift.object.receipt", "asset.palette.night-shift.diner"),
] as const;

export const nightShiftRuntimeIndexBindingForAsset = (
  assetId: Id<"asset"> | string,
): NightShiftRuntimeIndexBinding | null =>
  nightShiftRuntimeIndexBindings.find((candidate) => candidate.assetId === assetId) ?? null;

export const validateNightShiftRuntimeIndexBindings = (): readonly string[] => {
  const issues: string[] = [];
  const required = new Set(nightShiftRuntimeIndexedAssetIds.map((assetId) => assetId as string));
  const seen = new Set<string>();
  const projectAssets = new Map(
    nightShiftRuntimeProject.assets.map((asset) => [asset.id as string, asset] as const),
  );

  for (const entry of nightShiftRuntimeIndexBindings) {
    if (seen.has(entry.assetId)) issues.push(`Duplicate runtime index binding '${entry.assetId}'.`);
    seen.add(entry.assetId);
    if (!required.has(entry.assetId)) {
      issues.push(`Runtime index binding '${entry.assetId}' is not a required scene index asset.`);
    }
    const source = projectAssets.get(entry.assetId);
    if (!source || (source.kind !== "image" && source.kind !== "spritesheet")) {
      issues.push(`Runtime index binding source '${entry.assetId}' is missing or not renderable image data.`);
    }
    const palette = projectAssets.get(entry.paletteAssetId);
    if (!palette || palette.kind !== "palette") {
      issues.push(`Runtime index binding palette '${entry.paletteAssetId}' is missing or not a palette asset.`);
    }
    if (!Number.isSafeInteger(entry.paletteOffset) || entry.paletteOffset < 0 || entry.paletteOffset > 255) {
      issues.push(`Runtime index binding '${entry.assetId}' has invalid palette offset ${entry.paletteOffset}.`);
    }
  }

  for (const assetId of required) {
    if (!seen.has(assetId)) issues.push(`Runtime index asset '${assetId}' has no default palette binding.`);
  }

  return issues.sort((left, right) => left.localeCompare(right));
};
