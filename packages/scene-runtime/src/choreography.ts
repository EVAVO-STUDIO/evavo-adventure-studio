import { applyActions, type RuntimeEvent } from "@evavo/adventure-core";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type {
  InteractionChoreography,
  InteractionChoreographyBeat,
} from "@evavo/adventure-scene-instances/staging";
import {
  setActorInstanceAnimation,
  setObjectInstanceState,
  type RuntimeWorldState,
} from "./index.js";
import { actorsById, resolveAnimationFacing } from "./movement-shared.js";
import { stagingForScene } from "./staging.js";

export interface ActiveInteractionChoreography {
  readonly choreographyId: Id<"interaction-choreography">;
  readonly interactionId: Id<"interaction">;
  readonly actorInstanceId: Id<"actor-instance">;
  readonly beatIndex: number;
  readonly holdTicksRemaining: number;
  readonly waitingForAnimation: boolean;
}

export type InteractionChoreographyEvent =
  | {
      readonly kind: "choreography-started";
      readonly choreographyId: Id<"interaction-choreography">;
      readonly actorInstanceId: Id<"actor-instance">;
    }
  | {
      readonly kind: "choreography-sound-requested";
      readonly choreographyId: Id<"interaction-choreography">;
      readonly cueId: string;
    }
  | {
      readonly kind: "choreography-completed";
      readonly choreographyId: Id<"interaction-choreography">;
      readonly actorInstanceId: Id<"actor-instance">;
    };

export interface InteractionChoreographyTransition {
  readonly state: RuntimeWorldState;
  readonly active: ActiveInteractionChoreography | null;
  readonly runtimeEvents: readonly RuntimeEvent[];
  readonly choreographyEvents: readonly InteractionChoreographyEvent[];
}

export const interactionChoreographyFor = (
  bundle: RuntimeBundle,
  sceneId: Id<"scene">,
  interactionId: Id<"interaction">,
  approachSlotId?: Id<"approach-slot"> | null,
): InteractionChoreography | null => {
  const staging = stagingForScene(bundle.sceneStaging, sceneId);
  if (!staging) return null;
  const candidates = staging.interactionChoreographies
    .filter((candidate) => candidate.interactionId === interactionId)
    .filter(
      (candidate) =>
        candidate.approachSlotIds.length === 0 ||
        (!!approachSlotId && candidate.approachSlotIds.includes(approachSlotId)),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  return candidates[0] ?? null;
};

const animateActor = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  actorInstanceId: Id<"actor-instance">,
  beat: Extract<InteractionChoreographyBeat, { readonly kind: "actor-animation" }>,
): RuntimeWorldState => {
  const runtime = world.actorInstances[actorInstanceId];
  if (!runtime) return world;
  const actor = actorsById(bundle).get(runtime.actorId);
  if (!actor) return world;
  const facing = resolveAnimationFacing(
    actor,
    beat.animationState,
    beat.facing ?? runtime.facing,
    runtime.facing,
  );
  return setActorInstanceAnimation(bundle, world, actorInstanceId, beat.animationState, facing);
};

const applyImmediateBeat = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  active: ActiveInteractionChoreography,
  choreography: InteractionChoreography,
  beat: InteractionChoreographyBeat,
): InteractionChoreographyTransition => {
  switch (beat.kind) {
    case "actor-animation": {
      const state = animateActor(bundle, world, active.actorInstanceId, beat);
      return {
        state,
        active: {
          ...active,
          beatIndex: active.beatIndex + 1,
          waitingForAnimation: beat.waitForCompletion,
        },
        runtimeEvents: [],
        choreographyEvents: [],
      };
    }
    case "object-state": {
      const state = setObjectInstanceState(bundle, world, beat.objectId, beat.stateId);
      return {
        state,
        active: { ...active, beatIndex: active.beatIndex + 1 },
        runtimeEvents: [
          { kind: "object-state-changed", objectId: beat.objectId, state: beat.stateId },
        ],
        choreographyEvents: [],
      };
    }
    case "sequence": {
      const transition = applyActions(world.story, [
        { kind: "play-sequence", sequenceId: beat.sequenceId },
      ]);
      return {
        state: { ...world, story: transition.state },
        active: { ...active, beatIndex: active.beatIndex + 1 },
        runtimeEvents: transition.events,
        choreographyEvents: [],
      };
    }
    case "sound":
      return {
        state: world,
        active: { ...active, beatIndex: active.beatIndex + 1 },
        runtimeEvents: [],
        choreographyEvents: [
          {
            kind: "choreography-sound-requested",
            choreographyId: choreography.id,
            cueId: beat.cueId,
          },
        ],
      };
    case "hold":
      return {
        state: world,
        active: {
          ...active,
          beatIndex: active.beatIndex + 1,
          holdTicksRemaining: beat.ticks,
        },
        runtimeEvents: [],
        choreographyEvents: [],
      };
  }
};

const finishChoreography = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  active: ActiveInteractionChoreography,
  choreography: InteractionChoreography,
): InteractionChoreographyTransition => {
  let state = world;
  if (choreography.recoveryAnimationState) {
    const runtime = state.actorInstances[active.actorInstanceId];
    const actor = runtime ? actorsById(bundle).get(runtime.actorId) : null;
    if (runtime && actor) {
      const facing = resolveAnimationFacing(
        actor,
        choreography.recoveryAnimationState,
        runtime.facing,
        runtime.facing,
      );
      state = setActorInstanceAnimation(
        bundle,
        state,
        active.actorInstanceId,
        choreography.recoveryAnimationState,
        facing,
      );
    }
  }
  return {
    state,
    active: null,
    runtimeEvents: [],
    choreographyEvents: [
      {
        kind: "choreography-completed",
        choreographyId: choreography.id,
        actorInstanceId: active.actorInstanceId,
      },
    ],
  };
};

const advanceImmediateBeats = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  active: ActiveInteractionChoreography,
  choreography: InteractionChoreography,
): InteractionChoreographyTransition => {
  let state = world;
  let current: ActiveInteractionChoreography | null = active;
  const runtimeEvents: RuntimeEvent[] = [];
  const choreographyEvents: InteractionChoreographyEvent[] = [];

  while (current && current.holdTicksRemaining === 0 && !current.waitingForAnimation) {
    const beat = choreography.beats[current.beatIndex];
    if (!beat) {
      const finished = finishChoreography(bundle, state, current, choreography);
      return {
        state: finished.state,
        active: null,
        runtimeEvents: [...runtimeEvents, ...finished.runtimeEvents],
        choreographyEvents: [...choreographyEvents, ...finished.choreographyEvents],
      };
    }
    const transition = applyImmediateBeat(bundle, state, current, choreography, beat);
    state = transition.state;
    current = transition.active;
    runtimeEvents.push(...transition.runtimeEvents);
    choreographyEvents.push(...transition.choreographyEvents);
  }

  return { state, active: current, runtimeEvents, choreographyEvents };
};

export const beginInteractionChoreography = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  actorInstanceId: Id<"actor-instance">,
  choreography: InteractionChoreography,
): InteractionChoreographyTransition => {
  let state = world;
  const runtime = state.actorInstances[actorInstanceId];
  if (choreography.brakingAnimationState && runtime) {
    const actor = actorsById(bundle).get(runtime.actorId);
    if (actor) {
      const facing = resolveAnimationFacing(
        actor,
        choreography.brakingAnimationState,
        runtime.facing,
        runtime.facing,
      );
      state = setActorInstanceAnimation(
        bundle,
        state,
        actorInstanceId,
        choreography.brakingAnimationState,
        facing,
      );
    }
  }
  const active: ActiveInteractionChoreography = {
    choreographyId: choreography.id,
    interactionId: choreography.interactionId,
    actorInstanceId,
    beatIndex: 0,
    holdTicksRemaining: 0,
    waitingForAnimation: false,
  };
  const advanced = advanceImmediateBeats(bundle, state, active, choreography);
  return {
    ...advanced,
    choreographyEvents: [
      {
        kind: "choreography-started",
        choreographyId: choreography.id,
        actorInstanceId,
      },
      ...advanced.choreographyEvents,
    ],
  };
};

export const advanceInteractionChoreography = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  active: ActiveInteractionChoreography,
  ticks: number,
): InteractionChoreographyTransition => {
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError("Choreography advancement must be a non-negative safe integer.");
  }
  const sceneId = world.actorInstances[active.actorInstanceId]?.sceneId ?? world.story.currentSceneId;
  const choreography = interactionChoreographyFor(
    bundle,
    sceneId,
    active.interactionId,
    null,
  );
  if (!choreography || choreography.id !== active.choreographyId) {
    return { state: world, active: null, runtimeEvents: [], choreographyEvents: [] };
  }

  let next = active;
  if (next.holdTicksRemaining > 0) {
    next = {
      ...next,
      holdTicksRemaining: Math.max(0, next.holdTicksRemaining - ticks),
    };
  }
  if (next.waitingForAnimation) {
    const runtime = world.actorInstances[next.actorInstanceId];
    if (runtime?.playback.completed) {
      next = { ...next, waitingForAnimation: false };
    }
  }
  if (next.holdTicksRemaining > 0 || next.waitingForAnimation) {
    return { state: world, active: next, runtimeEvents: [], choreographyEvents: [] };
  }
  return advanceImmediateBeats(bundle, world, next, choreography);
};
