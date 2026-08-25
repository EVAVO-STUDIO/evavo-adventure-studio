import {
  applyActions,
  evaluateCondition,
  type RuntimeEvent,
} from "@evavo/adventure-core";
import type { Id } from "@evavo/adventure-project-schema";
import type {
  RuntimeBundle,
  RuntimeRoomScript,
} from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "./commands.js";
import { applyRuntimeNarrativeRequestEvents } from "./narrative.js";

export interface ActiveRuntimeRoomCutaway {
  readonly scriptId: string;
  readonly sequenceId: Id<"sequence">;
  readonly returnSceneId: Id<"scene">;
  readonly returnEntranceId: Id<"entrance">;
}

export interface RuntimeRoomScriptState {
  readonly sceneId: Id<"scene">;
  readonly enteredAtTick: number;
  readonly visitedSceneIds: readonly Id<"scene">[];
  readonly firedScriptIds: readonly string[];
  readonly lastFiredCycleByScriptId: Readonly<Record<string, number>>;
  readonly previousConsumedInteractionIds: readonly Id<"interaction">[];
  readonly previousConsumedDialogueChoiceIds: readonly Id<"dialogue-choice">[];
  readonly activeCutaway: ActiveRuntimeRoomCutaway | null;
  readonly pendingSceneEnter: boolean;
}

export type RuntimeRoomScriptEvent =
  | { readonly kind: "room-script-fired"; readonly scriptId: string }
  | {
      readonly kind: "room-script-cycle-fired";
      readonly scriptId: string;
      readonly cycleIndex: number;
    }
  | {
      readonly kind: "room-cutaway-started";
      readonly scriptId: string;
      readonly sceneId: Id<"scene">;
      readonly sequenceId: Id<"sequence">;
    }
  | {
      readonly kind: "room-cutaway-returned";
      readonly scriptId: string;
      readonly sceneId: Id<"scene">;
      readonly entranceId: Id<"entrance">;
    };

export interface RuntimeRoomScriptTransition {
  readonly world: InteractiveRuntimeWorldState;
  readonly state: RuntimeRoomScriptState;
  readonly events: readonly RuntimeRoomScriptEvent[];
  readonly runtimeEvents: readonly RuntimeEvent[];
}

const uniqueSorted = <T extends string>(values: readonly T[]): readonly T[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const createRuntimeRoomScriptState = (
  world: InteractiveRuntimeWorldState,
): RuntimeRoomScriptState => ({
  sceneId: world.story.currentSceneId,
  enteredAtTick: world.story.tick,
  visitedSceneIds: [],
  firedScriptIds: [],
  lastFiredCycleByScriptId: {},
  previousConsumedInteractionIds: [...world.story.consumedInteractionIds],
  previousConsumedDialogueChoiceIds: [...world.story.consumedDialogueChoiceIds],
  activeCutaway: null,
  pendingSceneEnter: true,
});

const roomCycleIndex = (
  script: RuntimeRoomScript,
  world: InteractiveRuntimeWorldState,
  state: RuntimeRoomScriptState,
): number | null => {
  if (script.trigger.kind !== "room-tick-cycle") return null;
  const roomTicks = world.story.tick - state.enteredAtTick;
  if (roomTicks < script.trigger.startTick) return null;
  return Math.floor((roomTicks - script.trigger.startTick) / script.trigger.intervalTicks);
};

const scriptTriggered = (
  script: RuntimeRoomScript,
  world: InteractiveRuntimeWorldState,
  state: RuntimeRoomScriptState,
  sceneEntered: boolean,
  firstEnter: boolean,
  newInteractions: ReadonlySet<string>,
  newChoices: ReadonlySet<string>,
): boolean => {
  if (script.sceneId !== world.story.currentSceneId) return false;
  if (script.when && !evaluateCondition(script.when, world.story)) return false;
  switch (script.trigger.kind) {
    case "scene-enter":
      return sceneEntered;
    case "scene-first-enter":
      return firstEnter;
    case "interaction-consumed":
      return newInteractions.has(script.trigger.interactionId);
    case "dialogue-choice-consumed":
      return newChoices.has(script.trigger.choiceId);
    case "after-room-ticks":
      return world.story.tick - state.enteredAtTick >= script.trigger.ticks;
    case "room-tick-cycle": {
      const cycle = roomCycleIndex(script, world, state);
      return cycle !== null && cycle > (state.lastFiredCycleByScriptId[script.id] ?? -1);
    }
    case "condition":
      return evaluateCondition(script.trigger.condition, world.story);
  }
};

const applyScript = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  state: RuntimeRoomScriptState,
  script: RuntimeRoomScript,
): RuntimeRoomScriptTransition => {
  const scriptEvents: RuntimeRoomScriptEvent[] = [
    { kind: "room-script-fired", scriptId: script.id },
  ];
  const cycle = roomCycleIndex(script, world, state);
  if (cycle !== null) {
    scriptEvents.push({ kind: "room-script-cycle-fired", scriptId: script.id, cycleIndex: cycle });
  }
  const actionTransition = applyActions(world.story, script.actions);
  let nextWorld: InteractiveRuntimeWorldState = { ...world, story: actionTransition.state };
  const runtimeEvents: RuntimeEvent[] = [...actionTransition.events];
  let nextState: RuntimeRoomScriptState = {
    ...state,
    firedScriptIds: script.once
      ? uniqueSorted([...state.firedScriptIds, script.id])
      : state.firedScriptIds,
    ...(cycle === null
      ? {}
      : {
          lastFiredCycleByScriptId: {
            ...state.lastFiredCycleByScriptId,
            [script.id]: cycle,
          },
        }),
  };

  if (script.cutaway) {
    const returnSceneId = nextWorld.story.currentSceneId;
    const returnEntranceId = nextWorld.story.currentEntranceId;
    const cutawayActions = applyActions(nextWorld.story, [
      {
        kind: "change-scene",
        sceneId: script.cutaway.sceneId,
        entranceId: script.cutaway.entranceId,
      },
      { kind: "play-sequence", sequenceId: script.cutaway.sequenceId },
    ]);
    const narrative = applyRuntimeNarrativeRequestEvents(
      bundle,
      { ...nextWorld, story: cutawayActions.state },
      cutawayActions.events,
    );
    nextWorld = narrative.state as InteractiveRuntimeWorldState;
    runtimeEvents.push(...narrative.events);
    nextState = {
      ...nextState,
      sceneId: script.cutaway.sceneId,
      enteredAtTick: nextWorld.story.tick,
      visitedSceneIds: uniqueSorted([...nextState.visitedSceneIds, script.cutaway.sceneId]),
      lastFiredCycleByScriptId: {},
      activeCutaway: script.cutaway.returnToPreviousLocation
        ? {
            scriptId: script.id,
            sequenceId: script.cutaway.sequenceId,
            returnSceneId,
            returnEntranceId,
          }
        : null,
      pendingSceneEnter: false,
    };
    scriptEvents.push({
      kind: "room-cutaway-started",
      scriptId: script.id,
      sceneId: script.cutaway.sceneId,
      sequenceId: script.cutaway.sequenceId,
    });
  } else if (script.sequenceId) {
    const request: RuntimeEvent = { kind: "sequence-requested", sequenceId: script.sequenceId };
    const narrative = applyRuntimeNarrativeRequestEvents(bundle, nextWorld, [request]);
    nextWorld = narrative.state as InteractiveRuntimeWorldState;
    runtimeEvents.push(...narrative.events);
  }

  return { world: nextWorld, state: nextState, events: scriptEvents, runtimeEvents };
};

const maybeReturnCutaway = (
  world: InteractiveRuntimeWorldState,
  state: RuntimeRoomScriptState,
): RuntimeRoomScriptTransition | null => {
  const cutaway = state.activeCutaway;
  if (!cutaway) return null;
  if (world.story.activeSequences.some((active) => active.sequenceId === cutaway.sequenceId)) {
    return {
      world,
      state: {
        ...state,
        previousConsumedInteractionIds: [...world.story.consumedInteractionIds],
        previousConsumedDialogueChoiceIds: [...world.story.consumedDialogueChoiceIds],
      },
      events: [],
      runtimeEvents: [],
    };
  }
  const returned = applyActions(world.story, [
    {
      kind: "change-scene",
      sceneId: cutaway.returnSceneId,
      entranceId: cutaway.returnEntranceId,
    },
  ]);
  return {
    world: { ...world, story: returned.state },
    state: {
      ...state,
      sceneId: cutaway.returnSceneId,
      enteredAtTick: returned.state.tick,
      visitedSceneIds: uniqueSorted([...state.visitedSceneIds, cutaway.returnSceneId]),
      lastFiredCycleByScriptId: {},
      previousConsumedInteractionIds: [...returned.state.consumedInteractionIds],
      previousConsumedDialogueChoiceIds: [...returned.state.consumedDialogueChoiceIds],
      activeCutaway: null,
      pendingSceneEnter: true,
    },
    events: [
      {
        kind: "room-cutaway-returned",
        scriptId: cutaway.scriptId,
        sceneId: cutaway.returnSceneId,
        entranceId: cutaway.returnEntranceId,
      },
    ],
    runtimeEvents: returned.events,
  };
};

export const advanceRuntimeRoomScripts = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  state: RuntimeRoomScriptState,
): RuntimeRoomScriptTransition => {
  const returning = maybeReturnCutaway(world, state);
  if (returning) return returning;
  const sceneChanged = world.story.currentSceneId !== state.sceneId;
  const sceneEntered = state.pendingSceneEnter || sceneChanged;
  const firstEnter = sceneEntered && !state.visitedSceneIds.includes(world.story.currentSceneId);
  const workingState: RuntimeRoomScriptState = sceneEntered
    ? {
        ...state,
        sceneId: world.story.currentSceneId,
        enteredAtTick: sceneChanged ? world.story.tick : state.enteredAtTick,
        visitedSceneIds: uniqueSorted([...state.visitedSceneIds, world.story.currentSceneId]),
        lastFiredCycleByScriptId: sceneChanged ? {} : state.lastFiredCycleByScriptId,
        pendingSceneEnter: false,
      }
    : state;

  if (!bundle.roomScripts) {
    return {
      world,
      state: {
        ...workingState,
        previousConsumedInteractionIds: [...world.story.consumedInteractionIds],
        previousConsumedDialogueChoiceIds: [...world.story.consumedDialogueChoiceIds],
      },
      events: [],
      runtimeEvents: [],
    };
  }

  const oldInteractions = new Set(state.previousConsumedInteractionIds);
  const oldChoices = new Set(state.previousConsumedDialogueChoiceIds);
  const newInteractions = new Set(
    world.story.consumedInteractionIds.filter((id) => !oldInteractions.has(id)),
  );
  const newChoices = new Set(
    world.story.consumedDialogueChoiceIds.filter((id) => !oldChoices.has(id)),
  );

  let nextWorld = world;
  let nextState = workingState;
  const events: RuntimeRoomScriptEvent[] = [];
  const runtimeEvents: RuntimeEvent[] = [];
  const scripts = [...bundle.roomScripts.scripts]
    .filter((script) => !script.once || !nextState.firedScriptIds.includes(script.id))
    .sort((left, right) => left.id.localeCompare(right.id));

  for (const script of scripts) {
    if (
      !scriptTriggered(
        script,
        nextWorld,
        nextState,
        sceneEntered,
        firstEnter,
        newInteractions,
        newChoices,
      )
    ) continue;
    const applied = applyScript(bundle, nextWorld, nextState, script);
    nextWorld = applied.world;
    nextState = applied.state;
    events.push(...applied.events);
    runtimeEvents.push(...applied.runtimeEvents);
    if (nextState.activeCutaway) break;
  }

  nextState = {
    ...nextState,
    previousConsumedInteractionIds: [...nextWorld.story.consumedInteractionIds],
    previousConsumedDialogueChoiceIds: [...nextWorld.story.consumedDialogueChoiceIds],
  };
  return { world: nextWorld, state: nextState, events, runtimeEvents };
};
