import type {
  Action,
  AdventureProject,
  Condition,
  Id,
  Interaction,
  Scalar,
} from "@evavo/adventure-project-schema";

export interface ActiveDialogueState {
  readonly dialogueId: Id<"dialogue">;
  readonly nodeId: Id<"dialogue-node">;
}

export interface RuntimeState {
  readonly schemaVersion: 1;
  readonly projectId: Id<"project">;
  readonly tick: number;
  readonly currentSceneId: Id<"scene">;
  readonly currentEntranceId: Id<"entrance">;
  readonly flags: Readonly<Record<string, boolean>>;
  readonly variables: Readonly<Record<string, Scalar>>;
  readonly inventory: readonly Id<"item">[];
  readonly awardedScoreIds: readonly Id<"score-award">[];
  readonly consumedInteractionIds: readonly Id<"interaction">[];
  readonly consumedDialogueChoiceIds: readonly Id<"dialogue-choice">[];
  readonly activeDialogue: ActiveDialogueState | null;
  readonly objectStates: Readonly<Record<string, string>>;
  readonly randomStreams: Readonly<Record<string, number>>;
  readonly score: number;
}

export type RuntimeEvent =
  | {
      readonly kind: "speech-requested";
      readonly speakerId: Id<"actor"> | null;
      readonly text: string;
    }
  | { readonly kind: "flag-changed"; readonly flag: string; readonly value: boolean }
  | {
      readonly kind: "variable-changed";
      readonly variable: string;
      readonly value: Scalar;
    }
  | { readonly kind: "item-given"; readonly itemId: Id<"item"> }
  | { readonly kind: "item-removed"; readonly itemId: Id<"item"> }
  | {
      readonly kind: "score-awarded";
      readonly awardId: Id<"score-award">;
      readonly points: number;
      readonly total: number;
    }
  | {
      readonly kind: "scene-change-requested";
      readonly sceneId: Id<"scene">;
      readonly entranceId: Id<"entrance">;
    }
  | { readonly kind: "sequence-requested"; readonly sequenceId: Id<"sequence"> }
  | {
      readonly kind: "dialogue-requested";
      readonly dialogueId: Id<"dialogue">;
      readonly nodeId: Id<"dialogue-node"> | null;
    }
  | {
      readonly kind: "object-state-changed";
      readonly objectId: Id<"object">;
      readonly state: string;
    }
  | {
      readonly kind: "interaction-completed";
      readonly interactionId: Id<"interaction">;
    }
  | {
      readonly kind: "dialogue-choice-completed";
      readonly choiceId: Id<"dialogue-choice">;
    }
  | {
      readonly kind: "dialogue-node-entered";
      readonly dialogueId: Id<"dialogue">;
      readonly nodeId: Id<"dialogue-node">;
    }
  | {
      readonly kind: "dialogue-ended";
      readonly dialogueId: Id<"dialogue">;
    }
  | {
      readonly kind: "random-generated";
      readonly stream: string;
      readonly value: number;
    };

export interface RuntimeTransition {
  readonly state: RuntimeState;
  readonly events: readonly RuntimeEvent[];
}

export type InteractionResult =
  | { readonly kind: "accepted"; readonly transition: RuntimeTransition }
  | {
      readonly kind: "rejected";
      readonly reason: "already-used" | "condition-failed";
      readonly state: RuntimeState;
    };

const normalizeSeed = (seed: number): number => {
  const normalized = seed >>> 0;
  return normalized === 0 ? 0x6d2b79f5 : normalized;
};

export const createInitialState = (
  project: AdventureProject,
  seed = 0x45564156,
): RuntimeState => {
  const startScene = project.scenes.find((scene) => scene.id === project.startSceneId);
  if (!startScene) {
    throw new Error(`Start scene '${project.startSceneId}' does not exist.`);
  }

  if (!startScene.entrances.some((entrance) => entrance.id === project.startEntranceId)) {
    throw new Error(
      `Start entrance '${project.startEntranceId}' does not exist in scene '${startScene.id}'.`,
    );
  }

  return {
    schemaVersion: 1,
    projectId: project.id,
    tick: 0,
    currentSceneId: project.startSceneId,
    currentEntranceId: project.startEntranceId,
    flags: {},
    variables: {},
    inventory: [],
    awardedScoreIds: [],
    consumedInteractionIds: [],
    consumedDialogueChoiceIds: [],
    activeDialogue: null,
    objectStates: {},
    randomStreams: { main: normalizeSeed(seed) },
    score: 0,
  };
};

const compareScalars = (
  actual: Scalar,
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte",
  expected: Scalar,
): boolean => {
  if (operator === "eq") {
    return actual === expected;
  }
  if (operator === "neq") {
    return actual !== expected;
  }

  if (typeof actual !== typeof expected) {
    return false;
  }

  if (typeof actual === "number" && typeof expected === "number") {
    switch (operator) {
      case "gt":
        return actual > expected;
      case "gte":
        return actual >= expected;
      case "lt":
        return actual < expected;
      case "lte":
        return actual <= expected;
    }
  }

  if (typeof actual === "string" && typeof expected === "string") {
    switch (operator) {
      case "gt":
        return actual > expected;
      case "gte":
        return actual >= expected;
      case "lt":
        return actual < expected;
      case "lte":
        return actual <= expected;
    }
  }

  return false;
};

export const evaluateCondition = (
  condition: Condition,
  state: RuntimeState,
): boolean => {
  switch (condition.kind) {
    case "always":
      return true;
    case "flag":
      return (state.flags[condition.flag] ?? false) === condition.equals;
    case "variable": {
      const actual = state.variables[condition.variable];
      return actual === undefined
        ? false
        : compareScalars(actual, condition.operator, condition.value);
    }
    case "has-item":
      return state.inventory.includes(condition.itemId);
    case "interaction-used":
      return state.consumedInteractionIds.includes(condition.interactionId);
    case "dialogue-choice-used":
      return state.consumedDialogueChoiceIds.includes(condition.choiceId);
    case "all":
      return condition.conditions.every((child) => evaluateCondition(child, state));
    case "any":
      return condition.conditions.some((child) => evaluateCondition(child, state));
    case "not":
      return !evaluateCondition(condition.condition, state);
  }
};

const applyAction = (state: RuntimeState, action: Action): RuntimeTransition => {
  switch (action.kind) {
    case "say":
      return {
        state,
        events: [
          {
            kind: "speech-requested",
            speakerId: action.speakerId ?? null,
            text: action.text,
          },
        ],
      };
    case "set-flag":
      return {
        state: {
          ...state,
          flags: { ...state.flags, [action.flag]: action.value },
        },
        events: [{ kind: "flag-changed", flag: action.flag, value: action.value }],
      };
    case "set-variable":
      return {
        state: {
          ...state,
          variables: { ...state.variables, [action.variable]: action.value },
        },
        events: [
          {
            kind: "variable-changed",
            variable: action.variable,
            value: action.value,
          },
        ],
      };
    case "give-item":
      if (state.inventory.includes(action.itemId)) {
        return { state, events: [] };
      }
      return {
        state: { ...state, inventory: [...state.inventory, action.itemId] },
        events: [{ kind: "item-given", itemId: action.itemId }],
      };
    case "remove-item":
      if (!state.inventory.includes(action.itemId)) {
        return { state, events: [] };
      }
      return {
        state: {
          ...state,
          inventory: state.inventory.filter((itemId) => itemId !== action.itemId),
        },
        events: [{ kind: "item-removed", itemId: action.itemId }],
      };
    case "award-score":
      if (state.awardedScoreIds.includes(action.awardId)) {
        return { state, events: [] };
      }
      return {
        state: {
          ...state,
          awardedScoreIds: [...state.awardedScoreIds, action.awardId],
          score: state.score + action.points,
        },
        events: [
          {
            kind: "score-awarded",
            awardId: action.awardId,
            points: action.points,
            total: state.score + action.points,
          },
        ],
      };
    case "change-scene":
      return {
        state: {
          ...state,
          currentSceneId: action.sceneId,
          currentEntranceId: action.entranceId,
        },
        events: [
          {
            kind: "scene-change-requested",
            sceneId: action.sceneId,
            entranceId: action.entranceId,
          },
        ],
      };
    case "play-sequence":
      return {
        state,
        events: [{ kind: "sequence-requested", sequenceId: action.sequenceId }],
      };
    case "start-dialogue":
      return {
        state,
        events: [
          {
            kind: "dialogue-requested",
            dialogueId: action.dialogueId,
            nodeId: action.nodeId ?? null,
          },
        ],
      };
    case "set-object-state":
      return {
        state: {
          ...state,
          objectStates: { ...state.objectStates, [action.objectId]: action.state },
        },
        events: [
          {
            kind: "object-state-changed",
            objectId: action.objectId,
            state: action.state,
          },
        ],
      };
  }
};

export const applyActions = (
  state: RuntimeState,
  actions: readonly Action[],
): RuntimeTransition => {
  let nextState = state;
  const events: RuntimeEvent[] = [];

  for (const action of actions) {
    const transition = applyAction(nextState, action);
    nextState = transition.state;
    events.push(...transition.events);
  }

  return { state: nextState, events };
};

export const runInteraction = (
  state: RuntimeState,
  interaction: Interaction,
): InteractionResult => {
  if (interaction.once && state.consumedInteractionIds.includes(interaction.id)) {
    return { kind: "rejected", reason: "already-used", state };
  }

  if (interaction.when && !evaluateCondition(interaction.when, state)) {
    return { kind: "rejected", reason: "condition-failed", state };
  }

  const transition = applyActions(state, interaction.actions);
  const shouldConsume = interaction.once === true;
  const nextState = shouldConsume
    ? {
        ...transition.state,
        consumedInteractionIds: [
          ...transition.state.consumedInteractionIds,
          interaction.id,
        ],
      }
    : transition.state;

  return {
    kind: "accepted",
    transition: {
      state: nextState,
      events: [
        ...transition.events,
        { kind: "interaction-completed", interactionId: interaction.id },
      ],
    },
  };
};

export const advanceTicks = (state: RuntimeState, ticks: number): RuntimeState => {
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError("Tick advancement must be a non-negative safe integer.");
  }
  return { ...state, tick: state.tick + ticks };
};

export const nextRandom = (
  state: RuntimeState,
  stream = "main",
): RuntimeTransition & { readonly value: number } => {
  const current = normalizeSeed(state.randomStreams[stream] ?? 0x6d2b79f5);
  let next = current;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  next >>>= 0;

  const value = next / 0x1_0000_0000;
  return {
    value,
    state: {
      ...state,
      randomStreams: { ...state.randomStreams, [stream]: next },
    },
    events: [{ kind: "random-generated", stream, value }],
  };
};
