import type { Id } from "@evavo/adventure-project-schema";
import type { ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { applyNavigationElevationToFrame } from "./elevation-frame.js";
import {
  resolveRuntimeSceneFrame as resolveBaseRuntimeSceneFrame,
  type ResolveRuntimeSceneFrameOptions,
  type RuntimeWorldState,
} from "./index.js";
import { applyIndexedAssetsToFrame } from "./indexed-frame.js";
import { applySceneOcclusionToFrame } from "./occlusion.js";
import { applyPaletteLightingToFrame } from "./palette-light-frame.js";

export const resolveClassicRuntimeSceneFrame = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  options: ResolveRuntimeSceneFrameOptions = {},
): ResolvedFrame => {
  const frame = resolveBaseRuntimeSceneFrame(bundle, world, options);
  const sceneId: Id<"scene"> = options.sceneId ?? world.story.currentSceneId;
  const elevated = applyNavigationElevationToFrame(bundle, world, frame, sceneId);
  const indexed = applyIndexedAssetsToFrame(bundle, elevated);
  const occluded = applySceneOcclusionToFrame(bundle, indexed, sceneId, world);
  return applyPaletteLightingToFrame(bundle, world, occluded, sceneId);
};
