import { evaluateCondition } from "@evavo/adventure-core";
import { pointInPolygon } from "@evavo/adventure-scene";
import { findNavigationRoute } from "@evavo/adventure-scene/navigation";
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
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { NavigableRuntimeWorldState } from "./movement-types.js";
import { enabledPortals } from "./movement-shared.js";

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

export interface RuntimeInteractionApproachResult extends ApproachSelectionResult {
  readonly sceneId: Id<"scene">;
}

export const resolveRuntimeInteractionApproach = (
  bundle: RuntimeBundle,
  world: NavigableRuntimeWorldState,
  actorInstanceId: Id<"actor-instance">,
  objectId: Id<"object">,
  verb: string,
  itemId: Id<"item"> | null,
): RuntimeInteractionApproachResult | null => {
  const actor = world.actorInstances[actorInstanceId];
  if (!actor) return null;
  const scene = bundle.scenes.find((candidate) => candidate.id === actor.sceneId);
  if (!scene) return null;
  const staging = stagingForScene(bundle.sceneStaging, scene.id);
  if (!staging) return null;

  const slots = (staging.approachSlotsByObject[objectId] ?? []).filter(
    (slot) => !slot.enabledWhen || evaluateCondition(slot.enabledWhen, world.story),
  );
  if (slots.length === 0) return null;

  const areas = scene.navigationAreas.filter(
    (area) => !area.enabledWhen || evaluateCondition(area.enabledWhen, world.story),
  );
  const portals = enabledPortals(bundle, world, scene.id);
  const selected = selectApproachSlot(slots, {
    actorPosition: actor.position,
    verb,
    ...(itemId ? { itemId } : {}),
    reachable: (point) =>
      findNavigationRoute(actor.position, point, areas, portals, { snapEnd: false }).kind === "route",
  });
  return selected ? { ...selected, sceneId: scene.id } : null;
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
