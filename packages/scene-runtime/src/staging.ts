import { pointInPolygon } from "@evavo/adventure-scene";
import {
  preferredLaneCostMultiplierAtPoint,
  sampleDepthScale,
  selectApproachSlot,
  type ApproachSelectionResult,
  type SceneStaging,
  type SceneStagingManifest,
  type SurfaceZone,
} from "@evavo/adventure-scene-instances/staging";
import type { Id, Point } from "@evavo/adventure-project-schema";

export const stagingForScene = (
  manifest: SceneStagingManifest | undefined,
  sceneId: Id<"scene">,
): SceneStaging | null => manifest?.scenes.find((scene) => scene.sceneId === sceneId) ?? null;

export interface ResolveInteractionApproachOptions {
  readonly actorPosition: Point;
  readonly verb?: string;
  readonly itemId?: string;
  readonly reachable?: (point: Point) => boolean;
}

export const resolveInteractionApproach = (
  staging: SceneStaging | null,
  objectId: Id<"object">,
  options: ResolveInteractionApproachOptions,
): ApproachSelectionResult | null => {
  if (!staging) return null;
  const slots = staging.approachSlotsByObject[objectId] ?? [];
  return selectApproachSlot(slots, options);
};

export const resolvePerspectiveScale = (
  staging: SceneStaging | null,
  areaId: Id<"navigation-area"> | null,
  y: number,
  fallbackScale: number,
): number => {
  if (!staging || !areaId) return fallbackScale;
  const override = staging.navigationScaleOverrides.find((candidate) => candidate.areaId === areaId);
  if (!override) return fallbackScale;
  if (override.mode === "fixed") return override.fixedScale ?? fallbackScale;
  const curve = staging.depthScaleCurves.find((candidate) => candidate.id === override.curveId);
  return curve ? sampleDepthScale(curve, y) : fallbackScale;
};

export const preferredRouteCostMultiplier = (
  staging: SceneStaging | null,
  point: Point,
): number => {
  if (!staging || staging.preferredWalkLanes.length === 0) return 1;
  return staging.preferredWalkLanes.reduce(
    (best, lane) => Math.min(best, preferredLaneCostMultiplierAtPoint(lane, point)),
    1,
  );
};

export const surfaceZoneAtPoint = (
  staging: SceneStaging | null,
  point: Point,
): SurfaceZone | null => {
  if (!staging) return null;
  const matches = staging.surfaceZones.filter((zone) => pointInPolygon(point, zone.shape));
  return matches.at(-1) ?? null;
};
