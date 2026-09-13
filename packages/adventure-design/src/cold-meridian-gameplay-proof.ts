export type ColdMeridianProtagonistId = "technician-a" | "technician-b";
export type ColdMeridianActionState = "idle" | "active" | "failed" | "resolved";

export interface ColdMeridianKnowledgeState {
  readonly "technician-a": readonly string[];
  readonly "technician-b": readonly string[];
  readonly shared: readonly string[];
}

export interface ColdMeridianGameplayState {
  readonly activeProtagonist: ColdMeridianProtagonistId;
  readonly knowledge: ColdMeridianKnowledgeState;
  readonly recordingsCompared: boolean;
  readonly predictionOffsetKnown: boolean;
  readonly relayRouteUnlocked: boolean;
  readonly lateArrival: boolean;
  readonly cutawaySeen: boolean;
  readonly actionState: ColdMeridianActionState;
  readonly retryCheckpointAvailable: boolean;
  readonly interventionResolved: boolean;
  readonly failureCount: number;
  readonly lastFeedback: string;
}

export interface ColdMeridianTransition {
  readonly state: ColdMeridianGameplayState;
  readonly changed: boolean;
  readonly feedback: string;
}

const addUnique = (values: readonly string[], value: string): readonly string[] =>
  values.includes(value) ? values : [...values, value];

const transition = (
  previous: ColdMeridianGameplayState,
  next: ColdMeridianGameplayState,
  feedback: string,
): ColdMeridianTransition => ({
  state: { ...next, lastFeedback: feedback },
  changed: next !== previous,
  feedback,
});

export const createColdMeridianGameplayState = (): ColdMeridianGameplayState => ({
  activeProtagonist: "technician-a",
  knowledge: {
    "technician-a": [],
    "technician-b": [],
    shared: [],
  },
  recordingsCompared: false,
  predictionOffsetKnown: false,
  relayRouteUnlocked: false,
  lateArrival: false,
  cutawaySeen: false,
  actionState: "idle",
  retryCheckpointAvailable: false,
  interventionResolved: false,
  failureCount: 0,
  lastFeedback: "Rain covers the service alley. The relay keeps repeating a call sign that should not know you.",
});

export const switchColdMeridianProtagonist = (
  state: ColdMeridianGameplayState,
  protagonist: ColdMeridianProtagonistId,
): ColdMeridianTransition =>
  protagonist === state.activeProtagonist
    ? transition(state, state, `${protagonist} is already active.`)
    : transition(
        state,
        { ...state, activeProtagonist: protagonist },
        `Control changes to ${protagonist}. Their private recordings and deductions remain separate.`,
      );

export const discoverColdMeridianFact = (
  state: ColdMeridianGameplayState,
  protagonist: ColdMeridianProtagonistId,
  factId: string,
): ColdMeridianTransition => {
  const previousFacts = state.knowledge[protagonist];
  const nextFacts = addUnique(previousFacts, factId);
  if (nextFacts === previousFacts) return transition(state, state, `${protagonist} already knows ${factId}.`);
  return transition(
    state,
    {
      ...state,
      knowledge: {
        ...state.knowledge,
        [protagonist]: nextFacts,
      },
    },
    `${protagonist} records ${factId}. The other technician does not gain it automatically.`,
  );
};

export const exchangeColdMeridianFact = (
  state: ColdMeridianGameplayState,
  from: ColdMeridianProtagonistId,
  to: ColdMeridianProtagonistId,
  factId: string,
): ColdMeridianTransition => {
  if (!state.knowledge[from].includes(factId)) {
    return transition(state, state, `${from} cannot share a fact they have not learned.`);
  }
  const targetFacts = addUnique(state.knowledge[to], factId);
  const shared = addUnique(state.knowledge.shared, factId);
  return transition(
    state,
    {
      ...state,
      knowledge: {
        ...state.knowledge,
        [to]: targetFacts,
        shared,
      },
    },
    `${from} explicitly shares ${factId} with ${to}. The knowledge boundary changes because of an authored exchange, not omniscience.`,
  );
};

export const compareColdMeridianRecordings = (
  state: ColdMeridianGameplayState,
): ColdMeridianTransition => {
  const hasBadge = state.knowledge.shared.includes("fact.signal.badge-number");
  const hasOffset = state.knowledge.shared.includes("fact.signal.prediction-offset");
  if (!hasBadge || !hasOffset) {
    return transition(
      state,
      state,
      "The recordings still disagree in ways neither technician can explain. Share the missing observations before treating them as one signal.",
    );
  }
  return transition(
    state,
    {
      ...state,
      recordingsCompared: true,
      predictionOffsetKnown: true,
      relayRouteUnlocked: true,
    },
    "Aligned timestamps show a consistent prediction offset. The correct relay route and intervention window become available.",
  );
};

export const chooseColdMeridianWrongInference = (
  state: ColdMeridianGameplayState,
): ColdMeridianTransition => {
  if (!state.predictionOffsetKnown) {
    return transition(state, state, "There is not enough shared evidence to commit to that inference yet.");
  }
  const activeFacts = addUnique(
    state.knowledge[state.activeProtagonist],
    "fact.late-arrival.secondary-vehicle",
  );
  return transition(
    state,
    {
      ...state,
      lateArrival: true,
      knowledge: {
        ...state.knowledge,
        [state.activeProtagonist]: activeFacts,
      },
    },
    "The inference sends you to the wrong relay first. You arrive late, but the changed scene reveals a secondary vehicle and new evidence instead of becoming a dead end.",
  );
};

export const triggerColdMeridianHardCutaway = (
  state: ColdMeridianGameplayState,
): ColdMeridianTransition =>
  state.cutawaySeen
    ? transition(state, state, "The cutaway has already resolved and returned to the room.")
    : transition(
        state,
        { ...state, cutawaySeen: true },
        "A hard editorial cut shows the remote relay reacting to the signal, then returns with room and knowledge state intact.",
      );

export const startColdMeridianActionInsert = (
  state: ColdMeridianGameplayState,
): ColdMeridianTransition => {
  if (!state.relayRouteUnlocked) {
    return transition(state, state, "The action route is not yet justified by the signal evidence.");
  }
  if (state.actionState === "resolved") return transition(state, state, "The intervention is already complete.");
  return transition(
    state,
    {
      ...state,
      actionState: "active",
      retryCheckpointAvailable: true,
    },
    "The short intervention begins. A private pre-action checkpoint is retained without touching manual saves.",
  );
};

export const failColdMeridianActionInsert = (
  state: ColdMeridianGameplayState,
): ColdMeridianTransition => {
  if (state.actionState !== "active") return transition(state, state, "There is no active intervention to fail.");
  return transition(
    state,
    {
      ...state,
      actionState: "failed",
      failureCount: state.failureCount + 1,
    },
    "The intervention fails quickly and clearly. Retry returns to the pre-action checkpoint instead of replaying the investigation corridor.",
  );
};

export const retryColdMeridianActionInsert = (
  state: ColdMeridianGameplayState,
): ColdMeridianTransition => {
  if (state.actionState !== "failed" || !state.retryCheckpointAvailable) {
    return transition(state, state, "No bounded intervention retry is available.");
  }
  return transition(
    state,
    { ...state, actionState: "active" },
    "The intervention restarts from the retained pre-action state. Investigation knowledge and manual saves remain untouched.",
  );
};

export const resolveColdMeridianActionInsert = (
  state: ColdMeridianGameplayState,
): ColdMeridianTransition => {
  if (state.actionState !== "active") return transition(state, state, "The intervention must be active before it can resolve.");
  return transition(
    state,
    {
      ...state,
      actionState: "resolved",
      interventionResolved: true,
      retryCheckpointAvailable: false,
    },
    "The intervention resolves. The game returns to investigation state with the established knowledge boundaries intact.",
  );
};

export const coldMeridianProofComplete = (state: ColdMeridianGameplayState): boolean =>
  state.recordingsCompared &&
  state.relayRouteUnlocked &&
  state.cutawaySeen &&
  state.interventionResolved;
