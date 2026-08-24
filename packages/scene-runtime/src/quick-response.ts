import { applyActions, type RuntimeEvent, type RuntimeState } from "@evavo/adventure-core";
import type {
  RuntimeQuickResponseInput,
  RuntimeQuickResponseMode,
  RuntimeQuickResponsePrompt,
} from "@evavo/adventure-runtime-bundle/quick-response";

export type QuickResponsePhase = "active" | "success" | "failure";

export interface QuickResponseState {
  readonly modeId: string;
  readonly elapsedTicks: number;
  readonly hitPromptIds: readonly string[];
  readonly missedPromptIds: readonly string[];
  readonly phase: QuickResponsePhase;
}

export type QuickResponseEvent =
  | { readonly kind: "quick-response-started"; readonly modeId: string }
  | { readonly kind: "quick-response-prompt-hit"; readonly modeId: string; readonly promptId: string }
  | { readonly kind: "quick-response-prompt-missed"; readonly modeId: string; readonly promptId: string }
  | { readonly kind: "quick-response-succeeded"; readonly modeId: string }
  | { readonly kind: "quick-response-failed"; readonly modeId: string };

export interface QuickResponseTransition {
  readonly state: QuickResponseState;
  readonly story: RuntimeState;
  readonly events: readonly QuickResponseEvent[];
  readonly runtimeEvents: readonly RuntimeEvent[];
}

const uniqueSorted = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const createQuickResponseState = (mode: RuntimeQuickResponseMode): QuickResponseState => ({
  modeId: mode.id,
  elapsedTicks: 0,
  hitPromptIds: [],
  missedPromptIds: [],
  phase: "active",
});

const unresolvedPrompts = (
  mode: RuntimeQuickResponseMode,
  state: QuickResponseState,
): readonly RuntimeQuickResponsePrompt[] =>
  mode.prompts.filter(
    (prompt) =>
      !state.hitPromptIds.includes(prompt.id) &&
      !state.missedPromptIds.includes(prompt.id),
  );

const finalizeIfNeeded = (
  mode: RuntimeQuickResponseMode,
  story: RuntimeState,
  state: QuickResponseState,
  events: readonly QuickResponseEvent[],
  runtimeEvents: readonly RuntimeEvent[],
): QuickResponseTransition => {
  if (state.phase !== "active" || state.elapsedTicks < mode.durationTicks) {
    return { state, story, events, runtimeEvents };
  }
  const requiredMisses = mode.prompts.filter(
    (prompt) => prompt.required && state.missedPromptIds.includes(prompt.id),
  ).length;
  const success = requiredMisses <= mode.maximumMisses;
  const completion = applyActions(story, success ? mode.successActions : mode.failureActions);
  return {
    state: { ...state, phase: success ? "success" : "failure" },
    story: completion.state,
    events: [
      ...events,
      { kind: success ? "quick-response-succeeded" : "quick-response-failed", modeId: mode.id },
    ],
    runtimeEvents: [...runtimeEvents, ...completion.events],
  };
};

export const submitQuickResponseInput = (
  mode: RuntimeQuickResponseMode,
  story: RuntimeState,
  state: QuickResponseState,
  input: RuntimeQuickResponseInput,
): QuickResponseTransition => {
  if (state.phase !== "active") return { state, story, events: [], runtimeEvents: [] };
  const prompt = unresolvedPrompts(mode, state)
    .filter((candidate) => state.elapsedTicks >= candidate.startTick && state.elapsedTicks <= candidate.endTick)
    .filter((candidate) => candidate.input === input)
    .sort((left, right) => left.startTick - right.startTick || left.id.localeCompare(right.id))[0];
  if (!prompt) return { state, story, events: [], runtimeEvents: [] };
  const transition = applyActions(story, prompt.successActions);
  const nextState = {
    ...state,
    hitPromptIds: uniqueSorted([...state.hitPromptIds, prompt.id]),
  };
  return {
    state: nextState,
    story: transition.state,
    events: [{ kind: "quick-response-prompt-hit", modeId: mode.id, promptId: prompt.id }],
    runtimeEvents: transition.events,
  };
};

export const advanceQuickResponse = (
  mode: RuntimeQuickResponseMode,
  story: RuntimeState,
  state: QuickResponseState,
  ticks: number,
): QuickResponseTransition => {
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError("Quick-response advancement must be a non-negative safe integer.");
  }
  if (state.phase !== "active" || ticks === 0) {
    return { state, story, events: [], runtimeEvents: [] };
  }

  let nextStory = story;
  let nextState: QuickResponseState = {
    ...state,
    elapsedTicks: Math.min(mode.durationTicks, state.elapsedTicks + ticks),
  };
  const events: QuickResponseEvent[] = [];
  const runtimeEvents: RuntimeEvent[] = [];

  for (const prompt of unresolvedPrompts(mode, state)) {
    if (prompt.endTick >= nextState.elapsedTicks) continue;
    const missed = applyActions(nextStory, prompt.missActions);
    nextStory = missed.state;
    runtimeEvents.push(...missed.events);
    nextState = {
      ...nextState,
      missedPromptIds: uniqueSorted([...nextState.missedPromptIds, prompt.id]),
    };
    events.push({ kind: "quick-response-prompt-missed", modeId: mode.id, promptId: prompt.id });
  }

  return finalizeIfNeeded(mode, nextStory, nextState, events, runtimeEvents);
};
