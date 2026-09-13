import { evaluateCondition } from "@evavo/adventure-core";
import type { Id, Point } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { pointInPolygon } from "@evavo/adventure-scene";
import type { RuntimeWorldState } from "./index.js";
import { resolvePerspectiveScale, stagingForScene } from "./staging.js";

export const navigationAreaAtRuntimePoint = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  sceneId: Id<"scene">,
  point: Point,
): Id<"navigation-area"> | null => {
  const scene = bundle.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) return null;
  const matches = scene.navigationAreas
    .filter((area) => !area.enabledWhen || evaluateCondition(area.enabledWhen, world.story))
    .filter((area) => pointInPolygon(point, area.shape))
    .sort((left, right) => {
      if (left.elevation !== right.elevation) return right.elevation - left.elevation;
      return left.id.localeCompare(right.id);
    });
  return matches[0]?.id ?? null;
};

export const resolveRuntimePerspectiveScale = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  sceneId: Id<"scene">,
  point: Point,
  fallbackScale: number,
): number => {
  const staging = stagingForScene(bundle.sceneStaging, sceneId);
  const areaId = navigationAreaAtRuntimePoint(bundle, world, sceneId, point);
  return resolvePerspectiveScale(staging, areaId, point.y, fallbackScale);
};
