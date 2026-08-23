import type { Id } from "@evavo/adventure-project-schema";
import {
  orderRenderNodes,
  type ResolvedFrame,
  type SpriteRenderNode,
} from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { quantizeNativePoint } from "@evavo/adventure-scene";

export const resolveSceneOccluderNodes = (
  bundle: RuntimeBundle,
  sceneId: Id<"scene">,
): readonly SpriteRenderNode[] => {
  const scene = bundle.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) throw new Error(`Runtime scene '${sceneId}' does not exist.`);
  const assets = new Map(bundle.assets.map((asset) => [asset.assetId as string, asset] as const));

  return [...scene.occluders]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((occluder): SpriteRenderNode => {
      const asset = assets.get(occluder.assetId);
      if (asset?.kind !== "image") {
        throw new Error(
          `Scene occluder '${occluder.id}' asset '${occluder.assetId}' is not a runtime image.`,
        );
      }
      return {
        kind: "sprite",
        id: `render.occluder.${occluder.id}` as Id<"render-node">,
        order: {
          layer: "world",
          elevation: 0,
          baselineY: occluder.baselineY,
          zOffset: 0,
          stableId: `occluder.${occluder.id}`,
        },
        transform: {
          position: quantizeNativePoint(
            occluder.position,
            bundle.presentation.pixelMotionPolicy,
            "entity",
          ),
          pivot: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          rotationRadians: 0,
        },
        opacity: 1,
        visible: true,
        assetId: occluder.assetId,
        sourceRect: {
          x: 0,
          y: 0,
          width: asset.metadata.width,
          height: asset.metadata.height,
        },
        originalSize: {
          width: asset.metadata.width,
          height: asset.metadata.height,
        },
        trimOffset: { x: 0, y: 0 },
        sampling: bundle.presentation.textureSampling,
      };
    });
};

export const applySceneOcclusionToFrame = (
  bundle: RuntimeBundle,
  frame: ResolvedFrame,
  sceneId: Id<"scene">,
): ResolvedFrame => {
  const occluders = resolveSceneOccluderNodes(bundle, sceneId);
  if (occluders.length === 0) return frame;
  return {
    ...frame,
    nodes: orderRenderNodes([...frame.nodes, ...occluders]),
  };
};
