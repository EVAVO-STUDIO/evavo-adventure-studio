import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type {
  MultiProtagonistState,
  ProtagonistId,
} from "@evavo/adventure-scene-runtime/multi-protagonist";

export const actorInstanceIdForProtagonist = (
  bundle: Pick<RuntimeBundle, "sceneInstances">,
  state: MultiProtagonistState,
  protagonistId: ProtagonistId = state.activeProtagonistId,
): Id<"actor-instance"> => {
  const protagonist = state.protagonists[protagonistId];
  if (!protagonist) throw new Error(`Unknown protagonist '${protagonistId}'.`);
  const candidates = (bundle.sceneInstances?.scenes ?? [])
    .filter((scene) => scene.sceneId === protagonist.location.sceneId)
    .flatMap((scene) => scene.actorInstances)
    .filter((instance) => instance.actorId === protagonistId && instance.mobility === "walkable");
  if (candidates.length !== 1) {
    throw new Error(
      `Protagonist '${protagonistId}' requires exactly one walkable actor instance in scene ` +
        `'${protagonist.location.sceneId}', found ${candidates.length}.`,
    );
  }
  return candidates[0]!.id;
};
