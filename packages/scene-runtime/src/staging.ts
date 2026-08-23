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
  type ActorFootprint,
  type ApproachSelectionResult,
  type SceneStaging,
  type SceneStagingManifest,
  type SurfaceZone,
} from "@evavo/adventure-scene-instances/staging";
import type { NavigableRuntimeWorldState } from "./movement-types.js";
import { enabledNavigationAreas, enabledPortals } from "./movement-shared.js";

const EPSILON = 1e-7;

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

export const actorFootprintFor = (
  staging: SceneStaging | null,
  actorId: Id<"actor"> | string | null,
): ActorFootprint | null => (staging && actorId ? staging.actorFootprints[actorId] ?? null : null);

const footprintFitsAtPoint = (
  point: Point,
  area: NavigationArea,
  footprint: ActorFootprint,
): boolean => {
  const halfWidth = footprint.width / 2 + footprint.clearance;
  const halfDepth = footprint.depth / 2 + footprint.clearance;
  const offsets: readonly Point[] = [
    { x: 0, y: 0 },
    { x: halfWidth, y: 0 },
    { x: -halfWidth, y: 0 },
    { x: 0, y: halfDepth },
    { x: 0, y: -halfDepth },
    { x: halfWidth * 0.7071, y: halfDepth * 0.7071 },
    { x: -halfWidth * 0.7071, y: halfDepth * 0.7071 },
    { x: halfWidth * 0.7071, y: -halfDepth * 0.7071 },
    { x: -halfWidth * 0.7071, y: -halfDepth * 0.7071 },
  ];
  return offsets.every((offset) =>
    pointInPolygon({ x: point.x + offset.x, y: point.y + offset.y }, area.shape),
  );
};

export const routeHasFootprintClearance = (
  route: NavigationRoute,
  areas: readonly NavigationArea[],
  footprint: ActorFootprint | null,
): boolean => {
  if (!footprint) return true;
  const areasById = new Map(areas.map((area) => [area.id as string, area] as const));
  for (const segment of route.segments) {
    if (segment.kind !== "walk" || !segment.areaId) continue;
    const area = areasById.get(segment.areaId);
    if (!area) return false;
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const point = {
        x: segment.from.x + (segment.to.x - segment.from.x) * progress,
        y: segment.from.y + (segment.to.y - segment.from.y) * progress,
      };
      if (!footprintFitsAtPoint(point, area, footprint)) return false;
    }
  }
  return true;
};

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
      findStagedNavigationRoute(
        bundle,
        world,
        scene.id,
        actor.position,
        point,
        areas,
        portals,
        { snapEnd: false },
        actor.actorId,
      ).kind === "route",
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

interface RouteCandidate {
  readonly key: string;
  readonly route: NavigationRoute;
  readonly score: number;
}

export const findStagedNavigationRoute = (
  bundle: RuntimeBundle,
  world: NavigableRuntimeWorldState,
  sceneId: Id<"scene">,
  startPoint: Point,
  endPoint: Point,
  areas: readonly NavigationArea[],
  portals: readonly NavigationPortal[],
  options: NavigationRouteOptions = {},
  actorId: Id<"actor"> | string | null = null,
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
  const footprint = actorFootprintFor(staging, actorId);
  const candidates: RouteCandidate[] = [];
  const addCandidate = (key: string, route: NavigationRoute): void => {
    if (!routeHasFootprintClearance(route, areas, footprint)) return;
    candidates.push({ key, route, score: routeScore(staging, route) });
  };
  addCandidate("baseline", baseline.route);

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
      addCandidate(`${lane.id}:${index}`, combineRoutes(first.route, second.route));
    }
  }

  if (footprint) {
    const waypoints = areas
      .flatMap((area) => area.shape.points.map((point, index) => ({ point, key: `${area.id}:${index}` })))
      .sort((left, right) => left.key.localeCompare(right.key));
    for (const waypoint of waypoints) {
      const first = findNavigationRoute(startPoint, waypoint.point, areas, portals, {
        snapStart: options.snapStart,
        snapEnd: false,
      });
      if (first.kind !== "route") continue;
      const second = findNavigationRoute(waypoint.point, endPoint, areas, portals, {
        snapStart: false,
        snapEnd: options.snapEnd,
      });
      if (second.kind !== "route") continue;
      addCandidate(`clearance:${waypoint.key}`, combineRoutes(first.route, second.route));
    }
  }

  const selected = candidates.sort((left, right) => {
    if (Math.abs(left.score - right.score) > EPSILON) return left.score - right.score;
    if (Math.abs(left.route.distance - right.route.distance) > EPSILON) {
      return left.route.distance - right.route.distance;
    }
    return left.key.localeCompare(right.key);
  })[0];

  return selected ? { kind: "route", route: selected.route } : { kind: "unreachable", reason: "no-connected-route" };
};
