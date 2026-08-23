import { evaluateCondition } from "@evavo/adventure-core";
import type { Id, NavigationArea, Point } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { pointInPolygon } from "@evavo/adventure-scene";
import {
  findNavigationRoute,
  type NavigationPortal,
  type NavigationRoute,
  type NavigationRouteOptions,
  type NavigationRouteResult,
} from "@evavo/adventure-scene/navigation";
import {
  preferredLaneCostMultiplierAtPoint,
  sampleDepthScale,
  selectApproachSlot,
  type ApproachSelectionResult,
  type SceneStaging,
  type SceneStagingManifest,
  type SurfaceZone,
} from "@evavo/adventure-scene-instances/staging";
import type { NavigableRuntimeWorldState } from "./movement-types.js";
import { enabledNavigationAreas, enabledPortals } from "./movement-shared.js";

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

  const areas = enabledNavigationAreas(bundle, world, scene.id);
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

const routeScore = (staging: SceneStaging | null, route: NavigationRoute): number =>
  route.segments.reduce((total, segment) => {
    if (segment.kind !== "walk") return total + segment.distance;
    const midpoint = {
      x: (segment.from.x + segment.to.x) / 2,
      y: (segment.from.y + segment.to.y) / 2,
    };
    return total + segment.distance * preferredRouteCostMultiplier(staging, midpoint);
  }, 0);

const combineRoutes = (first: NavigationRoute, second: NavigationRoute): NavigationRoute => {
  const points = [...first.points];
  for (const point of second.points) {
    const previous = points.at(-1);
    if (!previous || previous.x !== point.x || previous.y !== point.y) points.push(point);
  }
  return {
    points,
    segments: [...first.segments, ...second.segments],
    distance: first.distance + second.distance,
    startAreaId: first.startAreaId,
    endAreaId: second.endAreaId,
    snappedStart: first.snappedStart,
    snappedEnd: second.snappedEnd,
  };
};

export const findStagedNavigationRoute = (
  bundle: RuntimeBundle,
  world: NavigableRuntimeWorldState,
  sceneId: Id<"scene">,
  startPoint: Point,
  endPoint: Point,
  areas: readonly NavigationArea[],
  portals: readonly NavigationPortal[],
  options: NavigationRouteOptions = {},
): NavigationRouteResult => {
  const baseline = findNavigationRoute(startPoint, endPoint, areas, portals, options);
  if (baseline.kind !== "route") return baseline;

  const rawStaging = stagingForScene(bundle.sceneStaging, sceneId);
  if (!rawStaging) return baseline;
  const staging: SceneStaging = {
    ...rawStaging,
    preferredWalkLanes: rawStaging.preferredWalkLanes.filter(
      (lane) => !lane.enabledWhen || evaluateCondition(lane.enabledWhen, world.story),
    ),
  };
  if (staging.preferredWalkLanes.length === 0) return baseline;

  let selected = baseline.route;
  let selectedScore = routeScore(staging, selected);
  let selectedKey = "baseline";

  for (const lane of staging.preferredWalkLanes) {
    for (let index = 0; index < lane.points.length; index += 1) {
      const waypoint = lane.points[index];
      if (!waypoint) continue;
      const first = findNavigationRoute(startPoint, waypoint, areas, portals, {
        snapStart: options.snapStart,
        snapEnd: false,
      });
      if (first.kind !== "route") continue;
      const second = findNavigationRoute(waypoint, endPoint, areas, portals, {
        snapStart: false,
        snapEnd: options.snapEnd,
      });
      if (second.kind !== "route") continue;
      const candidate = combineRoutes(first.route, second.route);
      const score = routeScore(staging, candidate);
      const key = `${lane.id}:${index}`;
      if (score < selectedScore - 1e-7 || (Math.abs(score - selectedScore) <= 1e-7 && key < selectedKey)) {
        selected = candidate;
        selectedScore = score;
        selectedKey = key;
      }
    }
  }

  return { kind: "route", route: selected };
};
