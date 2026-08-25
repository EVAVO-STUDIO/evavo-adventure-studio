import {
  applyActions,
  evaluateCondition,
  type RuntimeEvent,
} from "@evavo/adventure-core";
import type {
  Action,
  Condition,
  Id,
  Point,
  Polygon,
} from "@evavo/adventure-project-schema";
import { pointInPolygon } from "@evavo/adventure-scene";
import type { InteractiveRuntimeWorldState } from "./commands.js";

export type SpecializedAdventureModeKind =
  | "vehicle"
  | "action"
  | "quick-response"
  | "cinematic-inset"
  | "puzzle-closeup";

export type SpecializedAdventureModeReturn =
  | { readonly kind: "previous-location" }
  | { readonly kind: "stay" }
  | {
      readonly kind: "explicit";
      readonly sceneId: Id<"scene">;
      readonly entranceId: Id<"entrance">;
    };

export interface SpecializedAdventureModeInputRegion {
  readonly id: string;
  readonly label: string;
  readonly shape: Polygon;
  readonly enabledWhen?: Condition;
  readonly actions?: readonly Action[];
  readonly nextStateId?: string;
  readonly finishOutcomeId?: string;
}

export interface SpecializedAdventureModeTimeout {
  readonly afterTicks: number;
  readonly actions?: readonly Action[];
  readonly nextStateId?: string;
  readonly finishOutcomeId?: string;
}

export interface SpecializedAdventureModeStateDefinition {
  readonly id: string;
  readonly onEnterActions?: readonly Action[];
  readonly inputRegions?: readonly SpecializedAdventureModeInputRegion[];
  readonly timeout?: SpecializedAdventureModeTimeout;
}

export interface SpecializedAdventureModeDefinition {
  readonly id: string;
  readonly kind: SpecializedAdventureModeKind;
  readonly sceneId: Id<"scene">;
  readonly entranceId: Id<"entrance">;
  readonly startStateId: string;
  readonly return: SpecializedAdventureModeReturn;
  readonly states: readonly SpecializedAdventureModeStateDefinition[];
}

export interface ActiveSpecializedAdventureMode {
  readonly modeId: string;
  readonly kind: SpecializedAdventureModeKind;
  readonly stateId: string;
  readonly enteredAtTick: number;
  readonly stateEnteredAtTick: number;
  readonly returnSceneId: Id<"scene">;
  readonly returnEntranceId: Id<"entrance">;
}

export type SpecializedAdventureModeEvent =
  | {
      readonly kind: "specialized-mode-started";
      readonly modeId: string;
      readonly modeKind: SpecializedAdventureModeKind;
      readonly stateId: string;
    }
  | {
      readonly kind: "specialized-mode-state-entered";
      readonly modeId: string;
      readonly stateId: string;
    }
  | {
      readonly kind: "specialized-mode-input";
      readonly modeId: string;
      readonly stateId: string;
      readonly regionId: string;
    }
  | {
      readonly kind: "specialized-mode-timeout";
      readonly modeId: string;
      readonly stateId: string;
    }
  | {
      readonly kind: "specialized-mode-finished";
      readonly modeId: string;
      readonly outcomeId: string;
    };

export interface SpecializedAdventureModeTransition {
  readonly world: InteractiveRuntimeWorldState;
  readonly active: ActiveSpecializedAdventureMode | null;
  readonly events: readonly SpecializedAdventureModeEvent[];
  readonly runtimeEvents: readonly RuntimeEvent[];
}

const stateFor = (
  definition: SpecializedAdventureModeDefinition,
  stateId: string,
): SpecializedAdventureModeStateDefinition => {
  const state = definition.states.find((candidate) => candidate.id === stateId);
  if (!state) {
    throw new Error(`Specialized mode '${definition.id}' has no state '${stateId}'.`);
  }
  return state;
};

export const validateSpecializedAdventureModeDefinition = (
  definition: SpecializedAdventureModeDefinition,
): readonly string[] => {
  const issues: string[] = [];
  if (!definition.id.trim()) issues.push("Specialized mode requires a non-empty ID.");
  if (definition.states.length === 0) issues.push(`Specialized mode '${definition.id}' requires at least one state.`);
  const stateIds = new Set<string>();
  for (const state of definition.states) {
    if (stateIds.has(state.id)) issues.push(`Specialized mode state '${state.id}' is duplicated.`);
    stateIds.add(state.id);
    if (state.timeout && (!Number.isSafeInteger(state.timeout.afterTicks) || state.timeout.afterTicks <= 0)) {
      issues.push(`Specialized mode state '${state.id}' timeout must use positive safe integer ticks.`);
    }
    const regionIds = new Set<string>();
    for (const region of state.inputRegions ?? []) {
      if (regionIds.has(region.id)) issues.push(`Specialized mode region '${state.id}/${region.id}' is duplicated.`);
      regionIds.add(region.id);
      if (region.shape.points.length < 3) issues.push(`Specialized mode region '${state.id}/${region.id}' needs at least three polygon points.`);
      if (region.nextStateId && region.finishOutcomeId) {
        issues.push(`Specialized mode region '${state.id}/${region.id}' cannot both transition and finish.`);
      }
    }
    if (state.timeout?.nextStateId && state.timeout.finishOutcomeId) {
      issues.push(`Specialized mode state '${state.id}' timeout cannot both transition and finish.`);
    }
  }
  if (!stateIds.has(definition.startStateId)) {
    issues.push(`Specialized mode '${definition.id}' start state '${definition.startStateId}' does not exist.`);
  }
  for (const state of definition.states) {
    for (const nextStateId of [
      ...(state.inputRegions ?? []).map((region) => region.nextStateId),
      state.timeout?.nextStateId,
    ]) {
      if (nextStateId && !stateIds.has(nextStateId)) {
        issues.push(`Specialized mode state '${state.id}' references missing next state '${nextStateId}'.`);
      }
    }
  }
  return issues.sort((left, right) => left.localeCompare(right));
};

const changeScene = (
  world: InteractiveRuntimeWorldState,
  sceneId: Id<"scene">,
  entranceId: Id<"entrance">,
): { readonly world: InteractiveRuntimeWorldState; readonly runtimeEvents: readonly RuntimeEvent[] } => {
  const transition = applyActions(world.story, [
    { kind: "change-scene", sceneId, entranceId },
  ]);
  return {
    world: { ...world, story: transition.state },
    runtimeEvents: transition.events,
  };
};

const applyModeActions = (
  world: InteractiveRuntimeWorldState,
  actions: readonly Action[] | undefined,
): { readonly world: InteractiveRuntimeWorldState; readonly runtimeEvents: readonly RuntimeEvent[] } => {
  if (!actions || actions.length === 0) return { world, runtimeEvents: [] };
  const transition = applyActions(world.story, actions);
  return {
    world: { ...world, story: transition.state },
    runtimeEvents: transition.events,
  };
};

const enterState = (
  world: InteractiveRuntimeWorldState,
  active: ActiveSpecializedAdventureMode,
  definition: SpecializedAdventureModeDefinition,
  stateId: string,
): SpecializedAdventureModeTransition => {
  const state = stateFor(definition, stateId);
  const applied = applyModeActions(world, state.onEnterActions);
  const nextActive: ActiveSpecializedAdventureMode = {
    ...active,
    stateId,
    stateEnteredAtTick: applied.world.story.tick,
  };
  return {
    world: applied.world,
    active: nextActive,
    events: [
      {
        kind: "specialized-mode-state-entered",
        modeId: definition.id,
        stateId,
      },
    ],
    runtimeEvents: applied.runtimeEvents,
  };
};

const finishMode = (
  world: InteractiveRuntimeWorldState,
  active: ActiveSpecializedAdventureMode,
  definition: SpecializedAdventureModeDefinition,
  outcomeId: string,
): SpecializedAdventureModeTransition => {
  let nextWorld = world;
  let runtimeEvents: readonly RuntimeEvent[] = [];
  if (definition.return.kind === "previous-location") {
    const changed = changeScene(world, active.returnSceneId, active.returnEntranceId);
    nextWorld = changed.world;
    runtimeEvents = changed.runtimeEvents;
  } else if (definition.return.kind === "explicit") {
    const changed = changeScene(world, definition.return.sceneId, definition.return.entranceId);
    nextWorld = changed.world;
    runtimeEvents = changed.runtimeEvents;
  }
  return {
    world: nextWorld,
    active: null,
    events: [
      {
        kind: "specialized-mode-finished",
        modeId: definition.id,
        outcomeId,
      },
    ],
    runtimeEvents,
  };
};

const transitionFromRegion = (
  world: InteractiveRuntimeWorldState,
  active: ActiveSpecializedAdventureMode,
  definition: SpecializedAdventureModeDefinition,
  region: SpecializedAdventureModeInputRegion,
): SpecializedAdventureModeTransition => {
  const applied = applyModeActions(world, region.actions);
  const inputEvent: SpecializedAdventureModeEvent = {
    kind: "specialized-mode-input",
    modeId: definition.id,
    stateId: active.stateId,
    regionId: region.id,
  };
  if (region.finishOutcomeId) {
    const finished = finishMode(applied.world, active, definition, region.finishOutcomeId);
    return {
      ...finished,
      events: [inputEvent, ...finished.events],
      runtimeEvents: [...applied.runtimeEvents, ...finished.runtimeEvents],
    };
  }
  if (region.nextStateId) {
    const entered = enterState(applied.world, active, definition, region.nextStateId);
    return {
      ...entered,
      events: [inputEvent, ...entered.events],
      runtimeEvents: [...applied.runtimeEvents, ...entered.runtimeEvents],
    };
  }
  return {
    world: applied.world,
    active,
    events: [inputEvent],
    runtimeEvents: applied.runtimeEvents,
  };
};

export const enterSpecializedAdventureMode = (
  world: InteractiveRuntimeWorldState,
  definition: SpecializedAdventureModeDefinition,
): SpecializedAdventureModeTransition => {
  const issues = validateSpecializedAdventureModeDefinition(definition);
  if (issues.length > 0) throw new Error(issues.join("\n"));
  const previousSceneId = world.story.currentSceneId;
  const previousEntranceId = world.story.currentEntranceId;
  const changed = changeScene(world, definition.sceneId, definition.entranceId);
  const baseActive: ActiveSpecializedAdventureMode = {
    modeId: definition.id,
    kind: definition.kind,
    stateId: definition.startStateId,
    enteredAtTick: changed.world.story.tick,
    stateEnteredAtTick: changed.world.story.tick,
    returnSceneId: previousSceneId,
    returnEntranceId: previousEntranceId,
  };
  const entered = enterState(changed.world, baseActive, definition, definition.startStateId);
  return {
    ...entered,
    events: [
      {
        kind: "specialized-mode-started",
        modeId: definition.id,
        modeKind: definition.kind,
        stateId: definition.startStateId,
      },
      ...entered.events,
    ],
    runtimeEvents: [...changed.runtimeEvents, ...entered.runtimeEvents],
  };
};

export const activateSpecializedAdventureMode = (
  world: InteractiveRuntimeWorldState,
  active: ActiveSpecializedAdventureMode,
  definition: SpecializedAdventureModeDefinition,
  point: Point,
): SpecializedAdventureModeTransition => {
  if (active.modeId !== definition.id) {
    throw new Error(`Active specialized mode '${active.modeId}' does not match definition '${definition.id}'.`);
  }
  const state = stateFor(definition, active.stateId);
  const region = (state.inputRegions ?? []).find(
    (candidate) =>
      (!candidate.enabledWhen || evaluateCondition(candidate.enabledWhen, world.story)) &&
      pointInPolygon(point, candidate.shape),
  );
  if (!region) return { world, active, events: [], runtimeEvents: [] };
  return transitionFromRegion(world, active, definition, region);
};

export const advanceSpecializedAdventureMode = (
  world: InteractiveRuntimeWorldState,
  active: ActiveSpecializedAdventureMode,
  definition: SpecializedAdventureModeDefinition,
): SpecializedAdventureModeTransition => {
  if (active.modeId !== definition.id) {
    throw new Error(`Active specialized mode '${active.modeId}' does not match definition '${definition.id}'.`);
  }
  const state = stateFor(definition, active.stateId);
  const timeout = state.timeout;
  if (!timeout || world.story.tick - active.stateEnteredAtTick < timeout.afterTicks) {
    return { world, active, events: [], runtimeEvents: [] };
  }
  const timeoutEvent: SpecializedAdventureModeEvent = {
    kind: "specialized-mode-timeout",
    modeId: definition.id,
    stateId: state.id,
  };
  const applied = applyModeActions(world, timeout.actions);
  if (timeout.finishOutcomeId) {
    const finished = finishMode(applied.world, active, definition, timeout.finishOutcomeId);
    return {
      ...finished,
      events: [timeoutEvent, ...finished.events],
      runtimeEvents: [...applied.runtimeEvents, ...finished.runtimeEvents],
    };
  }
  if (timeout.nextStateId) {
    const entered = enterState(applied.world, active, definition, timeout.nextStateId);
    return {
      ...entered,
      events: [timeoutEvent, ...entered.events],
      runtimeEvents: [...applied.runtimeEvents, ...entered.runtimeEvents],
    };
  }
  return {
    world: applied.world,
    active,
    events: [timeoutEvent],
    runtimeEvents: applied.runtimeEvents,
  };
};
