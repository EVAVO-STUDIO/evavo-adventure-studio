import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import { validateProfiledNavigationMovementCompatibility } from "@evavo/adventure-scene-runtime/profiled-movement";
import { addSaveGameIssue, type SaveGameCompatibilityIssue } from "./errors.js";
import { validateSaveGameProfiledCamera } from "./profiled-camera.js";
import type { SaveGame } from "./schema.js";

type SceneComposition = NonNullable<RuntimeBundle["sceneInstances"]>["scenes"][number];
type SceneActorInstance = SceneComposition["actorInstances"][number];
type SceneObjectInstance = SceneComposition["objectInstances"][number];

export const authoredActorInstances = (bundle: RuntimeBundle) =>
  (bundle.sceneInstances?.scenes ?? []).flatMap((composition) =>
    composition.actorInstances.map((instance: SceneActorInstance) => ({
      instance,
      sceneId: composition.sceneId,
    })),
  );

export const authoredObjectInstances = (bundle: RuntimeBundle) =>
  (bundle.sceneInstances?.scenes ?? []).flatMap((composition) =>
    composition.objectInstances.map((instance: SceneObjectInstance) => ({
      instance,
      sceneId: composition.sceneId,
    })),
  );

const samePoint = (
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): boolean => Math.abs(left.x - right.x) <= 1e-7 && Math.abs(left.y - right.y) <= 1e-7;

export const validateSavedMovement = (
  bundle: RuntimeBundle,
  save: SaveGame,
  savedActorIds: ReadonlySet<string>,
  key: string,
  movement: SaveGame["world"]["movements"][string],
  issues: SaveGameCompatibilityIssue[],
): void => {
  const segment = movement.route.segments[movement.nextSegmentIndex];
  if (
    key !== movement.actorInstanceId ||
    !savedActorIds.has(movement.actorInstanceId) ||
    movement.nextSegmentIndex >= movement.route.segments.length ||
    !segment ||
    movement.distanceAlongSegment > segment.distance
  ) {
    addSaveGameIssue(
      issues,
      "invalid-movement",
      `world.movements.${key}`,
      `Saved movement for actor instance '${key}' is invalid.`,
    );
    return;
  }
  if (!movement.profiled) return;

  if (
    movement.profiled.actorInstanceId !== movement.actorInstanceId ||
    bundle.playFeelProfileId !== movement.profiled.profileId
  ) {
    addSaveGameIssue(
      issues,
      "invalid-profiled-movement",
      `world.movements.${key}.profiled.profileId`,
      "Saved profiled movement does not match its actor or runtime bundle profile.",
    );
  }
  for (const profiledIssue of validateProfiledNavigationMovementCompatibility({
    state: movement.profiled,
    route: movement.route,
    logicalTicksPerSecond: bundle.presentation.logicalTicksPerSecond,
  })) {
    addSaveGameIssue(
      issues,
      "invalid-profiled-movement",
      `world.movements.${key}.profiled.${profiledIssue.path}`,
      profiledIssue.message,
    );
  }
  const actorState = save.world.actorInstances[movement.actorInstanceId];
  if (actorState && !samePoint(actorState.position, movement.profiled.extension.motion.position)) {
    addSaveGameIssue(
      issues,
      "invalid-profiled-movement",
      `world.actorInstances.${movement.actorInstanceId}.position`,
      "Saved actor position does not match its profiled movement state.",
    );
  }
};

export const validateSavedCamera = (
  bundle: RuntimeBundle,
  save: SaveGame,
  issues: SaveGameCompatibilityIssue[],
): void => {
  const state = save.interface.profiledCamera;
  if (!state) return;
  for (const cameraIssue of validateSaveGameProfiledCamera({
    bundle,
    world: save.world as InteractiveRuntimeWorldState,
    state,
  })) {
    addSaveGameIssue(issues, "invalid-profiled-camera", cameraIssue.path, cameraIssue.message);
  }
};
