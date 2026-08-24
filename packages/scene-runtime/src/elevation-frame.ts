import { evaluateCondition } from "@evavo/adventure-core";
import type { Id, NavigationArea, Point } from "@evavo/adventure-project-schema";
import type { RenderNode, ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { pointInPolygon } from "@evavo/adventure-scene";
import type { RuntimeWorldState } from "./index.js";

export interface RuntimeNavigationElevation {
  readonly areaId: Id<"navigation-area">;
  readonly elevation: number;
}

const activeAreasAtPoint = (
  scene: RuntimeBundle["scenes"][number],
  world: RuntimeWorldState,
  point: Point,
): readonly NavigationArea[] =>
  scene.navigationAreas
    .filter((area) => !area.enabledWhen || evaluateCondition(area.enabledWhen, world.story))
    .filter((area) => pointInPolygon(point, area.shape))
    .sort((left, right) => {
      if (left.elevation !== right.elevation) return right.elevation - left.elevation;
      return left.id.localeCompare(right.id);
    });

export const runtimeNavigationElevationAtPoint = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  sceneId: Id<"scene">,
  point: Point,
): RuntimeNavigationElevation | null => {
  const scene = bundle.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) return null;
  const area = activeAreasAtPoint(scene, world, point)[0];
  return area ? { areaId: area.id, elevation: area.elevation } : null;
};

const actorInstanceIdForNode = (node: RenderNode): Id<"actor-instance"> | null => {
  const prefix = "render.actor-instance.";
  return node.id.startsWith(prefix)
    ? (node.id.slice(prefix.length) as Id<"actor-instance">)
    : null;
};

export const applyNavigationElevationToFrame = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  frame: ResolvedFrame,
  sceneId: Id<"scene">,
): ResolvedFrame => ({
  ...frame,
  nodes: frame.nodes.map((node): RenderNode => {
    const actorInstanceId = actorInstanceIdForNode(node);
    if (!actorInstanceId) return node;
    const actor = world.actorInstances[actorInstanceId];
    if (!actor || actor.sceneId !== sceneId) return node;
    const resolved = runtimeNavigationElevationAtPoint(bundle, world, sceneId, actor.position);
    if (!resolved || resolved.elevation === node.order.elevation) return node;
    return {
      ...node,
      order: {
        ...node.order,
        elevation: resolved.elevation,
      },
    };
  }),
});
