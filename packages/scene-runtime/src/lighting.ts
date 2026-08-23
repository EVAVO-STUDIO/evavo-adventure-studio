import { evaluateCondition } from "@evavo/adventure-core";
import type { Id, Point } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { pointInPolygon } from "@evavo/adventure-scene";
import { paletteMapById } from "@evavo/adventure-scene-instances/palette-maps";
import type { PaletteLightZone } from "@evavo/adventure-scene-instances/staging";
import type { RuntimeWorldState } from "./index.js";
import { stagingForScene } from "./staging.js";

export interface ResolvedPaletteLightTreatment {
  readonly zoneId: Id<"palette-light-zone">;
  readonly paletteMapId: string;
  readonly paletteAssetId: Id<"asset">;
  readonly paletteOffset: number;
  readonly blendMode: "hard" | "ordered-dither";
  readonly priority: number;
}

export const runtimePaletteLightZoneAtPoint = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  sceneId: Id<"scene">,
  point: Point,
): PaletteLightZone | null => {
  const staging = stagingForScene(bundle.sceneStaging, sceneId);
  if (!staging) return null;
  const candidates = staging.paletteLightZones
    .filter(
      (zone) =>
        (!zone.enabledWhen || evaluateCondition(zone.enabledWhen, world.story)) &&
        pointInPolygon(point, zone.shape),
    )
    .sort((left, right) => {
      if (left.priority !== right.priority) return right.priority - left.priority;
      return left.id.localeCompare(right.id);
    });
  return candidates[0] ?? null;
};

export const resolvePaletteLightTreatment = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  sceneId: Id<"scene">,
  point: Point,
): ResolvedPaletteLightTreatment | null => {
  const zone = runtimePaletteLightZoneAtPoint(bundle, world, sceneId, point);
  if (!zone) return null;
  const map = paletteMapById(bundle.paletteMaps, zone.paletteMapId);
  if (!map) return null;
  return {
    zoneId: zone.id,
    paletteMapId: zone.paletteMapId,
    paletteAssetId: map.paletteAssetId,
    paletteOffset: map.paletteOffset,
    blendMode: zone.blendMode,
    priority: zone.priority,
  };
};
