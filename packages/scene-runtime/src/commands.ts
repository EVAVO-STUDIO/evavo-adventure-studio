import type { RuntimeEvent } from "@evavo/adventure-core";
import {
  defaultInteractionPolicy,
  resolveHotspotCommand,
} from "@evavo/adventure-interaction";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  advanceInteractionChoreography,
  beginInteractionChoreography,
  interactionChoreographyFor,
  type ActiveInteractionChoreography,
  type InteractionChoreographyEvent,
} from "./choreography.js";
import { applyDialogueRequestEvents } from "./dialogue.js";
import { setActorInstanceAnimation } from "./index.js";
import {
  executeSceneObjectCommand,
  resolveSceneObjectHotspots,
  type SceneObjectCommandExecution,
} from "./interactions.js";
import {
  type ActorMovementEvent,
  advanceNavigableRuntimeWorld,
  type BeginActorMovementResult,
  beginActorMovement,
  createInitialNavigableRuntimeWorldState,
  type NavigableRuntimeWorldState,
} from "./movement.js";
import { actorsById, resolveAnimationFacing } from "./movement-shared.js";
import { resolveRuntimeInteractionApproach } from "./staging.js";

export interface PendingSceneObjectCommand {
  readonly actorInstanceId: Id<"actor-instance">;
  readonly actorId: Id<"actor">;
  readonly objectInstanceId: Id<"object">;
  readonly verb: string;
  readonly itemId: Id<"item"> | null;
  readonly approachSlotId?: Id<"approach-slot">;
  readonly approachFacing?: string;
  readonly approachAnimationState?: string;
}

export interface InteractiveRuntimeWorldState extends NavigableRuntimeWorldState {
  readonly pendingObjectCommands: Readonly<Record<string, PendingSceneObjectCommand>>;
  readonly activeInteractionChoreographies: Readonly<Record<string, ActiveInteractionChoreography>>;
}

export type SceneCommandEvent =
  | {
      readonly kind: "object-command-queued";
      readonly actorInstanceId: Id<"actor-instance">;
      readonly objectInstanceId: Id<"object">;
      readonly verb: string;
    }
  | {
      readonly kind: "object-command-executed";
      readonly actorInstanceId: Id<"actor-instance">;
      readonly objectInstanceId: Id<"object">;
      readonly verb: string;
      readonly runtimeEvents: readonly RuntimeEvent[];
    }
  | {
      readonly kind: "object-command-fallback";
      readonly actorInstanceId: Id<"actor-instance">;
      readonly objectInstanceId: Id<"object">;
      readonly verb: string;
      readonly text: string;
    }
  | {
      readonly kind: "object-command-rejected";
      readonly actorInstanceId: Id<"actor-instance">;
      readonly objectInstanceId: Id<"object">;
      readonly verb: string;
      readonly reason: string;
    }
  | {
      readonly kind: "object-command-aborted";
      readonly actorInstanceId: Id<"actor-instance">;
      readonly objectInstanceId: Id<"object">;
      readonly reason: "movement-cancelled" | "target-unavailable";
    };

export interface InteractiveRuntimeWorldTransition {
  readonly state: InteractiveRuntimeWorldState;
  readonly animationEvents: ReturnType<typeof advanceNavigableRuntimeWorld>["animationEvents"];
  readonly movementEvents: readonly ActorMovementEvent[];
  readonly commandEvents: readonly SceneCommandEvent[];
  readonly choreographyEvents: readonly InteractionChoreographyEvent[];
}

export type QueueSceneObjectCommandResult =
  | {
      readonly kind: "queued";
      readonly state: InteractiveRuntimeWorldState;
      readonly movement: Extract<BeginActorMovementResult, { readonly kind: "started" }> | null;
      readonly event: Extract<SceneCommandEvent, { readonly kind: "object-command-queued" }>;
      readonly choreographyEvents?: readonly InteractionChoreographyEvent[];
    }
  | {
      readonly kind: "resolved";
      readonly state: InteractiveRuntimeWorldState;
      readonly execution: Exclude<SceneObjectCommandExecution, { readonly kind: "missing-target" }>;
      readonly event: Exclude<
        SceneCommandEvent,
        { readonly kind: "object-command-queued" } | { readonly kind: "object-command-aborted" }
      >;
    }
  | {
      readonly kind: "missing-target";
      readonly state: InteractiveRuntimeWorldState;
      readonly objectInstanceId: Id<"object">;
    }
  | {
      readonly kind: "movement-rejected";
      readonly state: InteractiveRuntimeWorldState;
      readonly movement: Exclude<
        BeginActorMovementResult,
        { readonly kind: "started" } | { readonly kind: "already-there" }
      >;
    };

const pendingKey = (actorInstanceId: Id<"actor-instance">): string => actorInstanceId;

const mergeRuntimeWorld = (
  state: InteractiveRuntimeWorldState,
  executionState: SceneObjectCommandExecution["state"],
): InteractiveRuntimeWorldState => ({
  ...state,
  story: executionState.story,
  actorInstances: executionState.actorInstances,
});

const orientActorForPendingCommand = (
  bundle: RuntimeBundle,
  state: InteractiveRuntimeWorldState,
  pending: PendingSceneObjectCommand,
): InteractiveRuntimeWorldState => {
  if (!pending.approachFacing && !pending.approachAnimationState) return state;
  const runtime = state.actorInstances[pending.actorInstanceId];
  if (!runtime) return state;
  const actor = actorsById(bundle).get(runtime.actorId);
  if (!actor) return state;
  const animationState = pending.approachAnimationState ?? runtime.animationState;
  const desiredFacing = pending.approachFacing ?? runtime.facing;
  const facing = resolveAnimationFacing(actor, animationState, desiredFacing, runtime.facing);
  const oriented = setActorInstanceAnimation(
    bundle,
    state,
    pending.actorInstanceId,
    animationState,
    facing,
  );
  return { ...state, actorInstances: oriented.actorInstances };
};

const commandEventFromExecution = (
  pending: PendingSceneObjectCommand,
  execution: Exclude<
    SceneObjectCommandExecution,
    { readonly kind: "missing-target" } | { readonly kind: "executed" }
  >,
): Extract<
  SceneCommandEvent,
  { readonly kind: "object-command-fallback" } | { readonly kind: "object-command-rejected" }
> => {
  switch (execution.kind) {
    case "fallback":
      return {
        kind: "object-command-fallback",
        actorInstanceId: pending.actorInstanceId,
        objectInstanceId: pending.objectInstanceId,
        verb: pending.verb,
        text: execution.execution.resolution.text,
      };
    case "rejected":
      return {
        kind: "object-command-rejected",
        actorInstanceId: pending.actorInstanceId,
        objectInstanceId: pending.objectInstanceId,
        verb: pending.verb,
        reason: execution.execution.result.reason,
      };
  }
};

const executePendingCommand = (
  bundle: RuntimeBundle,
  state: InteractiveRuntimeWorldState,
  pending: PendingSceneObjectCommand,
): {
  readonly state: InteractiveRuntimeWorldState;
  readonly event: SceneCommandEvent;
  readonly execution: SceneObjectCommandExecution;
} => {
  const execution = executeSceneObjectCommand(bundle, state, {
    actorId: pending.actorId,
    objectInstanceId: pending.objectInstanceId,
    verb: pending.verb,
    itemId: pending.itemId,
  });
  if (execution.kind === "missing-target") {
    return {
      state,
      execution,
      event: {
        kind: "object-command-aborted",
        actorInstanceId: pending.actorInstanceId,
        objectInstanceId: pending.objectInstanceId,
        reason: "target-unavailable",
      },
    };
  }

  const merged = mergeRuntimeWorld(state, execution.state);
  if (execution.kind === "executed") {
    const dialogue = applyDialogueRequestEvents(bundle, merged, execution.execution.result.transition.events);
    return {
      state: dialogue.state,
      execution,
      event: {
        kind: "object-command-executed",
        actorInstanceId: pending.actorInstanceId,
        objectInstanceId: pending.objectInstanceId,
        verb: pending.verb,
        runtimeEvents: dialogue.events,
      },
    };
  }

  return {
    state: merged,
    execution,
    event: commandEventFromExecution(pending, execution),
  };
};

interface BegunPendingChoreography {
  readonly state: InteractiveRuntimeWorldState;
  readonly choreographyEvents: readonly InteractionChoreographyEvent[];
}

const beginPendingChoreography = (
  bundle: RuntimeBundle,
  state: InteractiveRuntimeWorldState,
  pending: PendingSceneObjectCommand,
): BegunPendingChoreography | null => {
  const target = resolveSceneObjectHotspots(bundle, state).find(
    (candidate) => candidate.objectInstanceId === pending.objectInstanceId,
  );
  if (!target) return null;

  const resolution = resolveHotspotCommand(
    state.story,
    target.hotspot,
    {
      actorId: pending.actorId,
      verb: pending.verb,
      targetHotspotId: target.hotspot.id,
      itemId: pending.itemId,
    },
    defaultInteractionPolicy,
    bundle.scenes.find((scene) => scene.id === state.story.currentSceneId)?.fallbackText,
  );
  if (resolution.kind !== "matched") return null;
  const choreography = interactionChoreographyFor(
    bundle,
    state.story.currentSceneId,
    resolution.interaction.id,
    pending.approachSlotId ?? null,
  );
  if (!choreography) return null;

  const started = beginInteractionChoreography(
    bundle,
    state,
    pending.actorInstanceId,
    choreography,
  );
  if (!started.active) return null;
  return {
    state: {
      ...state,
      story: started.state.story,
      actorInstances: started.state.actorInstances,
      activeInteractionChoreographies: {
        ...state.activeInteractionChoreographies,
        [pendingKey(pending.actorInstanceId)]: started.active,
      },
    },
    choreographyEvents: started.choreographyEvents,
  };
};

const queuedEvent = (
  pending: PendingSceneObjectCommand,
): Extract<SceneCommandEvent, { readonly kind: "object-command-queued" }> => ({
  kind: "object-command-queued",
  actorInstanceId: pending.actorInstanceId,
  objectInstanceId: pending.objectInstanceId,
  verb: pending.verb,
});

const resolveAfterApproach = (
  bundle: RuntimeBundle,
  state: InteractiveRuntimeWorldState,
  pending: PendingSceneObjectCommand,
): QueueSceneObjectCommandResult => {
  const stagedState = orientActorForPendingCommand(bundle, state, pending);
  const choreography = beginPendingChoreography(bundle, stagedState, pending);
  if (choreography) {
    return {
      kind: "queued",
      state: choreography.state,
      movement: null,
      event: queuedEvent(pending),
      choreographyEvents: choreography.choreographyEvents,
    };
  }
  const resolved = executePendingCommand(bundle, stagedState, pending);
  if (resolved.execution.kind === "missing-target") {
    return { kind: "missing-target", state: stagedState, objectInstanceId: pending.objectInstanceId };
  }
  return {
    kind: "resolved",
    state: resolved.state,
    execution: resolved.execution,
    event: resolved.event as Exclude<
      SceneCommandEvent,
      { readonly kind: "object-command-queued" } | { readonly kind: "object-command-aborted" }
    >,
  };
};

export const createInitialInteractiveRuntimeWorldState = (
  bundle: RuntimeBundle,
  seed?: number,
): InteractiveRuntimeWorldState => ({
  ...createInitialNavigableRuntimeWorldState(bundle, seed),
  pendingObjectCommands: {},
  activeInteractionChoreographies: {},
});

export const queueSceneObjectCommand = (
  bundle: RuntimeBundle,
  state: InteractiveRuntimeWorldState,
  actorInstanceId: Id<"actor-instance">,
  objectInstanceId: Id<"object">,
  verb: string,
  itemId: Id<"item"> | null = null,
): QueueSceneObjectCommandResult => {
  const actorRuntime = state.actorInstances[actorInstanceId];
  if (!actorRuntime) {
    return {
      kind: "movement-rejected",
      state,
      movement: {
        kind: "rejected",
        reason: "missing-instance",
        state,
      },
    };
  }
  const target = resolveSceneObjectHotspots(bundle, state).find(
    (candidate) => candidate.objectInstanceId === objectInstanceId,
  );
  if (!target) {
    return { kind: "missing-target", state, objectInstanceId };
  }

  const approach = resolveRuntimeInteractionApproach(
    bundle,
    state,
    actorInstanceId,
    objectInstanceId,
    verb,
    itemId,
  );
  const pending: PendingSceneObjectCommand = {
    actorInstanceId,
    actorId: actorRuntime.actorId,
    objectInstanceId,
    verb,
    itemId,
    ...(approach?.slot.id ? { approachSlotId: approach.slot.id } : {}),
    ...(approach?.slot.facing ? { approachFacing: approach.slot.facing } : {}),
    ...(approach?.slot.animationState
      ? { approachAnimationState: approach.slot.animationState }
      : {}),
  };
  const destination = approach?.slot.position ?? target.hotspot.walkTo;
  if (!destination) {
    const stateWithPending = {
      ...state,
      pendingObjectCommands: {
        ...state.pendingObjectCommands,
        [pendingKey(actorInstanceId)]: pending,
      },
    };
    const resolved = resolveAfterApproach(bundle, stateWithPending, pending);
    if (resolved.kind !== "queued") {
      const pendingObjectCommands = { ...resolved.state.pendingObjectCommands };
      delete pendingObjectCommands[pendingKey(actorInstanceId)];
      return { ...resolved, state: { ...resolved.state, pendingObjectCommands } };
    }
    return resolved;
  }

  const movement = beginActorMovement(bundle, state, actorInstanceId, destination);
  if (movement.kind === "already-there") {
    const stateWithPending = {
      ...state,
      pendingObjectCommands: {
        ...state.pendingObjectCommands,
        [pendingKey(actorInstanceId)]: pending,
      },
    };
    const resolved = resolveAfterApproach(bundle, stateWithPending, pending);
    if (resolved.kind !== "queued") {
      const pendingObjectCommands = { ...resolved.state.pendingObjectCommands };
      delete pendingObjectCommands[pendingKey(actorInstanceId)];
      return { ...resolved, state: { ...resolved.state, pendingObjectCommands } };
    }
    return resolved;
  }
  if (movement.kind !== "started") {
    return { kind: "movement-rejected", state, movement };
  }

  const nextState: InteractiveRuntimeWorldState = {
    ...movement.state,
    pendingObjectCommands: {
      ...state.pendingObjectCommands,
      [pendingKey(actorInstanceId)]: pending,
    },
    activeInteractionChoreographies: state.activeInteractionChoreographies,
  };
  return { kind: "queued", state: nextState, movement, event: queuedEvent(pending) };
};

export const advanceInteractiveRuntimeWorld = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  ticks: number,
): InteractiveRuntimeWorldTransition => {
  const activeAtStart = { ...world.activeInteractionChoreographies };
  const advanced = advanceNavigableRuntimeWorld(bundle, world, ticks);
  let state: InteractiveRuntimeWorldState = {
    ...advanced.state,
    pendingObjectCommands: world.pendingObjectCommands,
    activeInteractionChoreographies: world.activeInteractionChoreographies,
  };
  const pending = { ...state.pendingObjectCommands };
  const active = { ...state.activeInteractionChoreographies };
  const commandEvents: SceneCommandEvent[] = [];
  const choreographyEvents: InteractionChoreographyEvent[] = [];

  for (const movementEvent of advanced.movementEvents) {
    const command = pending[pendingKey(movementEvent.actorInstanceId)];
    if (!command) continue;
    if (movementEvent.kind === "movement-cancelled") {
      delete pending[pendingKey(movementEvent.actorInstanceId)];
      delete active[pendingKey(movementEvent.actorInstanceId)];
      commandEvents.push({
        kind: "object-command-aborted",
        actorInstanceId: command.actorInstanceId,
        objectInstanceId: command.objectInstanceId,
        reason: "movement-cancelled",
      });
      continue;
    }
    if (movementEvent.kind !== "movement-completed") continue;

    const resolved = resolveAfterApproach(
      bundle,
      { ...state, pendingObjectCommands: pending, activeInteractionChoreographies: active },
      command,
    );
    state = resolved.state;
    if (resolved.kind === "queued" && resolved.state.activeInteractionChoreographies[pendingKey(command.actorInstanceId)]) {
      active[pendingKey(command.actorInstanceId)] = resolved.state.activeInteractionChoreographies[
        pendingKey(command.actorInstanceId)
      ]!;
      commandEvents.push(resolved.event);
      choreographyEvents.push(...(resolved.choreographyEvents ?? []));
      continue;
    }
    delete pending[pendingKey(command.actorInstanceId)];
    delete active[pendingKey(command.actorInstanceId)];
    if (resolved.kind === "resolved") commandEvents.push(resolved.event);
    else if (resolved.kind === "missing-target") {
      commandEvents.push({
        kind: "object-command-aborted",
        actorInstanceId: command.actorInstanceId,
        objectInstanceId: command.objectInstanceId,
        reason: "target-unavailable",
      });
    }
  }

  for (const [key, choreography] of Object.entries(activeAtStart).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const command = pending[key];
    if (!command || !active[key]) continue;
    const advancedChoreography = advanceInteractionChoreography(bundle, state, choreography, ticks);
    state = {
      ...state,
      story: advancedChoreography.state.story,
      actorInstances: advancedChoreography.state.actorInstances,
    };
    choreographyEvents.push(...advancedChoreography.choreographyEvents);
    if (advancedChoreography.active) {
      active[key] = advancedChoreography.active;
      continue;
    }

    delete active[key];
    delete pending[key];
    const resolved = executePendingCommand(
      bundle,
      { ...state, pendingObjectCommands: pending, activeInteractionChoreographies: active },
      command,
    );
    state = resolved.state;
    commandEvents.push(resolved.event);
  }

  return {
    state: {
      ...state,
      pendingObjectCommands: pending,
      activeInteractionChoreographies: active,
    },
    animationEvents: advanced.animationEvents,
    movementEvents: advanced.movementEvents,
    commandEvents,
    choreographyEvents,
  };
};
