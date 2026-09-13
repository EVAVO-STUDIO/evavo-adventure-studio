import type { Id } from "@evavo/adventure-project-schema";
import type { ResolvedCamera, ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { resolveRuntimeSceneFrame, type RuntimeWorldState } from "./index.js";

export interface ResolveStagedRuntimeSceneFrameOptions {
  readonly sceneId?: Id<"scene">;
  readonly camera?: ResolvedCamera;
}

/**
 * Compatibility alias retained for callers that adopted the staging preview API
 * before staged perspective became part of canonical runtime frame resolution.
 * `resolveRuntimeSceneFrame` now applies scene staging directly, so this wrapper
 * intentionally performs no second scaling pass.
 */
export const resolveStagedRuntimeSceneFrame = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  options: ResolveStagedRuntimeSceneFrameOptions = {},
): ResolvedFrame => resolveRuntimeSceneFrame(bundle, world, options);
