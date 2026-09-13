export type AfterHoursBartenderState = "neutral" | "amused" | "helpful";
export type AfterHoursHostState = "neutral" | "suspicious" | "helpful";
export type AfterHoursFinalAccess = "none" | "social" | "service";

export interface AfterHoursGameplayState {
  readonly minutesElapsed: number;
  readonly money: number;
  readonly bartender: AfterHoursBartenderState;
  readonly host: AfterHoursHostState;
  readonly tabResolved: boolean;
  readonly serviceRouteOpen: boolean;
  readonly spareFlashAvailable: boolean;
  readonly borrowedCoat: boolean;
  readonly receiptKnown: boolean;
  readonly penthouseLeadKnown: boolean;
  readonly serviceCartKnown: boolean;
  readonly finalAccess: AfterHoursFinalAccess;
  readonly score: number;
  readonly awardedScoreIds: readonly string[];
  readonly embarrassmentCount: number;
  readonly lastFeedback: string;
}

export interface AfterHoursTransition {
  readonly state: AfterHoursGameplayState;
  readonly changed: boolean;
  readonly feedback: string;
  readonly embarrassment: boolean;
}

const awards = {
  loungeRoute: { id: "after-hours.score.lounge-route", points: 4 },
  receipt: { id: "after-hours.score.receipt", points: 3 },
  penthouseLead: { id: "after-hours.score.penthouse-lead", points: 5 },
  finalAccess: { id: "after-hours.score.final-access", points: 6 },
} as const;

const award = (
  state: AfterHoursGameplayState,
  value: { readonly id: string; readonly points: number },
): AfterHoursGameplayState => {
  if (state.awardedScoreIds.includes(value.id)) return state;
  return {
    ...state,
    score: state.score + value.points,
    awardedScoreIds: [...state.awardedScoreIds, value.id],
  };
};

const transition = (
  previous: AfterHoursGameplayState,
  next: AfterHoursGameplayState,
  feedback: string,
  embarrassment = false,
): AfterHoursTransition => ({
  state: { ...next, lastFeedback: feedback },
  changed: next !== previous,
  feedback,
  embarrassment,
});

const embarrass = (
  state: AfterHoursGameplayState,
  feedback: string,
  minutes: number,
  patch: Partial<AfterHoursGameplayState> = {},
): AfterHoursTransition =>
  transition(
    state,
    {
      ...state,
      ...patch,
      minutesElapsed: state.minutesElapsed + minutes,
      embarrassmentCount: state.embarrassmentCount + 1,
    },
    feedback,
    true,
  );

export const createAfterHoursGameplayState = (): AfterHoursGameplayState => ({
  minutesElapsed: 0,
  money: 18,
  bartender: "neutral",
  host: "neutral",
  tabResolved: false,
  serviceRouteOpen: false,
  spareFlashAvailable: true,
  borrowedCoat: false,
  receiptKnown: false,
  penthouseLeadKnown: false,
  serviceCartKnown: false,
  finalAccess: "none",
  score: 0,
  awardedScoreIds: [],
  embarrassmentCount: 0,
  lastFeedback: "The lounge is still deciding whether you belong here.",
});

export const makeAwkwardBartenderIntroduction = (
  state: AfterHoursGameplayState,
): AfterHoursTransition =>
  embarrass(
    state,
    "The bartender lets the introduction hang for one beat too long, then reminds you about the unpaid tab. The service door stays closed, but the conversation is not over.",
    5,
    { bartender: "amused" },
  );

export const payAfterHoursTab = (state: AfterHoursGameplayState): AfterHoursTransition => {
  if (state.tabResolved) return transition(state, state, "The tab is already settled. The bartender has nothing left to hold over you.");
  if (state.money < 12) {
    return transition(
      state,
      state,
      "You do not have enough cash to settle the tab. The bartender points out that favours and information can still travel in both directions.",
    );
  }
  const next = award(
    {
      ...state,
      money: state.money - 12,
      tabResolved: true,
      serviceRouteOpen: true,
      bartender: "helpful",
      minutesElapsed: state.minutesElapsed + 3,
    },
    awards.loungeRoute,
  );
  return transition(
    state,
    next,
    "You settle the tab. The bartender's posture changes immediately and the staff corridor becomes a legitimate route.",
  );
};

export const tradeAfterHoursCameraFavour = (state: AfterHoursGameplayState): AfterHoursTransition => {
  if (state.serviceRouteOpen) return transition(state, state, "The bartender has already opened the service route for you.");
  if (!state.spareFlashAvailable) {
    return transition(state, state, "You already used the one practical favour the bartender wanted. Find another route.");
  }
  const next = award(
    {
      ...state,
      spareFlashAvailable: false,
      serviceRouteOpen: true,
      bartender: "helpful",
      minutesElapsed: state.minutesElapsed + 6,
    },
    awards.loungeRoute,
  );
  return transition(
    state,
    next,
    "You replace the dead flash on the lounge camera. The bartender waves you through the service corridor without asking for cash.",
  );
};

export const borrowAfterHoursCoat = (state: AfterHoursGameplayState): AfterHoursTransition =>
  state.borrowedCoat
    ? transition(state, state, "You are already carrying the borrowed coat.")
    : transition(
        state,
        { ...state, borrowedCoat: true, minutesElapsed: state.minutesElapsed + 2 },
        "You borrow the unattended coat. The cut and conference badge make it useful, but not convincing by themselves.",
      );

export const findAfterHoursReceipt = (state: AfterHoursGameplayState): AfterHoursTransition => {
  if (state.receiptKnown) return transition(state, state, "The signed banquet receipt is already in your notes.");
  return transition(
    state,
    award(
      { ...state, receiptKnown: true, minutesElapsed: state.minutesElapsed + 2 },
      awards.receipt,
    ),
    "The banquet receipt names the keynote room and carries the same surname stitched inside the borrowed coat.",
  );
};

export const bluffAfterHoursHostWithCoat = (state: AfterHoursGameplayState): AfterHoursTransition => {
  if (!state.borrowedCoat) {
    return transition(state, state, "Without anything tying you to the keynote party, the host has no reason to continue the conversation.");
  }
  if (!state.receiptKnown) {
    return embarrass(
      state,
      "The host studies the coat, then studies you. “That belongs to the keynote speaker. You are very much not the keynote speaker.” The mistake costs a minute, not the route.",
      4,
      { host: "suspicious" },
    );
  }
  if (state.penthouseLeadKnown) return transition(state, state, "The host has already given you the room number.");
  const next = award(
    {
      ...state,
      host: "helpful",
      penthouseLeadKnown: true,
      minutesElapsed: state.minutesElapsed + 3,
    },
    awards.penthouseLead,
  );
  return transition(
    state,
    next,
    "You pair the coat with the signed receipt instead of pretending to be its owner. The host recognises the mix-up and gives you the penthouse room number.",
  );
};

export const noticeAfterHoursServiceCart = (state: AfterHoursGameplayState): AfterHoursTransition =>
  state.serviceCartKnown
    ? transition(state, state, "You already noted the unattended service cart and its access key sleeve.")
    : transition(
        state,
        { ...state, serviceCartKnown: true },
        "The service cart carries a room-access sleeve. It offers a practical route if the social approach fails.",
      );

export const enterAfterHoursPenthouseSocially = (state: AfterHoursGameplayState): AfterHoursTransition => {
  if (!state.penthouseLeadKnown) {
    return transition(state, state, "You still do not know which penthouse room matters. Knocking at random would only burn time and goodwill.");
  }
  if (state.finalAccess !== "none") return transition(state, state, "You have already solved the penthouse access problem.");
  return transition(
    state,
    award({ ...state, finalAccess: "social", minutesElapsed: state.minutesElapsed + 2 }, awards.finalAccess),
    "You use the room number and the host's corrected introduction. The door opens because the social chain now makes sense, not because the coat is a magic disguise.",
  );
};

export const enterAfterHoursPenthouseViaService = (state: AfterHoursGameplayState): AfterHoursTransition => {
  if (!state.serviceRouteOpen || !state.serviceCartKnown) {
    return transition(
      state,
      state,
      "The service route is not ready. You need both legitimate staff-corridor access and a reason the service cart can solve the final door.",
    );
  }
  if (state.finalAccess !== "none") return transition(state, state, "You have already solved the penthouse access problem.");
  return transition(
    state,
    award({ ...state, finalAccess: "service", minutesElapsed: state.minutesElapsed + 4 }, awards.finalAccess),
    "You take the service route and use the cart's access sleeve. It is slower and less elegant, but completely valid.",
  );
};

export const afterHoursProofComplete = (state: AfterHoursGameplayState): boolean =>
  state.finalAccess !== "none";

export const AFTER_HOURS_MAX_SCORE = Object.values(awards).reduce(
  (sum, entry) => sum + entry.points,
  0,
);
