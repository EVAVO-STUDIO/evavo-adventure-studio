import { evaluateCondition } from "@evavo/adventure-core";
import type { Id, Point } from "@evavo/adventure-project-schema";
import type {
  RuntimeBundle,
  RuntimeSpecializedAdventureMode,
} from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "./commands.js";
import {
  activateSpecializedAdventureMode,
  advanceSpecializedAdventureMode,
  enterSpecializedAdventureMode,
  type ActiveSpecializedAdventureMode,
  type SpecializedAdventureModeDefinition,
  type SpecializedAdventureModeEvent,
} from "./specialized-mode.js";

export interface SpecializedAdventureModeSessionState {
  readonly active: ActiveSpecializedAdventureMode | null;
  readonly firedModeIds: readonly string[];
  readonly previousConsumedInteractionIds: readonly Id<"interaction">[];
  readonly previousConsumedDialogueChoiceIds: readonly Id<"dialogue-choice">[];
}

export interface SpecializedAdventureModeSessionTransition {
  readonly world: InteractiveRuntimeWorldState;
  readonly state: SpecializedAdventureModeSessionState;
  readonly events: readonly SpecializedAdventureModeEvent[];
}

const uniqueSorted = <T extends string>(values: readonly T[]): readonly T[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const createSpecializedAdventureModeSessionState = (
  world: InteractiveRuntimeWorldState,
): SpecializedAdventureModeSessionState => ({
  active: null,
  firedModeIds: [],
  previousConsumedInteractionIds: [...world.story.consumedInteractionIds],
  previousConsumedDialogueChoiceIds: [...world.story.consumedDialogueChoiceIds],
});

const definitionFor = (
  mode: RuntimeSpecializedAdventureMode,
): SpecializedAdventureModeDefinition => ({
  id: mode.id,
  kind: mode.kind,
  sceneId: mode.sceneId,
  entranceId: mode.entranceId,
  startStateId: mode.startStateId,
  return: mode.return,
  states: mode.states,
});

const modeById = (bundle: RuntimeBundle, modeId: string): RuntimeSpecializedAdventureMode => {
  const mode = bundle.specializedModes?.modes.find((candidate) => candidate.id === modeId);
  if (!mode) throw new Error(`Specialized mode '${modeId}' does not exist in the runtime bundle.`);
  return mode;
};

const withSnapshots = (
  state: SpecializedAdventureModeSessionState,
  world: InteractiveRuntimeWorldState,
): SpecializedAdventureModeSessionState => ({
  ...state,
  previousConsumedInteractionIds: [...world.story.consumedInteractionIds],
  previousConsumedDialogueChoiceIds: [...world.story.consumedDialogueChoiceIds],
});

export const startSpecializedAdventureModeSession = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  state: SpecializedAdventureModeSessionState,
  modeId: string,
): SpecializedAdventureModeSessionTransition => {
  if (state.active) {
    throw new Error(`Specialized mode '${state.active.modeId}' is already active.`);
  }
  const mode = modeById(bundle, modeId);
  if (mode.once && state.firedModeIds.includes(mode.id)) {
    return { world, state: withSnapshots(state, world), events: [] };
  }
  const transition = enterSpecializedAdventureMode(world, definitionFor(mode));
  return {
    world: transition.world,
    state: withSnapshots(
      {
        ...state,
        active: transition.active,
        firedModeIds: mode.once
          ? uniqueSorted([...state.firedModeIds, mode.id])
          : state.firedModeIds,
      },
      transition.world,
    ),
    events: transition.events,
  };
};

const newlyConsumed = <T extends string>(current: readonly T[], previous: readonly T[]): ReadonlySet<T> => {
  const seen = new Set(previous);
  return new Set(current.filter((id) => !seen.has(id)));
};

const triggerMatches = (
  mode: RuntimeSpecializedAdventureMode,
  world: InteractiveRuntimeWorldState,
  newInteractions: ReadonlySet<Id<"interaction">>,
  newChoices: ReadonlySet<Id<"dialogue-choice">>,
): boolean => {
  const trigger = mode.trigger;
  if (!trigger) return false;
  switch (trigger.kind) {
    case "interaction-consumed":
      return newInteractions.has(trigger.interactionId);
    case "dialogue-choice-consumed":
      return newChoices.has(trigger.choiceId);
    case "condition":
      return evaluateCondition(trigger.condition, world.story);
  }
};

export const advanceSpecializedAdventureModeSession = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  state: SpecializedAdventureModeSessionState,
): SpecializedAdventureModeSessionTransition => {
  if (!bundle.specializedModes) {
    return { world, state: withSnapshots(state, world), events: [] };
  }

  if (state.active) {
    const mode = modeById(bundle, state.active.modeId);
    const transition = advanceSpecializedAdventureMode(
      world,
      state.active,
      definitionFor(mode),
    );
    return {
      world: transition.world,
      state: withSnapshots({ ...state, active: transition.active }, transition.world),
      events: transition.events,
    };
  }

  const newInteractions = newlyConsumed(
    world.story.consumedInteractionIds,
    state.previousConsumedInteractionIds,
  );
  const newChoices = newlyConsumed(
    world.story.consumedDialogueChoiceIds,
    state.previousConsumedDialogueChoiceIds,
  );
  const candidate = [...bundle.specializedModes.modes]
    .filter((mode) => !mode.once || !state.firedModeIds.includes(mode.id))
    .filter((mode) => triggerMatches(mode, world, newInteractions, newChoices))
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (!candidate) return { world, state: withSnapshots(state, world), events: [] };
  return startSpecializedAdventureModeSession(bundle, world, state, candidate.id);
};

export const activateSpecializedAdventureModeSession = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  state: SpecializedAdventureModeSessionState,
  point: Point,
): SpecializedAdventureModeSessionTransition => {
  if (!state.active) return { world, state: withSnapshots(state, world), events: [] };
  const mode = modeById(bundle, state.active.modeId);
  const transition = activateSpecializedAdventureMode(
    world,
    state.active,
    definitionFor(mode),
    point,
  );
  return {
    world: transition.world,
    state: withSnapshots({ ...state, active: transition.active }, transition.world),
    events: transition.events,
  };
};
