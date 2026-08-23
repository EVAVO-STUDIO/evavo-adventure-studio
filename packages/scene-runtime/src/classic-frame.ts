import type { Id } from "@evavo/adventure-project-schema";
import type { ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  resolveRuntimeSceneFrame as resolveBaseRuntimeSceneFrame,
  type ResolveRuntimeSceneFrameOptions,
  type RuntimeWorldState,
} from "./index.js";
import { applySceneOcclusionToFrame } from "./occlusion.js";

export const resolveClassicRuntimeSceneFrame = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  options: ResolveRuntimeSceneFrameOptions = {},
): ResolvedFrame => {
  const frame = resolveBaseRuntimeSceneFrame(bundle, world, options);
  const sceneId: Id<"scene"> = options.sceneId ?? world.story.currentSceneId;
  return applySceneOcclusionToFrame(bundle, frame, sceneId);
};
