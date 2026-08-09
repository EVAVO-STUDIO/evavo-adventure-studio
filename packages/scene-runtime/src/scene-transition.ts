import { startAnimation } from "@evavo/adventure-animation";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { RuntimeWorldState } from "./index.js";

export class RuntimeActorSceneTransitionError extends Error {
  readonly actorInstanceId: Id<"actor-instance">;
  readonly sceneId: Id<"scene">;
  readonly entranceId: Id<"entrance">;

  constructor(
    actorInstanceId: Id<"actor-instance">,
    sceneId: Id<"scene">,
    entranceId: Id<"entrance">,
    detail: string,
  ) {
    super(
      `Actor instance '${actorInstanceId}' cannot enter '${sceneId}' through ` + `'${entranceId}': ${detail}`,
    );
    this.name = "RuntimeActorSceneTransitionError";
    this.actorInstanceId = actorInstanceId;
    this.sceneId = sceneId;
    this.entranceId = entranceId;
  }
}

const arrivalAnimation = (
  bundle: Pick<RuntimeBundle, "actors">,
  actorInstance: RuntimeWorldState["actorInstances"][string],
  desiredFacing: string,
) => {
  const actor = bundle.actors.find((candidate) => candidate.id === actorInstance.actorId);
  if (!actor) {
    throw new Error(`Actor '${actorInstance.actorId}' does not exist.`);
  }

  const idle = actor.animations.filter((clip) => clip.state === "idle");
  const currentState = actor.animations.filter((clip) => clip.state === actorInstance.animationState);
  const candidates = idle.length > 0 ? idle : currentState;
  const clip =
    candidates.find((candidate) => candidate.facing === desiredFacing) ??
    candidates.find((candidate) => candidate.facing === actorInstance.facing) ??
    [...candidates].sort((left, right) => left.id.localeCompare(right.id))[0];

  if (!clip) {
    throw new Error(
      `Actor '${actor.id}' has no idle or '${actorInstance.animationState}' arrival animation.`,
    );
  }
  return { actor, clip };
};

export const relocateRuntimeActorToEntrance = <TWorld extends RuntimeWorldState>(
  bundle: Pick<RuntimeBundle, "actors" | "scenes">,
  world: TWorld,
  actorInstanceId: Id<"actor-instance">,
  sceneId: Id<"scene">,
  entranceId: Id<"entrance">,
): TWorld => {
  const actorInstance = world.actorInstances[actorInstanceId];
  if (!actorInstance) {
    throw new RuntimeActorSceneTransitionError(
      actorInstanceId,
      sceneId,
      entranceId,
      "the runtime actor instance is missing",
    );
  }
  const scene = bundle.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) {
    throw new RuntimeActorSceneTransitionError(
      actorInstanceId,
      sceneId,
      entranceId,
      "the destination scene is missing",
    );
  }
  const entrance = scene.entrances.find((candidate) => candidate.id === entranceId);
  if (!entrance) {
    throw new RuntimeActorSceneTransitionError(
      actorInstanceId,
      sceneId,
      entranceId,
      "the destination entrance is missing",
    );
  }

  const { actor, clip } = arrivalAnimation(bundle, actorInstance, entrance.facing);
  return {
    ...world,
    actorInstances: {
      ...world.actorInstances,
      [actorInstanceId]: {
        ...actorInstance,
        sceneId,
        position: entrance.position,
        facing: clip.facing,
        animationState: clip.state,
        playback: startAnimation(actor, clip.id).state,
      },
    },
  };
};

export const reconcileRuntimeActorWithStoryLocation = <TWorld extends RuntimeWorldState>(
  bundle: Pick<RuntimeBundle, "actors" | "scenes">,
  world: TWorld,
  actorInstanceId: Id<"actor-instance">,
): TWorld => {
  const actorInstance = world.actorInstances[actorInstanceId];
  if (!actorInstance) {
    throw new RuntimeActorSceneTransitionError(
      actorInstanceId,
      world.story.currentSceneId,
      world.story.currentEntranceId,
      "the runtime actor instance is missing",
    );
  }
  if (actorInstance.sceneId === world.story.currentSceneId) {
    return world;
  }
  return relocateRuntimeActorToEntrance(
    bundle,
    world,
    actorInstanceId,
    world.story.currentSceneId,
    world.story.currentEntranceId,
  );
};
