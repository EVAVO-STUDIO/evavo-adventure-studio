export type OpenCaseEvidenceState =
  | "untouched"
  | "observed"
  | "photographed"
  | "collected"
  | "bagged"
  | "logged"
  | "analysed";

export type OpenCaseProcedureFailureId =
  | "entry-before-log"
  | "collect-before-photo"
  | "bag-before-collect"
  | "log-before-bag"
  | "analyse-before-log"
  | "ask-before-evidence";

export interface OpenCaseProcedureFailure {
  readonly id: OpenCaseProcedureFailureId;
  readonly message: string;
}

export interface OpenCaseGameplayState {
  readonly entryLogSigned: boolean;
  readonly evidenceState: OpenCaseEvidenceState;
  readonly custodySealed: boolean;
  readonly witnessQuestionUnlocked: boolean;
  readonly contradictionEstablished: boolean;
  readonly labRouteOpen: boolean;
  readonly nextLocationOpen: boolean;
  readonly score: number;
  readonly awardedScoreIds: readonly string[];
  readonly failureCount: number;
  readonly lastFailure: OpenCaseProcedureFailure | null;
}

export interface OpenCaseTransition {
  readonly state: OpenCaseGameplayState;
  readonly changed: boolean;
  readonly feedback: string;
  readonly failure: OpenCaseProcedureFailure | null;
}

const scoreAwards = {
  signedEntry: { id: "open-case.score.signed-entry", points: 2 },
  photographed: { id: "open-case.score.photographed", points: 3 },
  custody: { id: "open-case.score.custody", points: 4 },
  analysis: { id: "open-case.score.analysis", points: 4 },
  contradiction: { id: "open-case.score.contradiction", points: 5 },
  route: { id: "open-case.score.location-open", points: 2 },
} as const;

const award = (
  state: OpenCaseGameplayState,
  awardValue: { readonly id: string; readonly points: number },
): OpenCaseGameplayState => {
  if (state.awardedScoreIds.includes(awardValue.id)) return state;
  return {
    ...state,
    score: state.score + awardValue.points,
    awardedScoreIds: [...state.awardedScoreIds, awardValue.id],
  };
};

const success = (
  previous: OpenCaseGameplayState,
  next: OpenCaseGameplayState,
  feedback: string,
): OpenCaseTransition => ({
  state: { ...next, lastFailure: null },
  changed: next !== previous,
  feedback,
  failure: null,
});

const fail = (
  state: OpenCaseGameplayState,
  id: OpenCaseProcedureFailureId,
  message: string,
): OpenCaseTransition => {
  const failure = { id, message } as const;
  return {
    state: {
      ...state,
      failureCount: state.failureCount + 1,
      lastFailure: failure,
    },
    changed: false,
    feedback: message,
    failure,
  };
};

export const createOpenCaseGameplayState = (): OpenCaseGameplayState => ({
  entryLogSigned: false,
  evidenceState: "untouched",
  custodySealed: false,
  witnessQuestionUnlocked: false,
  contradictionEstablished: false,
  labRouteOpen: false,
  nextLocationOpen: false,
  score: 0,
  awardedScoreIds: [],
  failureCount: 0,
  lastFailure: null,
});

export const enterProtectedScene = (state: OpenCaseGameplayState): OpenCaseTransition =>
  state.entryLogSigned
    ? success(state, state, "The scene officer checks the signed entry log and lifts the boundary tape.")
    : fail(
        state,
        "entry-before-log",
        "The scene officer stops you at the boundary. Sign the entry log before crossing into the protected room.",
      );

export const signOpenCaseEntryLog = (state: OpenCaseGameplayState): OpenCaseTransition => {
  if (state.entryLogSigned) return success(state, state, "Your entry is already recorded.");
  return success(
    state,
    award({ ...state, entryLogSigned: true }, scoreAwards.signedEntry),
    "You sign the entry log with time, name and purpose before crossing the boundary.",
  );
};

export const observeOpenCaseFragment = (state: OpenCaseGameplayState): OpenCaseTransition => {
  if (state.evidenceState !== "untouched") return success(state, state, "The fragment remains where you first documented it.");
  return success(
    state,
    { ...state, evidenceState: "observed" },
    "You inspect the fragment in place and note its position relative to the broken window.",
  );
};

export const photographOpenCaseFragment = (state: OpenCaseGameplayState): OpenCaseTransition => {
  if (["photographed", "collected", "bagged", "logged", "analysed"].includes(state.evidenceState)) {
    return success(state, state, "The scene photograph is already retained with the case.");
  }
  const next = award({ ...state, evidenceState: "photographed" }, scoreAwards.photographed);
  return success(
    state,
    next,
    state.evidenceState === "untouched"
      ? "You photograph the fragment and its surroundings before touching it. The photograph also establishes the original position."
      : "You photograph the observed fragment in place before collection.",
  );
};

export const collectOpenCaseFragment = (state: OpenCaseGameplayState): OpenCaseTransition => {
  if (state.evidenceState === "untouched" || state.evidenceState === "observed") {
    return fail(
      state,
      "collect-before-photo",
      "You stop before lifting the fragment. Its original position has not been photographed; collecting it now would destroy useful scene context.",
    );
  }
  if (["collected", "bagged", "logged", "analysed"].includes(state.evidenceState)) {
    return success(state, state, "The fragment has already been collected.");
  }
  return success(
    state,
    { ...state, evidenceState: "collected" },
    "With the scene photograph retained, you lift the fragment with gloved hands.",
  );
};

export const bagOpenCaseFragment = (state: OpenCaseGameplayState): OpenCaseTransition => {
  if (["untouched", "observed", "photographed"].includes(state.evidenceState)) {
    return fail(
      state,
      "bag-before-collect",
      "The evidence bag stays open on the kit. There is nothing in your custody to seal yet.",
    );
  }
  if (["bagged", "logged", "analysed"].includes(state.evidenceState)) {
    return success(state, state, "The fragment is already sealed in its evidence bag.");
  }
  return success(
    state,
    { ...state, evidenceState: "bagged", custodySealed: true },
    "You seal the fragment in a labelled evidence bag without changing the original case identity.",
  );
};

export const logOpenCaseCustody = (state: OpenCaseGameplayState): OpenCaseTransition => {
  if (!state.custodySealed || state.evidenceState === "collected") {
    return fail(
      state,
      "log-before-bag",
      "The custody form requires a sealed item identifier. Bag and label the fragment before logging the transfer.",
    );
  }
  if (state.evidenceState === "logged" || state.evidenceState === "analysed") {
    return success(state, state, "The custody transfer is already signed and retained.");
  }
  return success(
    state,
    award({ ...state, evidenceState: "logged" }, scoreAwards.custody),
    "You record the sealed item, collection location and transfer time. The chain is now inspectable.",
  );
};

export const analyseOpenCaseFragment = (state: OpenCaseGameplayState): OpenCaseTransition => {
  if (state.evidenceState !== "logged" && state.evidenceState !== "analysed") {
    return fail(
      state,
      "analyse-before-log",
      "The lab will not accept an unlogged item. The analysis must remain traceable to a documented custody chain.",
    );
  }
  if (state.evidenceState === "analysed") return success(state, state, "The lab result is already attached to the case file.");
  return success(
    state,
    award(
      {
        ...state,
        evidenceState: "analysed",
        witnessQuestionUnlocked: true,
        labRouteOpen: true,
      },
      scoreAwards.analysis,
    ),
    "The lab result links the glass composition to the witness-side window and opens a specific interview question.",
  );
};

export const askOpenCaseWitnessAboutWindow = (state: OpenCaseGameplayState): OpenCaseTransition => {
  if (!state.witnessQuestionUnlocked) {
    return fail(
      state,
      "ask-before-evidence",
      "You do not yet have a lawful evidentiary basis for that question. The witness interview remains on the established account.",
    );
  }
  if (state.contradictionEstablished) return success(state, state, "The contradiction is already marked in the interview notes.");
  const next = award(
    { ...state, contradictionEstablished: true },
    scoreAwards.contradiction,
  );
  return success(
    state,
    next,
    "When you place the lab-backed window detail against the earlier statement, the witness revises the account. The contradiction is retained as testimony, not a hidden flag.",
  );
};

export const reviewOpenCaseBoard = (state: OpenCaseGameplayState): OpenCaseTransition => {
  if (state.evidenceState !== "analysed" || !state.contradictionEstablished) {
    return success(
      state,
      state,
      "The caseboard still has an unresolved gap between physical evidence and testimony. No new location can be justified yet.",
    );
  }
  if (state.nextLocationOpen) return success(state, state, "The next case location is already authorised on the board.");
  return success(
    state,
    award({ ...state, nextLocationOpen: true }, scoreAwards.route),
    "The custody chain, lab result and revised testimony now support a new location. The board opens that route without turning it into a quest objective.",
  );
};

export const openCaseProofComplete = (state: OpenCaseGameplayState): boolean =>
  state.entryLogSigned &&
  state.evidenceState === "analysed" &&
  state.contradictionEstablished &&
  state.nextLocationOpen;

export const OPEN_CASE_MAX_SCORE = Object.values(scoreAwards).reduce(
  (sum, entry) => sum + entry.points,
  0,
);
