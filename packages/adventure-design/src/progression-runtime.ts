import type {
  Action,
  AdventureProject,
  Condition,
  DialogueChoice,
  DialogueGraph,
  DialogueNode,
  Id,
  Scalar,
  Sequence,
} from "@evavo/adventure-project-schema";
import type { SceneInstanceManifest } from "@evavo/adventure-scene-instances";
import type {
  AdventureProgressionOptions,
  AdventureProgressionRuntimeState,
} from "./progression-types.js";

export interface AdventureProgressionRuntimeContext {
  readonly project: AdventureProject;
  readonly sceneInstances: SceneInstanceManifest;
  readonly dialoguesById: ReadonlyMap<string, DialogueGraph>;
  readonly sequencesById: ReadonlyMap<string, Sequence>;
  readonly maximumNestedRequests: number;
  readonly recursiveSequenceIds: Set<string>;
  readonly recursiveDialogueIds: Set<string>;
  readonly loopingSequenceIds: Set<string>;
}

export type AdventureProgressionNarrativeRequest =
  | {
      readonly kind: "sequence";
      readonly sequenceId: Id<"sequence">;
    }
  | {
      readonly kind: "dialogue";
      readonly dialogueId: Id<"dialogue">;
      readonly nodeId: Id<"dialogue-node"> | null;
    };

export interface AdventureProgressionImmediateResult {
  readonly state: AdventureProgressionRuntimeState;
  readonly requests: readonly AdventureProgressionNarrativeRequest[];
}

const sortedUnique = <T extends string>(values: readonly T[]): T[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const sortedRecord = <T>(
  record: Readonly<Record<string, T>>,
): Readonly<Record<string, T>> =>
  Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );

export const canonicalAdventureProgressionState = (
  state: AdventureProgressionRuntimeState,
): AdventureProgressionRuntimeState => ({
  ...state,
  flags: sortedRecord(state.flags),
  variables: sortedRecord(state.variables),
  inventoryItemIds: sortedUnique(state.inventoryItemIds),
  consumedInteractionIds: sortedUnique(state.consumedInteractionIds),
  consumedDialogueChoiceIds: sortedUnique(state.consumedDialogueChoiceIds),
  objectStates: sortedRecord(state.objectStates),
  visitedSceneIds: sortedUnique(state.visitedSceneIds),
  acquiredItemIds: sortedUnique(state.acquiredItemIds),
  reachedDialogueIds: sortedUnique(state.reachedDialogueIds),
  reachedSequenceIds: sortedUnique(state.reachedSequenceIds),
});

export const adventureProgressionStateHash = (
  state: AdventureProgressionRuntimeState,
): string => JSON.stringify(canonicalAdventureProgressionState(state));

export const createAdventureProgressionRuntimeContext = (
  project: AdventureProject,
  sceneInstances: SceneInstanceManifest,
  options: AdventureProgressionOptions = {},
): AdventureProgressionRuntimeContext => ({
  project,
  sceneInstances,
  dialoguesById: new Map(
    project.dialogues.map((dialogue) => [dialogue.id as string, dialogue] as const),
  ),
  sequencesById: new Map(
    project.sequences.map((sequence) => [sequence.id as string, sequence] as const),
  ),
  maximumNestedRequests:
    options.maximumNestedRequests ?? options.maximumNestedSequences ?? 16,
  recursiveSequenceIds: new Set<string>(),
  recursiveDialogueIds: new Set<string>(),
  loopingSequenceIds: new Set<string>(),
});

export const createInitialAdventureProgressionState = (
  project: AdventureProject,
  sceneInstances: SceneInstanceManifest,
): AdventureProgressionRuntimeState => {
  const definitions = new Map(
    sceneInstances.objectDefinitions.map(
      (definition) => [definition.id as string, definition] as const,
    ),
  );
  const objectStates: Record<string, string> = {};
  for (const composition of sceneInstances.scenes) {
    for (const instance of composition.objectInstances) {
      const definition = definitions.get(instance.definitionId);
      if (!definition) continue;
      objectStates[instance.id] =
        instance.initialStateId ?? definition.initialStateId;
    }
  }

  return canonicalAdventureProgressionState({
    currentSceneId: project.startSceneId,
    flags: {},
    variables: {},
    inventoryItemIds: [],
    consumedInteractionIds: [],
    consumedDialogueChoiceIds: [],
    objectStates,
    activeDialogue: null,
    visitedSceneIds: [project.startSceneId],
    acquiredItemIds: [],
    reachedDialogueIds: [],
    reachedSequenceIds: [],
  });
};

const compareScalars = (
  actual: Scalar,
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte",
  expected: Scalar,
): boolean => {
  if (operator === "eq") return actual === expected;
  if (operator === "neq") return actual !== expected;
  if (typeof actual !== typeof expected) return false;
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

export const evaluateAdventureProgressionCondition = (
  condition: Condition,
  state: AdventureProgressionRuntimeState,
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
      return state.inventoryItemIds.includes(condition.itemId);
    case "interaction-used":
      return state.consumedInteractionIds.includes(condition.interactionId);
    case "dialogue-choice-used":
      return state.consumedDialogueChoiceIds.includes(condition.choiceId);
    case "all":
      return condition.conditions.every((child) =>
        evaluateAdventureProgressionCondition(child, state),
      );
    case "any":
      return condition.conditions.some((child) =>
        evaluateAdventureProgressionCondition(child, state),
      );
    case "not":
      return !evaluateAdventureProgressionCondition(condition.condition, state);
  }
};

const withReachedSequence = (
  state: AdventureProgressionRuntimeState,
  sequenceId: Id<"sequence">,
): AdventureProgressionRuntimeState => ({
  ...state,
  reachedSequenceIds: sortedUnique([...state.reachedSequenceIds, sequenceId]),
});

const withReachedDialogue = (
  state: AdventureProgressionRuntimeState,
  dialogueId: Id<"dialogue">,
): AdventureProgressionRuntimeState => ({
  ...state,
  reachedDialogueIds: sortedUnique([...state.reachedDialogueIds, dialogueId]),
});

export const applyImmediateAdventureProgressionActions = (
  state: AdventureProgressionRuntimeState,
  actions: readonly Action[],
): AdventureProgressionImmediateResult => {
  let next = state;
  const requests: AdventureProgressionNarrativeRequest[] = [];
  for (const action of actions) {
    switch (action.kind) {
      case "say":
      case "award-score":
        break;
      case "set-flag":
        next = { ...next, flags: { ...next.flags, [action.flag]: action.value } };
        break;
      case "set-variable":
        next = {
          ...next,
          variables: { ...next.variables, [action.variable]: action.value },
        };
        break;
      case "give-item":
        next = {
          ...next,
          inventoryItemIds: sortedUnique([...next.inventoryItemIds, action.itemId]),
          acquiredItemIds: sortedUnique([...next.acquiredItemIds, action.itemId]),
        };
        break;
      case "remove-item":
        next = {
          ...next,
          inventoryItemIds: next.inventoryItemIds.filter(
            (itemId) => itemId !== action.itemId,
          ),
        };
        break;
      case "change-scene":
        next = {
          ...next,
          currentSceneId: action.sceneId,
          visitedSceneIds: sortedUnique([...next.visitedSceneIds, action.sceneId]),
        };
        break;
      case "play-sequence":
        requests.push({ kind: "sequence", sequenceId: action.sequenceId });
        break;
      case "start-dialogue":
        requests.push({
          kind: "dialogue",
          dialogueId: action.dialogueId,
          nodeId: action.nodeId ?? null,
        });
        break;
      case "set-object-state":
        next = {
          ...next,
          objectStates: { ...next.objectStates, [action.objectId]: action.state },
        };
        break;
    }
  }
  return {
    state: canonicalAdventureProgressionState(next),
    requests,
  };
};

const requestKey = (request: AdventureProgressionNarrativeRequest): string =>
  request.kind === "sequence"
    ? `sequence:${request.sequenceId}`
    : `dialogue:${request.dialogueId}:${request.nodeId ?? "start"}`;

const scheduledStoryActions = (sequence: Sequence): readonly Action[] =>
  sequence.tracks
    .flatMap((track) =>
      track.cues.map((cue, cueIndex) => ({ trackId: track.id, cueIndex, cue })),
    )
    .filter(
      (entry): entry is {
        readonly trackId: Id<"sequence-track">;
        readonly cueIndex: number;
        readonly cue: Extract<
          Sequence["tracks"][number]["cues"][number],
          { readonly kind: "story-action" }
        >;
      } => entry.cue.kind === "story-action",
    )
    .sort(
      (left, right) =>
        left.cue.atTick - right.cue.atTick ||
        left.trackId.localeCompare(right.trackId) ||
        left.cueIndex - right.cueIndex,
    )
    .map((entry) => entry.cue.action);

export const processAdventureProgressionRequests = (
  state: AdventureProgressionRuntimeState,
  requests: readonly AdventureProgressionNarrativeRequest[],
  context: AdventureProgressionRuntimeContext,
  requestStack: readonly string[],
): AdventureProgressionRuntimeState => {
  let next = state;
  for (const request of requests) {
    const key = requestKey(request);
    if (
      requestStack.includes(key) ||
      requestStack.length >= context.maximumNestedRequests
    ) {
      if (request.kind === "sequence") {
        context.recursiveSequenceIds.add(request.sequenceId);
        next = withReachedSequence(next, request.sequenceId);
      } else {
        context.recursiveDialogueIds.add(request.dialogueId);
        next = withReachedDialogue(next, request.dialogueId);
      }
      continue;
    }
    const nestedStack = [...requestStack, key];
    if (request.kind === "dialogue") {
      const graph = context.dialoguesById.get(request.dialogueId);
      if (!graph) continue;
      const nodeId = request.nodeId ?? graph.startNodeId;
      const node = graph.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) continue;
      const entered = applyImmediateAdventureProgressionActions(
        withReachedDialogue(next, graph.id),
        node.enterActions,
      );
      next = canonicalAdventureProgressionState({
        ...entered.state,
        activeDialogue: { dialogueId: graph.id, nodeId: node.id },
      });
      next = processAdventureProgressionRequests(
        next,
        entered.requests,
        context,
        nestedStack,
      );
      continue;
    }

    const sequence = context.sequencesById.get(request.sequenceId);
    if (!sequence) continue;
    next = withReachedSequence(next, sequence.id);
    const timeline = applyImmediateAdventureProgressionActions(
      next,
      scheduledStoryActions(sequence),
    );
    let boundaryState = timeline.state;
    let boundaryRequests = [...timeline.requests];
    if (sequence.loop) {
      context.loopingSequenceIds.add(sequence.id);
    } else {
      const completed = applyImmediateAdventureProgressionActions(
        boundaryState,
        sequence.skip.completionActions,
      );
      boundaryState = completed.state;
      boundaryRequests = [...boundaryRequests, ...completed.requests];
    }
    next = processAdventureProgressionRequests(
      boundaryState,
      boundaryRequests,
      context,
      nestedStack,
    );
  }
  return canonicalAdventureProgressionState(next);
};

export const applyAdventureProgressionActions = (
  state: AdventureProgressionRuntimeState,
  actions: readonly Action[],
  context: AdventureProgressionRuntimeContext,
  requestStack: readonly string[] = [],
): AdventureProgressionRuntimeState => {
  const immediate = applyImmediateAdventureProgressionActions(state, actions);
  return processAdventureProgressionRequests(
    immediate.state,
    immediate.requests,
    context,
    requestStack,
  );
};

const dialogueNode = (
  state: AdventureProgressionRuntimeState,
  context: AdventureProgressionRuntimeContext,
): { readonly graph: DialogueGraph; readonly node: DialogueNode } | null => {
  const active = state.activeDialogue;
  if (!active) return null;
  const graph = context.dialoguesById.get(active.dialogueId);
  const node = graph?.nodes.find((candidate) => candidate.id === active.nodeId);
  return graph && node ? { graph, node } : null;
};

export const activeAdventureProgressionDialogue = dialogueNode;

const enterDialogueNodeImmediate = (
  state: AdventureProgressionRuntimeState,
  graph: DialogueGraph,
  node: DialogueNode,
): AdventureProgressionImmediateResult => {
  const entered = applyImmediateAdventureProgressionActions(
    withReachedDialogue(state, graph.id),
    node.enterActions,
  );
  return {
    state: canonicalAdventureProgressionState({
      ...entered.state,
      activeDialogue: { dialogueId: graph.id, nodeId: node.id },
    }),
    requests: entered.requests,
  };
};

const choiceById = (
  node: DialogueNode,
  choiceId: Id<"dialogue-choice">,
): DialogueChoice | undefined =>
  node.choices.find((candidate) => candidate.id === choiceId);

export const transitionAdventureProgressionDialogueChoice = (
  state: AdventureProgressionRuntimeState,
  graph: DialogueGraph,
  node: DialogueNode,
  choiceId: Id<"dialogue-choice">,
  context: AdventureProgressionRuntimeContext,
): AdventureProgressionRuntimeState => {
  const choice = choiceById(node, choiceId);
  if (!choice) return state;
  let next: AdventureProgressionRuntimeState = choice.once
    ? {
        ...state,
        consumedDialogueChoiceIds: sortedUnique([
          ...state.consumedDialogueChoiceIds,
          choice.id,
        ]),
      }
    : state;
  const choiceActions = applyImmediateAdventureProgressionActions(
    next,
    choice.actions,
  );
  const exited = applyImmediateAdventureProgressionActions(
    choiceActions.state,
    node.exitActions,
  );
  const requests = [...choiceActions.requests, ...exited.requests];
  next = exited.state;

  if (choice.closeDialogue) {
    next = canonicalAdventureProgressionState({ ...next, activeDialogue: null });
  } else {
    const nextNodeId = choice.nextNodeId ?? node.autoNextNodeId ?? null;
    const nextNode = nextNodeId
      ? graph.nodes.find((candidate) => candidate.id === nextNodeId)
      : undefined;
    if (nextNode) {
      const entered = enterDialogueNodeImmediate(next, graph, nextNode);
      next = entered.state;
      requests.push(...entered.requests);
    } else {
      next = canonicalAdventureProgressionState({ ...next, activeDialogue: null });
    }
  }

  return processAdventureProgressionRequests(next, requests, context, []);
};

export const continueAdventureProgressionDialogue = (
  state: AdventureProgressionRuntimeState,
  graph: DialogueGraph,
  node: DialogueNode,
  context: AdventureProgressionRuntimeContext,
): AdventureProgressionRuntimeState => {
  const exited = applyImmediateAdventureProgressionActions(
    state,
    node.exitActions,
  );
  let next = exited.state;
  const requests = [...exited.requests];
  if (node.autoNextNodeId) {
    const nextNode = graph.nodes.find(
      (candidate) => candidate.id === node.autoNextNodeId,
    );
    if (nextNode) {
      const entered = enterDialogueNodeImmediate(next, graph, nextNode);
      next = entered.state;
      requests.push(...entered.requests);
    } else {
      next = canonicalAdventureProgressionState({ ...next, activeDialogue: null });
    }
  } else {
    next = canonicalAdventureProgressionState({ ...next, activeDialogue: null });
  }
  return processAdventureProgressionRequests(next, requests, context, []);
};
