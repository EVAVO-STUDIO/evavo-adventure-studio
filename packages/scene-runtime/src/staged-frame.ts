import type { Id, Point } from "@evavo/adventure-project-schema";
import type { RenderNode, ResolvedCamera, ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { resolveScaleAtY } from "@evavo/adventure-scene";
import { resolveRuntimeSceneFrame, type RuntimeWorldState } from "./index.js";
import { resolveRuntimePerspectiveScale } from "./staged-perspective.js";

export interface ResolveStagedRuntimeSceneFrameOptions {
  readonly sceneId?: Id<"scene">;
  readonly camera?: ResolvedCamera;
}

const scaleRatioAt = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  sceneId: Id<"scene">,
  point: Point,
): number => {
  const scene = bundle.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) return 1;
  const legacy = resolveScaleAtY(scene.depthBands, point.y)?.scale ?? 1;
  const staged = resolveRuntimePerspectiveScale(bundle, world, sceneId, point, legacy);
  return legacy > 0 ? staged / legacy : 1;
};

const rescaleNode = (node: RenderNode, ratio: number): RenderNode => {
  if (ratio === 1 || !Number.isFinite(ratio) || ratio <= 0) return node;
  return {
    ...node,
    transform: {
      ...node.transform,
      scale: {
        x: node.transform.scale.x * ratio,
        y: node.transform.scale.y * ratio,
      },
    },
  };
};

export const resolveStagedRuntimeSceneFrame = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  options: ResolveStagedRuntimeSceneFrameOptions = {},
): ResolvedFrame => {
  const frame = resolveRuntimeSceneFrame(bundle, world, options);
  if (!bundle.sceneStaging) return frame;
  const sceneId = options.sceneId ?? world.story.currentSceneId;
  const composition = bundle.sceneInstances?.scenes.find((candidate) => candidate.sceneId === sceneId);
  const objects = new Map(
    (composition?.objectInstances ?? []).map((instance) => [instance.id as string, instance] as const),
  );

  return {
    ...frame,
    nodes: frame.nodes.map((node) => {
      const stableId = node.order.stableId;
      const actor = world.actorInstances[stableId];
      if (actor?.sceneId === sceneId) {
        return rescaleNode(node, scaleRatioAt(bundle, world, sceneId, actor.position));
      }
      const object = objects.get(stableId);
      if (object) {
        return rescaleNode(node, scaleRatioAt(bundle, world, sceneId, object.position));
      }
      return node;
    }),
  };
};
