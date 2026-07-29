import type { RuntimeEvent } from "@evavo/adventure-core";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  executeSceneObjectCommand,
  resolveSceneObjectHotspots,
  type SceneObjectCommand,
  type SceneObjectCommandExecution,
} from "./interactions.js";
import {
  advanceNavigableRuntimeWorld,
  beginActorMovement,
  createInitialNavigableRuntimeWorldState,
  type ActorMovementEvent,
  type BeginActorMovementResult,
  type NavigableRuntimeWorldState,
} from "./movement.js";

export interface PendingSceneObjectCommand {
  readonly actorInstanceId: Id<"actor-instance">;
  readonly actorId: Id<"actor">;
  readonly objectInstanceId: Id<"object">;
  readonly verb: string;
  readonly itemId: Id<"item"> | null;
}

export interface InteractiveRuntimeWorldState
  extends NavigableRuntimeWorldState {
  readonly pendingObjectCommands: Readonly<
    Record<string, PendingSceneObjectCommand>
  >;
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
  readonly animationEvents: ReturnType<
    typeof advanceNavigableRuntimeWorld
  >["animationEvents"];
  readonly movementEvents: readonly ActorMovementEvent[];
  readonly commandEvents: readonly SceneCommandEvent[];
}

export type QueueSceneObjectCommandResult =
  | {
      readonly kind: "queued";
      readonly state: InteractiveRuntimeWorldState;
      readonly movement: Extract<BeginActorMovementResult, { readonly kind: "started" }>;
      readonly event: Extract<
        SceneCommandEvent,
        { readonly kind: "object-command-queued" }
      >;
    }
  | {
      readonly kind: "resolved";
      readonly state: InteractiveRuntimeWorldState;
      readonly execution: Exclude<
        SceneObjectCommandExecution,
        { readonly kind: "missing-target" }
      >;
      readonly event: Exclude<
        SceneCommandEvent,
        | { readonly kind: "object-command-queued" }
        | { readonly kind: "object-command-aborted" }
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

const pendingKey = (actorInstanceId: Id<"actor-instance">): string =>
  actorInstanceId;

const mergeRuntimeWorld = (
  state: InteractiveRuntimeWorldState,
  executionState: SceneObjectCommandExecution["state"],
): InteractiveRuntimeWorldState => ({
  ...state,
  story: executionState.story,
  actorInstances: executionState.actorInstances,
});

const commandEventFromExecution = (
  pending: PendingSceneObjectCommand,
  execution: Exclude<
    SceneObjectCommandExecution,
    { readonly kind: "missing-target" }
  >,
): Exclude<
  SceneCommandEvent,
  | { readonly kind: "object-command-queued" }
  | { readonly kind: "object-command-aborted" }
> => {
  switch (execution.kind) {
    case "executed":
      return {
        kind: "object-command-executed",
        actorInstanceId: pending.actorInstanceId,
        objectInstanceId: pending.objectInstanceId,
        verb: pending.verb,
        runtimeEvents: execution.execution.result.transition.events,
      };
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
  return {
    state: mergeRuntimeWorld(state, execution.state),
    execution,
    event: commandEventFromExecution(pending, execution),
  };
};

export const createInitialInteractiveRuntimeWorldState = (
  bundle: RuntimeBundle,
  seed?: number,
): InteractiveRuntimeWorldState => ({
  ...createInitialNavigableRuntimeWorldState(bundle, seed),
  pendingObjectCommands: {},
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

  const pending: PendingSceneObjectCommand = {
    actorInstanceId,
    actorId: actorRuntime.actorId,
    objectInstanceId,
    verb,
    itemId,
  };
  const destination = target.hotspot.walkTo;
  if (!destination) {
    const resolved = executePendingCommand(bundle, state, pending);
    if (resolved.execution.kind === "missing-target") {
      return { kind: "missing-target", state, objectInstanceId };
    }
    return {
      kind: "resolved",
      state: resolved.state,
      execution: resolved.execution,
      event: resolved.event as Exclude<
        SceneCommandEvent,
        | { readonly kind: "object-command-queued" }
        | { readonly kind: "object-command-aborted" }
      >,
    };
  }

  const movement = beginActorMovement(
    bundle,
    state,
    actorInstanceId,
    destination,
  );
  if (movement.kind === "already-there") {
    const resolved = executePendingCommand(bundle, state, pending);
    if (resolved.execution.kind === "missing-target") {
      return { kind: "missing-target", state, objectInstanceId };
    }
    return {
      kind: "resolved",
      state: resolved.state,
      execution: resolved.execution,
      event: resolved.event as Exclude<
        SceneCommandEvent,
        | { readonly kind: "object-command-queued" }
        | { readonly kind: "object-command-aborted" }
      >,
    };
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
  };
  const event = {
    kind: "object-command-queued" as const,
    actorInstanceId,
    objectInstanceId,
    verb,
  };
  return { kind: "queued", state: nextState, movement, event };
};

export const advanceInteractiveRuntimeWorld = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  ticks: number,
): InteractiveRuntimeWorldTransition => {
  const advanced = advanceNavigableRuntimeWorld(bundle, world, ticks);
  let state: InteractiveRuntimeWorldState = {
    ...advanced.state,
    pendingObjectCommands: world.pendingObjectCommands,
  };
  const pending = { ...state.pendingObjectCommands };
  const commandEvents: SceneCommandEvent[] = [];

  for (const movementEvent of advanced.movementEvents) {
    const command = pending[pendingKey(movementEvent.actorInstanceId)];
    if (!command) {
      continue;
    }
    if (movementEvent.kind === "movement-cancelled") {
      delete pending[pendingKey(movementEvent.actorInstanceId)];
      commandEvents.push({
        kind: "object-command-aborted",
        actorInstanceId: command.actorInstanceId,
        objectInstanceId: command.objectInstanceId,
        reason: "movement-cancelled",
      });
      continue;
    }
    if (movementEvent.kind !== "movement-completed") {
      continue;
    }

    delete pending[pendingKey(movementEvent.actorInstanceId)];
    const resolved = executePendingCommand(bundle, state, command);
    state = resolved.state;
    commandEvents.push(resolved.event);
  }

  return {
    state: { ...state, pendingObjectCommands: pending },
    animationEvents: advanced.animationEvents,
    movementEvents: advanced.movementEvents,
    commandEvents,
  };
};
