import type { RuntimeEvent } from "@evavo/adventure-core";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  advanceInteractiveRuntimeWorld as advanceBaseInteractiveRuntimeWorld,
  queueSceneObjectCommand as queueBaseSceneObjectCommand,
  type InteractiveRuntimeWorldState,
  type InteractiveRuntimeWorldTransition,
  type QueueSceneObjectCommandResult,
  type SceneCommandEvent,
} from "./commands.js";
import { advanceRuntimeNarrativeSequences } from "./narrative.js";

export * from "./commands.js";

export interface InteractiveRuntimeNarrativeTransition
  extends InteractiveRuntimeWorldTransition {
  readonly runtimeEvents: readonly RuntimeEvent[];
}

const activeBlockingSequence = (
  bundle: Pick<RuntimeBundle, "sequences">,
  state: InteractiveRuntimeWorldState,
): boolean => {
  const active = new Set(
    state.story.activeSequences.map((sequence) => sequence.sequenceId),
  );
  return bundle.sequences.some(
    (sequence) => sequence.blocking && active.has(sequence.id),
  );
};

const clearSceneTransientState = (
  state: InteractiveRuntimeWorldState,
): InteractiveRuntimeWorldState => ({
  ...state,
  movements: {},
  pendingObjectCommands: {},
});

const clearTransientStateAfterSceneChange = (
  previousSceneId: Id<"scene">,
  state: InteractiveRuntimeWorldState,
): InteractiveRuntimeWorldState =>
  state.story.currentSceneId === previousSceneId
    ? state
    : clearSceneTransientState(state);

export const queueSceneObjectCommand = (
  bundle: RuntimeBundle,
  state: InteractiveRuntimeWorldState,
  actorInstanceId: Id<"actor-instance">,
  objectInstanceId: Id<"object">,
  verb: string,
  itemId: Id<"item"> | null = null,
): QueueSceneObjectCommandResult => {
  const previousSceneId = state.story.currentSceneId;
  const result = queueBaseSceneObjectCommand(
    bundle,
    state,
    actorInstanceId,
    objectInstanceId,
    verb,
    itemId,
  );
  return {
    ...result,
    state: clearTransientStateAfterSceneChange(previousSceneId, result.state),
  };
};

export const advanceInteractiveRuntimeWorld = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  ticks: number,
): InteractiveRuntimeNarrativeTransition => {
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError("World advancement must be a non-negative safe integer.");
  }

  let state = world;
  const animationEvents: InteractiveRuntimeWorldTransition["animationEvents"][number][] = [];
  const movementEvents: InteractiveRuntimeWorldTransition["movementEvents"][number][] = [];
  const commandEvents: SceneCommandEvent[] = [];
  const runtimeEvents: RuntimeEvent[] = [];

  for (let tick = 0; tick < ticks; tick += 1) {
    const blockingAtTickStart = activeBlockingSequence(bundle, state);
    const narrativeSceneId = state.story.currentSceneId;
    const narrative = advanceRuntimeNarrativeSequences(bundle, state, 1);
    state = clearTransientStateAfterSceneChange(
      narrativeSceneId,
      narrative.state,
    );
    runtimeEvents.push(...narrative.events);

    const heldMovements = state.movements;
    const heldPendingCommands = state.pendingObjectCommands;
    const baseInput = blockingAtTickStart
      ? { ...state, movements: {} }
      : state;
    const sceneBeforeBaseTick = baseInput.story.currentSceneId;
    const advanced = advanceBaseInteractiveRuntimeWorld(bundle, baseInput, 1);
    state = blockingAtTickStart
      ? {
          ...advanced.state,
          movements: heldMovements,
          pendingObjectCommands: heldPendingCommands,
        }
      : advanced.state;
    animationEvents.push(...advanced.animationEvents);
    movementEvents.push(...advanced.movementEvents);
    commandEvents.push(...advanced.commandEvents);
    for (const event of advanced.commandEvents) {
      if (event.kind === "object-command-executed") {
        runtimeEvents.push(...event.runtimeEvents);
      }
    }
    state = clearTransientStateAfterSceneChange(sceneBeforeBaseTick, state);
  }

  return {
    state,
    animationEvents,
    movementEvents,
    commandEvents,
    runtimeEvents,
  };
};
