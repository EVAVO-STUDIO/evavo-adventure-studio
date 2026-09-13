import type {
  DynamixCinematicActionSequence,
  DynamixCinematicAnchor,
  DynamixCinematicCommand,
  DynamixCinematicContract,
  DynamixCinematicReplay,
  DynamixCinematicState,
} from "./dynamix-cinematic-types.js";

const safeInteger = (value: number, label: string, minimum = 0): void => {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${label} must be a safe integer greater than or equal to ${minimum}.`);
  }
};

const flagsWith = (
  flags: Readonly<Record<string, boolean>>,
  ids: readonly string[],
): Readonly<Record<string, boolean>> => {
  if (ids.length === 0) return flags;
  const next = { ...flags };
  for (const id of ids) next[id] = true;
  return next;
};

const requirementsMet = (
  flags: Readonly<Record<string, boolean>>,
  requiredFlags: readonly string[],
): boolean => requiredFlags.every((id) => flags[id] === true);

const relationshipDefinition = (
  contract: DynamixCinematicContract,
  id: string,
) => {
  const definition = contract.relationships.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`Unknown relationship '${id}' in '${contract.id}'.`);
  return definition;
};

const applyRelationshipChanges = (
  contract: DynamixCinematicContract,
  relationships: Readonly<Record<string, number>>,
  changes: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> => {
  if (Object.keys(changes).length === 0) return relationships;
  const next = { ...relationships };
  for (const [id, change] of Object.entries(changes)) {
    if (!Number.isFinite(change)) throw new RangeError(`Relationship change '${id}' is not finite.`);
    const definition = relationshipDefinition(contract, id);
    const current = next[id] ?? definition.initialValue;
    next[id] = Math.min(definition.maximum, Math.max(definition.minimum, current + change));
  }
  return next;
};

const startGameMinute = (contract: DynamixCinematicContract): number =>
  contract.start.day * 24 * 60 + contract.start.hour * 60 + contract.start.minute;

const anchorFromState = (state: DynamixCinematicState): DynamixCinematicAnchor => ({
  tick: state.tick,
  gameMinute: state.gameMinute,
  clockRemainderTicks: state.clockRemainderTicks,
  locationId: state.locationId,
  protagonistId: state.protagonistId,
  flags: { ...state.flags },
  relationships: { ...state.relationships },
  routeHistory: [...state.routeHistory],
  choiceHistory: [...state.choiceHistory],
});

const restoreAnchor = (
  state: DynamixCinematicState,
  anchor: DynamixCinematicAnchor,
): DynamixCinematicState => ({
  ...state,
  tick: anchor.tick,
  gameMinute: anchor.gameMinute,
  clockRemainderTicks: anchor.clockRemainderTicks,
  locationId: anchor.locationId,
  protagonistId: anchor.protagonistId,
  flags: { ...anchor.flags },
  relationships: { ...anchor.relationships },
  routeHistory: [...anchor.routeHistory],
  choiceHistory: [...anchor.choiceHistory],
  activeAction: null,
  safeAnchor: anchor,
  lastActionResult: null,
  terminalOutcomeId: null,
});

const actionById = (
  contract: DynamixCinematicContract,
  id: string,
): DynamixCinematicActionSequence => {
  const sequence = contract.actions.find((candidate) => candidate.id === id);
  if (!sequence) throw new Error(`Unknown action sequence '${id}' in '${contract.id}'.`);
  return sequence;
};

const outcomeRequirementsMet = (
  state: DynamixCinematicState,
  requiredFlags: readonly string[],
  minimumRelationships: Readonly<Record<string, number>>,
): boolean =>
  requirementsMet(state.flags, requiredFlags) &&
  Object.entries(minimumRelationships).every(
    ([id, minimum]) => (state.relationships[id] ?? Number.NEGATIVE_INFINITY) >= minimum,
  );

export const resolveDynamixCinematicOutcome = (
  contract: DynamixCinematicContract,
  state: DynamixCinematicState,
): string | null => {
  for (const deadline of contract.deadlines) {
    if (state.gameMinute >= deadline.gameMinute && state.flags[deadline.requiredFlag] !== true) {
      return deadline.failureOutcomeId;
    }
  }
  for (const outcome of contract.outcomes) {
    if (
      outcome.requiredFlags.length > 0 &&
      outcomeRequirementsMet(state, outcome.requiredFlags, outcome.minimumRelationships)
    ) {
      return outcome.id;
    }
  }
  return null;
};

const withResolvedOutcome = (
  contract: DynamixCinematicContract,
  state: DynamixCinematicState,
): DynamixCinematicState => ({
  ...state,
  terminalOutcomeId: resolveDynamixCinematicOutcome(contract, state),
});

export const createDynamixCinematicState = (
  contract: DynamixCinematicContract,
): DynamixCinematicState => {
  const relationships = Object.fromEntries(
    contract.relationships.map((definition) => [definition.id, definition.initialValue]),
  );
  const protagonist = contract.protagonists.find(
    (candidate) => candidate.id === contract.start.protagonistId,
  );
  if (!protagonist) {
    throw new Error(
      `Dynamix contract '${contract.id}' start protagonist '${contract.start.protagonistId}' is missing.`,
    );
  }
  const flags = Object.fromEntries(
    protagonist.knowledgeFlags.map((id) => [id, true]),
  ) as Readonly<Record<string, boolean>>;
  return {
    stateVersion: 1,
    contractId: contract.id,
    tick: 0,
    gameMinute: startGameMinute(contract),
    clockRemainderTicks: 0,
    locationId: contract.start.locationId,
    protagonistId: protagonist.id,
    flags,
    relationships,
    routeHistory: [],
    choiceHistory: [],
    activeAction: null,
    safeAnchor: null,
    lastActionResult: null,
    terminalOutcomeId: null,
  };
};

const addGameMinutes = (
  contract: DynamixCinematicContract,
  state: DynamixCinematicState,
  minutes: number,
): DynamixCinematicState => {
  safeInteger(minutes, "Game-minute advance");
  return withResolvedOutcome(contract, {
    ...state,
    gameMinute: state.gameMinute + minutes,
  });
};

const completeAction = (
  contract: DynamixCinematicContract,
  state: DynamixCinematicState,
  sequence: DynamixCinematicActionSequence,
): DynamixCinematicState => {
  const active = state.activeAction;
  if (!active) return state;
  const accepted = new Set(active.acceptedWindowIds);
  const success = !active.failed && sequence.windows.every((window) => accepted.has(window.id));
  const relationships = applyRelationshipChanges(
    contract,
    state.relationships,
    success
      ? sequence.successRelationshipChanges
      : sequence.failureRelationshipChanges,
  );
  const flags = flagsWith(
    state.flags,
    success ? sequence.successFlags : sequence.failureFlags,
  );
  const result = {
    sequenceId: sequence.id,
    outcome: success ? ("success" as const) : ("failure" as const),
    resolvedAtTick: state.tick,
    consequence: success ? sequence.successConsequence : sequence.failureConsequence,
  };
  return withResolvedOutcome(contract, {
    ...state,
    gameMinute: state.gameMinute + sequence.timeCostMinutes,
    flags,
    relationships,
    activeAction: null,
    lastActionResult: result,
  });
};

const advanceTicks = (
  contract: DynamixCinematicContract,
  state: DynamixCinematicState,
  ticks: number,
): DynamixCinematicState => {
  safeInteger(ticks, "Tick advance");
  let gameMinute = state.gameMinute;
  let clockRemainderTicks = state.clockRemainderTicks;
  if (contract.timing.clockMode === "continuous") {
    const combined = clockRemainderTicks + ticks;
    const addedMinutes = Math.floor(combined / contract.timing.ticksPerGameMinute);
    gameMinute += addedMinutes;
    clockRemainderTicks = combined % contract.timing.ticksPerGameMinute;
  }
  let next: DynamixCinematicState = {
    ...state,
    tick: state.tick + ticks,
    gameMinute,
    clockRemainderTicks,
  };
  if (next.activeAction) {
    const sequence = actionById(contract, next.activeAction.sequenceId);
    const localTick = next.tick - next.activeAction.startedAtTick;
    if (localTick >= sequence.durationTicks) {
      next = completeAction(contract, next, sequence);
    }
  }
  return withResolvedOutcome(contract, next);
};

const switchProtagonist = (
  contract: DynamixCinematicContract,
  state: DynamixCinematicState,
  protagonistId: string,
): DynamixCinematicState => {
  if (state.activeAction) throw new Error("Cannot switch protagonists during an action sequence.");
  const protagonist = contract.protagonists.find((candidate) => candidate.id === protagonistId);
  if (!protagonist) {
    throw new Error(`Unknown protagonist '${protagonistId}' in '${contract.id}'.`);
  }
  return {
    ...state,
    protagonistId,
    flags: flagsWith(state.flags, protagonist.knowledgeFlags),
  };
};

const travel = (
  contract: DynamixCinematicContract,
  state: DynamixCinematicState,
  routeId: string,
): DynamixCinematicState => {
  if (state.activeAction) throw new Error("Cannot travel during an action sequence.");
  const route = contract.routes.find((candidate) => candidate.id === routeId);
  if (!route) throw new Error(`Unknown route '${routeId}' in '${contract.id}'.`);
  if (route.fromLocationId !== state.locationId) {
    throw new Error(
      `Route '${routeId}' starts at '${route.fromLocationId}', not '${state.locationId}'.`,
    );
  }
  if (!route.allowedProtagonistIds.includes(state.protagonistId)) {
    throw new Error(`Protagonist '${state.protagonistId}' cannot use route '${routeId}'.`);
  }
  if (!requirementsMet(state.flags, route.requiredFlags)) {
    throw new Error(`Route '${routeId}' requirements are not satisfied.`);
  }
  return withResolvedOutcome(contract, {
    ...state,
    gameMinute: state.gameMinute + route.costMinutes,
    locationId: route.toLocationId,
    flags: flagsWith(state.flags, route.setFlags),
    relationships: applyRelationshipChanges(
      contract,
      state.relationships,
      route.relationshipChanges,
    ),
    routeHistory: [...state.routeHistory, route.id],
  });
};

const choose = (
  contract: DynamixCinematicContract,
  state: DynamixCinematicState,
  choiceId: string,
): DynamixCinematicState => {
  if (state.activeAction) throw new Error("Cannot choose a dialogue branch during an action sequence.");
  const choice = contract.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error(`Unknown cinematic choice '${choiceId}' in '${contract.id}'.`);
  if (!requirementsMet(state.flags, choice.requiredFlags)) {
    throw new Error(`Choice '${choiceId}' requirements are not satisfied.`);
  }
  return withResolvedOutcome(contract, {
    ...state,
    gameMinute: state.gameMinute + choice.timeCostMinutes,
    flags: flagsWith(state.flags, choice.setFlags),
    relationships: applyRelationshipChanges(
      contract,
      state.relationships,
      choice.relationshipChanges,
    ),
    choiceHistory: [...state.choiceHistory, choice.id],
  });
};

const startAction = (
  contract: DynamixCinematicContract,
  state: DynamixCinematicState,
  sequenceId: string,
): DynamixCinematicState => {
  if (state.activeAction) throw new Error("An action sequence is already active.");
  const sequence = actionById(contract, sequenceId);
  if (sequence.locationId !== state.locationId) {
    throw new Error(
      `Action '${sequenceId}' belongs to '${sequence.locationId}', not '${state.locationId}'.`,
    );
  }
  return {
    ...state,
    safeAnchor: anchorFromState(state),
    lastActionResult: null,
    activeAction: {
      sequenceId,
      startedAtTick: state.tick,
      acceptedWindowIds: [],
      failed: false,
    },
  };
};

const submitActionInput = (
  contract: DynamixCinematicContract,
  state: DynamixCinematicState,
  input: DynamixCinematicCommand & { readonly kind: "action-input" },
): DynamixCinematicState => {
  const active = state.activeAction;
  if (!active) throw new Error("No action sequence is active.");
  const sequence = actionById(contract, active.sequenceId);
  const localTick = state.tick - active.startedAtTick;
  const alreadyAccepted = new Set(active.acceptedWindowIds);
  const window = sequence.windows.find(
    (candidate) =>
      !alreadyAccepted.has(candidate.id) &&
      candidate.input === input.input &&
      localTick >= candidate.opensAtTick &&
      localTick <= candidate.closesAtTick,
  );
  if (!window) {
    return {
      ...state,
      activeAction: {
        ...active,
        failed: true,
      },
    };
  }
  return {
    ...state,
    activeAction: {
      ...active,
      acceptedWindowIds: [...active.acceptedWindowIds, window.id],
    },
  };
};

const retryAction = (
  contract: DynamixCinematicContract,
  state: DynamixCinematicState,
): DynamixCinematicState => {
  if (state.activeAction) throw new Error("Cannot retry while an action sequence is active.");
  if (state.lastActionResult?.outcome !== "failure" || !state.safeAnchor) {
    throw new Error("No failed action sequence is available for retry.");
  }
  const sequenceId = state.lastActionResult.sequenceId;
  return startAction(contract, restoreAnchor(state, state.safeAnchor), sequenceId);
};

export const applyDynamixCinematicCommand = (
  contract: DynamixCinematicContract,
  state: DynamixCinematicState,
  command: DynamixCinematicCommand,
): DynamixCinematicState => {
  if (state.contractId !== contract.id) {
    throw new Error(`State '${state.contractId}' does not belong to contract '${contract.id}'.`);
  }
  if (state.terminalOutcomeId) {
    throw new Error(`Cinematic state is terminal at '${state.terminalOutcomeId}'.`);
  }
  switch (command.kind) {
    case "advance-ticks":
      return advanceTicks(contract, state, command.ticks);
    case "advance-minutes":
      return addGameMinutes(contract, state, command.minutes);
    case "switch-protagonist":
      return switchProtagonist(contract, state, command.protagonistId);
    case "travel":
      return travel(contract, state, command.routeId);
    case "choose":
      return choose(contract, state, command.choiceId);
    case "start-action":
      return startAction(contract, state, command.sequenceId);
    case "action-input":
      return submitActionInput(contract, state, command);
    case "retry-action":
      return retryAction(contract, state);
  }
};

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Readonly<Record<string, unknown>>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalValue(child)]),
    );
  }
  return value;
};

export const canonicalDynamixCinematicJson = (
  state: DynamixCinematicState,
): string => JSON.stringify(canonicalValue(state));

export const dynamixCinematicStateFingerprint = (
  state: DynamixCinematicState,
): string => {
  const text = canonicalDynamixCinematicJson(state);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
};

export const executeDynamixCinematicReplay = (
  contract: DynamixCinematicContract,
  replay: DynamixCinematicReplay,
): {
  readonly state: DynamixCinematicState;
  readonly fingerprint: string;
} => {
  if (replay.contractId !== contract.id) {
    throw new Error(`Replay '${replay.contractId}' does not belong to '${contract.id}'.`);
  }
  let state = createDynamixCinematicState(contract);
  for (const command of replay.commands) {
    state = applyDynamixCinematicCommand(contract, state, command);
  }
  const fingerprint = dynamixCinematicStateFingerprint(state);
  if (replay.expectedFingerprint && replay.expectedFingerprint !== fingerprint) {
    throw new Error(
      `Replay fingerprint '${fingerprint}' does not match '${replay.expectedFingerprint}'.`,
    );
  }
  return { state, fingerprint };
};

export const formatDynamixGameClock = (gameMinute: number): string => {
  safeInteger(gameMinute, "Game clock minute");
  const day = Math.floor(gameMinute / (24 * 60));
  const minuteOfDay = gameMinute % (24 * 60);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `DAY ${day} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};
