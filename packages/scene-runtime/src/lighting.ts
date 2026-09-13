import { evaluateCondition } from "@evavo/adventure-core";
import type { Id, Point } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { pointInPolygon } from "@evavo/adventure-scene";
import { paletteMapById } from "@evavo/adventure-scene-instances/palette-maps";
import type { PaletteLightZone } from "@evavo/adventure-scene-instances/staging";
import type { RuntimeWorldState } from "./index.js";
import { stagingForScene } from "./staging.js";

const DEFAULT_DITHER_TRANSITION_WIDTH = 8;

export interface ResolvedPaletteLightTreatment {
  readonly zoneId: Id<"palette-light-zone">;
  readonly paletteMapId: string;
  readonly paletteAssetId: Id<"asset">;
  readonly paletteOffset: number;
  readonly blendMode: "hard" | "ordered-dither";
  readonly ditherCoverage: number;
  readonly priority: number;
}

const distancePointToSegment = (point: Point, start: Point, end: Point): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const progress = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  return Math.hypot(point.x - (start.x + dx * progress), point.y - (start.y + dy * progress));
};

export const paletteZoneBoundaryDistance = (zone: PaletteLightZone, point: Point): number => {
  if (!pointInPolygon(point, zone.shape)) return 0;
  const points = zone.shape.points;
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    if (!start || !end) continue;
    nearest = Math.min(nearest, distancePointToSegment(point, start, end));
  }
  return Number.isFinite(nearest) ? nearest : 0;
};

export const paletteZoneDitherCoverage = (
  zone: PaletteLightZone,
  point: Point,
  transitionWidth = DEFAULT_DITHER_TRANSITION_WIDTH,
): number => {
  if (zone.blendMode !== "ordered-dither") return 1;
  if (!Number.isFinite(transitionWidth) || transitionWidth <= 0) {
    throw new RangeError("Palette dither transition width must be a positive finite number.");
  }
  if (!pointInPolygon(point, zone.shape)) return 0;
  return Math.min(1, paletteZoneBoundaryDistance(zone, point) / transitionWidth);
};

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
    ditherCoverage: paletteZoneDitherCoverage(zone, point),
    priority: zone.priority,
  };
};
