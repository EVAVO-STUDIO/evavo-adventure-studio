import { evaluateCondition } from "@evavo/adventure-core";
import type { Id } from "@evavo/adventure-project-schema";
import {
  orderRenderNodes,
  type ResolvedFrame,
  type SpriteRenderNode,
} from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { quantizeNativePoint } from "@evavo/adventure-scene";
import type { RuntimeWorldState } from "./index.js";

const imageAsset = (bundle: RuntimeBundle, assetId: Id<"asset">, label: string) => {
  const asset = bundle.assets.find((candidate) => candidate.assetId === assetId);
  if (asset?.kind !== "image") {
    throw new Error(`${label} asset '${assetId}' is not a runtime image.`);
  }
  return asset;
};

export const resolveSceneOccluderNodes = (
  bundle: RuntimeBundle,
  sceneId: Id<"scene">,
): readonly SpriteRenderNode[] => {
  const scene = bundle.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) throw new Error(`Runtime scene '${sceneId}' does not exist.`);

  return [...scene.occluders]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((occluder): SpriteRenderNode => {
      const asset = imageAsset(bundle, occluder.assetId, `Scene occluder '${occluder.id}'`);
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

export const resolveStagedOcclusionPlaneNodes = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  sceneId: Id<"scene">,
): readonly SpriteRenderNode[] => {
  const staging = bundle.sceneStaging?.scenes.find((candidate) => candidate.sceneId === sceneId);
  if (!staging) return [];

  return staging.occlusionPlanes
    .filter((plane) => !plane.enabledWhen || evaluateCondition(plane.enabledWhen, world.story))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((plane): SpriteRenderNode => {
      const asset = imageAsset(bundle, plane.assetId, `Occlusion plane '${plane.id}'`);
      return {
        kind: "sprite",
        id: `render.occlusion-plane.${plane.id}` as Id<"render-node">,
        order: {
          layer: "world",
          elevation: plane.elevation,
          baselineY: plane.baselineY,
          zOffset: plane.zOffset,
          stableId: `occlusion-plane.${plane.id}`,
        },
        transform: {
          position: quantizeNativePoint(
            plane.position,
            bundle.presentation.pixelMotionPolicy,
            "entity",
          ),
          pivot: plane.pivot,
          scale: {
            x: plane.mirrored ? -plane.scale : plane.scale,
            y: plane.scale,
          },
          rotationRadians: 0,
        },
        opacity: plane.opacity,
        visible: true,
        assetId: plane.assetId,
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
  world?: RuntimeWorldState,
): ResolvedFrame => {
  const legacy = resolveSceneOccluderNodes(bundle, sceneId);
  const staged = world ? resolveStagedOcclusionPlaneNodes(bundle, world, sceneId) : [];
  if (legacy.length === 0 && staged.length === 0) return frame;
  return {
    ...frame,
    nodes: orderRenderNodes([...frame.nodes, ...legacy, ...staged]),
  };
};
