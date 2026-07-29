import type { Id, Point } from "@evavo/adventure-project-schema";
import type { ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { resolveRuntimeSceneFrame } from "@evavo/adventure-scene-runtime";
import {
  advanceInteractiveRuntimeWorld,
  createInitialInteractiveRuntimeWorldState,
  queueSceneObjectCommand,
  type InteractiveRuntimeWorldState,
  type SceneCommandEvent,
} from "@evavo/adventure-scene-runtime/commands";
import { hitTestSceneObject } from "@evavo/adventure-scene-runtime/interactions";
import { beginActorMovement } from "@evavo/adventure-scene-runtime/movement";
import {
  appendSoftwareCursor,
  cursorIdForObjectTarget,
  nativeScreenPointToWorld,
  selectControlledActorInstance,
  verbForCursorId,
  type ControlledActorSelection,
  type SoftwareCursorState,
} from "./input.js";

export interface PackagedRuntimeController {
  readonly selection: Exclude<ControlledActorSelection, { readonly kind: "invalid" }>;
  readonly controlledActorInstanceId: Id<"actor-instance"> | null;
  createFrame(tick: number): ResolvedFrame;
  setPointer(position: Point | null): void;
  setPressed(pressed: boolean): void;
  activate(position: Point): void;
  statusText(): string;
  worldState(): InteractiveRuntimeWorldState;
}

export interface PackagedRuntimeControllerOptions {
  readonly requestedActorInstanceId?: string | null;
  readonly onStatusChange?: (text: string) => void;
}

const selectionStatus = (
  selection: Exclude<ControlledActorSelection, { readonly kind: "invalid" }>,
): string => {
  if (selection.kind === "selected") {
    return `CLICK TO WALK • ${selection.actorInstanceId}`;
  }
  return selection.reason === "ambiguous-walkable-actors"
    ? "ADD ?actor=<INSTANCE-ID> TO CONTROL"
    : "VIEW-ONLY RUNTIME";
};

const movementFailureStatus = (
  reason: string,
): string => {
  switch (reason) {
    case "no-connected-route":
      return "NO ROUTE TO THAT POINT";
    case "start-outside-navigation":
      return "ACTOR IS OUTSIDE THE WALK AREA";
    case "end-outside-navigation":
      return "THAT POINT CANNOT BE REACHED";
    case "fixed-instance":
      return "THAT ACTOR CANNOT MOVE";
    case "missing-instance":
      return "CONTROLLED ACTOR IS MISSING";
    case "invalid-speed":
      return "ACTOR WALK SPEED IS INVALID";
    default:
      return "MOVEMENT COULD NOT START";
  }
};

const statusFromCommandEvent = (event: SceneCommandEvent): string => {
  switch (event.kind) {
    case "object-command-queued":
      return `${event.verb.toUpperCase()} AFTER APPROACH`;
    case "object-command-fallback":
      return event.text;
    case "object-command-rejected":
      return `ACTION REJECTED • ${event.reason}`;
    case "object-command-aborted":
      return event.reason === "movement-cancelled"
        ? "ACTION CANCELLED"
        : "TARGET IS NO LONGER AVAILABLE";
    case "object-command-executed": {
      const speech = [...event.runtimeEvents]
        .reverse()
        .find((runtimeEvent) => runtimeEvent.kind === "speech-requested");
      return speech?.kind === "speech-requested"
        ? speech.text
        : `${event.verb.toUpperCase()} COMPLETE`;
    }
  }
};

export const createPackagedRuntimeController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): PackagedRuntimeController => {
  const resolvedSelection = selectControlledActorInstance(
    bundle,
    options.requestedActorInstanceId ?? null,
  );
  if (resolvedSelection.kind === "invalid") {
    throw new Error(
      resolvedSelection.reason === "requested-actor-is-fixed"
        ? `Requested actor instance '${resolvedSelection.requestedActorInstanceId}' is fixed and cannot be controlled.`
        : `Requested actor instance '${resolvedSelection.requestedActorInstanceId}' is not placed in the start scene.`,
    );
  }

  const selection = resolvedSelection;
  const controlledActorInstanceId =
    selection.kind === "selected" ? selection.actorInstanceId : null;
  let world = createInitialInteractiveRuntimeWorldState(bundle);
  let renderedTick = 0;
  let baseFrame = resolveRuntimeSceneFrame(bundle, world);
  let cursor: SoftwareCursorState = {
    position: null,
    cursorId: "walk",
    pressed: false,
  };
  let status = selectionStatus(selection);

  const setStatus = (text: string): void => {
    if (status === text) {
      return;
    }
    status = text;
    options.onStatusChange?.(text);
  };

  const pointerTarget = () => {
    if (!cursor.position) {
      return null;
    }
    return hitTestSceneObject(
      bundle,
      world,
      nativeScreenPointToWorld(cursor.position, baseFrame.camera),
    );
  };

  const refreshCursor = (): void => {
    cursor = {
      ...cursor,
      cursorId: cursorIdForObjectTarget(pointerTarget()),
    };
  };

  const clearPendingCommand = (
    state: InteractiveRuntimeWorldState,
    actorInstanceId: Id<"actor-instance">,
  ): InteractiveRuntimeWorldState => {
    const pendingObjectCommands = { ...state.pendingObjectCommands };
    delete pendingObjectCommands[actorInstanceId];
    return { ...state, pendingObjectCommands };
  };

  const activate = (position: Point): void => {
    cursor = { ...cursor, position };
    refreshCursor();
    if (!controlledActorInstanceId) {
      return;
    }

    const worldPoint = nativeScreenPointToWorld(position, baseFrame.camera);
    const target = pointerTarget();
    if (target) {
      const verb = verbForCursorId(cursorIdForObjectTarget(target));
      try {
        const queued = queueSceneObjectCommand(
          bundle,
          world,
          controlledActorInstanceId,
          target.objectInstanceId,
          verb,
        );
        switch (queued.kind) {
          case "queued":
            world = queued.state;
            setStatus(statusFromCommandEvent(queued.event));
            return;
          case "resolved":
            world = queued.state;
            setStatus(statusFromCommandEvent(queued.event));
            return;
          case "missing-target":
            setStatus("TARGET IS NO LONGER AVAILABLE");
            return;
          case "movement-rejected":
            setStatus(
              movementFailureStatus(
                queued.movement.kind === "unreachable"
                  ? queued.movement.routeResult.reason
                  : queued.movement.reason,
              ),
            );
            return;
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "ACTION FAILED");
        return;
      }
    }

    try {
      const movement = beginActorMovement(
        bundle,
        world,
        controlledActorInstanceId,
        worldPoint,
      );
      switch (movement.kind) {
        case "started":
          world = clearPendingCommand(
            {
              ...movement.state,
              pendingObjectCommands: world.pendingObjectCommands,
            },
            controlledActorInstanceId,
          );
          setStatus("WALKING");
          return;
        case "already-there":
          setStatus("ALREADY THERE");
          return;
        case "unreachable":
          setStatus(movementFailureStatus(movement.routeResult.reason));
          return;
        case "rejected":
          setStatus(movementFailureStatus(movement.reason));
          return;
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "MOVEMENT FAILED");
    }
  };

  return {
    selection,
    controlledActorInstanceId,
    setPointer: (position) => {
      cursor = { ...cursor, position };
      refreshCursor();
    },
    setPressed: (pressed) => {
      cursor = { ...cursor, pressed };
    },
    activate,
    statusText: () => status,
    worldState: () => world,
    createFrame: (tick) => {
      if (tick < renderedTick) {
        throw new RangeError("Packaged player logical time cannot move backwards.");
      }
      const delta = tick - renderedTick;
      if (delta > 0) {
        const advanced = advanceInteractiveRuntimeWorld(bundle, world, delta);
        world = advanced.state;
        renderedTick = tick;
        for (const event of advanced.commandEvents) {
          setStatus(statusFromCommandEvent(event));
        }
      }
      baseFrame = resolveRuntimeSceneFrame(bundle, world);
      refreshCursor();
      return appendSoftwareCursor(baseFrame, cursor);
    },
  };
};
