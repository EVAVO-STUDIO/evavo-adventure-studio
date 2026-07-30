import type { RuntimeEvent } from "@evavo/adventure-core";
import type { DialogueView } from "@evavo/adventure-dialogue";
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
import {
  chooseActiveRuntimeDialogueOption,
  resolveActiveRuntimeDialogue,
} from "@evavo/adventure-scene-runtime/dialogue";
import { hitTestSceneObject } from "@evavo/adventure-scene-runtime/interactions";
import { beginActorMovement } from "@evavo/adventure-scene-runtime/movement";
import { uiSkinById, type UiSkin } from "@evavo/adventure-ui-skin";
import {
  hitTestUiSkin,
  type UiHitTarget,
} from "@evavo/adventure-ui-skin/hit-testing";
import {
  appendSoftwareCursor,
  cursorIdForObjectTarget,
  nativeScreenPointToWorld,
  selectControlledActorInstance,
  verbForCursorId,
  type ControlledActorSelection,
  type SoftwareCursorState,
} from "./input.js";
import {
  appendRuntimeInterface,
  runtimeUiState,
  type RuntimeUiInteractionState,
} from "./runtime-ui.js";

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

const movementFailureStatus = (reason: string): string => {
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

const speechFromEvents = (events: readonly RuntimeEvent[]): string | null => {
  const speech = [...events]
    .reverse()
    .find((event) => event.kind === "speech-requested");
  return speech?.kind === "speech-requested" ? speech.text : null;
};

const dialogueViewStatus = (
  view: DialogueView,
  events: readonly RuntimeEvent[] = [],
): string =>
  speechFromEvents(events) ??
  view.lines.at(-1)?.text ??
  (view.choices.some((choice) => choice.visible && choice.enabled)
    ? "CHOOSE A RESPONSE"
    : "DIALOGUE CONTINUES");

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
    case "object-command-executed":
      return (
        speechFromEvents(event.runtimeEvents) ??
        `${event.verb.toUpperCase()} COMPLETE`
      );
  }
};

const initialVerbId = (skin: UiSkin | null): Id<"ui-verb"> | null =>
  skin?.verbs.find((verb) => verb.primary)?.id ?? skin?.verbs[0]?.id ?? null;

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
  const runtimeSkin =
    bundle.uiSkins && bundle.bitmapFonts ? uiSkinById(bundle.uiSkins) : null;
  let selectedVerbId = initialVerbId(runtimeSkin);
  let hoveredVerbId: Id<"ui-verb"> | null = null;
  let selectedItemId: Id<"item"> | null = null;
  let verbCoinPosition: Point | null = null;
  let hoveredDialogueChoiceId: Id<"dialogue-choice"> | null = null;
  let world = createInitialInteractiveRuntimeWorldState(bundle);
  let renderedTick = 0;
  let baseFrame = resolveRuntimeSceneFrame(bundle, world);
  let cursor: SoftwareCursorState = {
    position: null,
    cursorId: "walk",
    pressed: false,
  };
  let status = selectionStatus(selection);

  const interactionState = (): RuntimeUiInteractionState => ({
    ...(selectedVerbId ? { activeVerbId: selectedVerbId } : {}),
    ...(hoveredVerbId ? { hoveredVerbId } : {}),
    ...(selectedItemId ? { selectedItemId } : {}),
    ...(verbCoinPosition ? { verbCoinPosition } : {}),
    ...(hoveredDialogueChoiceId ? { hoveredDialogueChoiceId } : {}),
  });

  const setStatus = (text: string): void => {
    if (status === text) return;
    status = text;
    options.onStatusChange?.(text);
  };

  const setActiveDialogueStatus = (
    events: readonly RuntimeEvent[] = [],
  ): boolean => {
    const view = resolveActiveRuntimeDialogue(bundle, world);
    if (!view) return false;
    setStatus(dialogueViewStatus(view, events));
    return true;
  };

  const currentUiTarget = (position: Point): UiHitTarget | null => {
    if (!runtimeSkin || !bundle.bitmapFonts) return null;
    return hitTestUiSkin(
      runtimeSkin,
      bundle.bitmapFonts,
      runtimeUiState(
        bundle,
        world,
        runtimeSkin,
        status,
        cursor,
        interactionState(),
      ),
      position,
    );
  };

  const pointerTarget = () => {
    if (!cursor.position) return null;
    return hitTestSceneObject(
      bundle,
      world,
      nativeScreenPointToWorld(cursor.position, baseFrame.camera),
    );
  };

  const refreshCursor = (): void => {
    if (!cursor.position) {
      hoveredVerbId = null;
      hoveredDialogueChoiceId = null;
      return;
    }
    const uiTarget = currentUiTarget(cursor.position);
    if (uiTarget) {
      hoveredVerbId =
        uiTarget.kind === "verb" || uiTarget.kind === "verb-coin"
          ? uiTarget.verb.id
          : null;
      hoveredDialogueChoiceId =
        uiTarget.kind === "dialogue-choice" ? uiTarget.choiceId : null;
      const cursorId =
        uiTarget.kind === "verb" || uiTarget.kind === "verb-coin"
          ? uiTarget.verb.cursorId
          : uiTarget.kind === "dialogue-choice"
            ? "talk"
            : "use";
      cursor = { ...cursor, cursorId };
      return;
    }
    hoveredVerbId = null;
    hoveredDialogueChoiceId = null;
    cursor = {
      ...cursor,
      cursorId: cursorIdForObjectTarget(pointerTarget()),
    };
  };

  const selectedVerb = () =>
    runtimeSkin?.verbs.find((verb) => verb.id === selectedVerbId) ?? null;

  const itemName = (itemId: Id<"item">): string =>
    bundle.inventoryItems.find((item) => item.id === itemId)?.name ?? itemId;

  const chooseDialogue = (
    target: Extract<UiHitTarget, { readonly kind: "dialogue-choice" }>,
  ): void => {
    if (!target.enabled) {
      setStatus("THAT DIALOGUE CHOICE IS DISABLED");
      return;
    }
    const chosen = chooseActiveRuntimeDialogueOption(
      bundle,
      world,
      target.choiceId,
    );
    if (chosen.kind === "rejected") {
      setStatus(`DIALOGUE REJECTED • ${chosen.detail}`);
      return;
    }
    world = chosen.state;
    hoveredDialogueChoiceId = null;
    if (chosen.kind === "active") {
      setStatus(dialogueViewStatus(chosen.view, chosen.events));
      return;
    }
    setStatus(speechFromEvents(chosen.events) ?? "DIALOGUE ENDED");
  };

  const handleUiActivation = (position: Point): boolean => {
    if (!runtimeSkin || !bundle.bitmapFonts) return false;
    const target = currentUiTarget(position);
    if (target) {
      switch (target.kind) {
        case "verb":
        case "verb-coin":
          selectedVerbId = target.verb.id;
          verbCoinPosition = null;
          setStatus(`${target.verb.label} SELECTED`);
          return true;
        case "inventory-slot":
          selectedItemId = target.itemId;
          setStatus(
            target.itemId
              ? `${itemName(target.itemId).toUpperCase()} SELECTED`
              : "EMPTY INVENTORY SLOT",
          );
          return true;
        case "parser":
          setStatus("PARSER INPUT READY");
          return true;
        case "dialogue-choice":
          chooseDialogue(target);
          return true;
      }
    }
    if (runtimeSkin.interactionMode === "verb-coin") {
      verbCoinPosition = position;
      setStatus("CHOOSE A VERB");
      return true;
    }
    return false;
  };

  const clearPendingCommand = (
    state: InteractiveRuntimeWorldState,
    actorInstanceId: Id<"actor-instance">,
  ): InteractiveRuntimeWorldState => {
    const pendingObjectCommands = { ...state.pendingObjectCommands };
    delete pendingObjectCommands[actorInstanceId];
    return { ...state, pendingObjectCommands };
  };

  const applyCommandStatus = (event: SceneCommandEvent): void => {
    setStatus(statusFromCommandEvent(event));
    if (event.kind === "object-command-executed") {
      setActiveDialogueStatus(event.runtimeEvents);
    }
  };

  const activate = (position: Point): void => {
    cursor = { ...cursor, position };
    refreshCursor();
    if (handleUiActivation(position)) return;
    if (world.story.activeDialogue) {
      setStatus("CHOOSE A DIALOGUE RESPONSE");
      return;
    }
    if (!controlledActorInstanceId) return;

    const worldPoint = nativeScreenPointToWorld(position, baseFrame.camera);
    const target = pointerTarget();
    if (target) {
      const verb = selectedVerb()?.verb ?? verbForCursorId(cursorIdForObjectTarget(target));
      try {
        const queued = queueSceneObjectCommand(
          bundle,
          world,
          controlledActorInstanceId,
          target.objectInstanceId,
          verb,
          selectedItemId,
        );
        switch (queued.kind) {
          case "queued":
          case "resolved":
            world = queued.state;
            applyCommandStatus(queued.event);
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
          applyCommandStatus(event);
        }
      }
      baseFrame = resolveRuntimeSceneFrame(bundle, world);
      refreshCursor();
      const withInterface = appendRuntimeInterface(
        baseFrame,
        bundle,
        world,
        status,
        cursor,
        interactionState(),
      );
      return appendSoftwareCursor(withInterface, cursor);
    },
  };
};
