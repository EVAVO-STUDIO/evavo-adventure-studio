import type { RuntimeEvent, RuntimeState } from "@evavo/adventure-core";
import { beginDialogue } from "@evavo/adventure-dialogue";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  advanceSequence,
  skipSequence,
  startSequence,
  type SequenceRejectionReason,
} from "@evavo/adventure-sequence";

export interface RuntimeNarrativeWorld {
  readonly story: RuntimeState;
}

export interface RuntimeNarrativeTransition<T extends RuntimeNarrativeWorld> {
  readonly state: T;
  readonly events: readonly RuntimeEvent[];
}

export interface RuntimeNarrativeOptions {
  readonly maximumRequests?: number;
}

export type RuntimeNarrativeRequestErrorCode =
  | "invalid-request-limit"
  | "missing-dialogue"
  | "missing-sequence"
  | "dialogue-rejected"
  | "sequence-rejected"
  | "request-limit-exceeded";

export class RuntimeNarrativeRequestError extends Error {
  readonly code: RuntimeNarrativeRequestErrorCode;
  readonly requestId: string | null;

  constructor(code: RuntimeNarrativeRequestErrorCode, message: string, requestId: string | null = null) {
    super(message);
    this.name = "RuntimeNarrativeRequestError";
    this.code = code;
    this.requestId = requestId;
  }
}

type NarrativeRequestEvent = Extract<
  RuntimeEvent,
  { readonly kind: "dialogue-requested" | "sequence-requested" }
>;

type InitialRequestPolicy = "all" | "sequence-only";

const DEFAULT_MAXIMUM_REQUESTS = 64;

const maximumRequests = (options: RuntimeNarrativeOptions): number => {
  const value = options.maximumRequests ?? DEFAULT_MAXIMUM_REQUESTS;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RuntimeNarrativeRequestError(
      "invalid-request-limit",
      "maximumRequests must be a positive safe integer.",
    );
  }
  return value;
};

const narrativeRequests = (
  events: readonly RuntimeEvent[],
  policy: InitialRequestPolicy,
): NarrativeRequestEvent[] =>
  events.filter(
    (event): event is NarrativeRequestEvent =>
      event.kind === "sequence-requested" || (policy === "all" && event.kind === "dialogue-requested"),
  );

const nestedNarrativeRequests = (events: readonly RuntimeEvent[]): NarrativeRequestEvent[] =>
  events.filter(
    (event): event is NarrativeRequestEvent =>
      event.kind === "dialogue-requested" || event.kind === "sequence-requested",
  );

const withStory = <T extends RuntimeNarrativeWorld>(state: T, story: RuntimeState): T => ({
  ...state,
  story,
});

const applyNarrativeRequests = <T extends RuntimeNarrativeWorld>(
  bundle: Pick<RuntimeBundle, "dialogues" | "sequences">,
  state: T,
  events: readonly RuntimeEvent[],
  policy: InitialRequestPolicy,
  options: RuntimeNarrativeOptions,
): RuntimeNarrativeTransition<T> => {
  const limit = maximumRequests(options);
  const queue = narrativeRequests(events, policy);
  const emitted: RuntimeEvent[] = [...events];
  let nextState = state;
  let processed = 0;

  while (queue.length > 0) {
    const request = queue.shift();
    if (!request) continue;
    processed += 1;
    if (processed > limit) {
      throw new RuntimeNarrativeRequestError(
        "request-limit-exceeded",
        `Narrative request processing exceeded ${limit} requests.`,
      );
    }

    if (request.kind === "dialogue-requested") {
      const graph = bundle.dialogues.find((candidate) => candidate.id === request.dialogueId);
      if (!graph) {
        throw new RuntimeNarrativeRequestError(
          "missing-dialogue",
          `Requested dialogue '${request.dialogueId}' does not exist.`,
          request.dialogueId,
        );
      }
      const operation = beginDialogue(nextState.story, graph, request.nodeId);
      if (operation.kind === "rejected") {
        throw new RuntimeNarrativeRequestError(
          "dialogue-rejected",
          `Dialogue '${request.dialogueId}' was rejected: ${operation.reason}.`,
          request.dialogueId,
        );
      }
      nextState = withStory(nextState, operation.transition.state);
      emitted.push(...operation.transition.events);
      queue.push(...nestedNarrativeRequests(operation.transition.events));
      continue;
    }

    const sequence = bundle.sequences.find((candidate) => candidate.id === request.sequenceId);
    if (!sequence) {
      throw new RuntimeNarrativeRequestError(
        "missing-sequence",
        `Requested sequence '${request.sequenceId}' does not exist.`,
        request.sequenceId,
      );
    }
    const operation = startSequence(nextState.story, sequence);
    if (operation.kind === "rejected") {
      throw new RuntimeNarrativeRequestError(
        "sequence-rejected",
        `Sequence '${request.sequenceId}' was rejected: ${operation.reason}.`,
        request.sequenceId,
      );
    }
    nextState = withStory(nextState, operation.transition.state);
    emitted.push(...operation.transition.events);
    queue.push(...nestedNarrativeRequests(operation.transition.events));
  }

  return { state: nextState, events: emitted };
};

export const applyRuntimeNarrativeRequestEvents = <T extends RuntimeNarrativeWorld>(
  bundle: Pick<RuntimeBundle, "dialogues" | "sequences">,
  state: T,
  events: readonly RuntimeEvent[],
  options: RuntimeNarrativeOptions = {},
): RuntimeNarrativeTransition<T> => applyNarrativeRequests(bundle, state, events, "all", options);

export const applyRuntimeSequenceRequestEvents = <T extends RuntimeNarrativeWorld>(
  bundle: Pick<RuntimeBundle, "dialogues" | "sequences">,
  state: T,
  events: readonly RuntimeEvent[],
  options: RuntimeNarrativeOptions = {},
): RuntimeNarrativeTransition<T> => applyNarrativeRequests(bundle, state, events, "sequence-only", options);

export const startRuntimeNarrativeSequence = <T extends RuntimeNarrativeWorld>(
  bundle: Pick<RuntimeBundle, "dialogues" | "sequences">,
  state: T,
  sequenceId: Id<"sequence">,
  options: RuntimeNarrativeOptions = {},
): RuntimeNarrativeTransition<T> =>
  applyRuntimeNarrativeRequestEvents(
    bundle,
    state,
    [{ kind: "sequence-requested", sequenceId }],
    options,
  );

export type RuntimeNarrativeSequenceSkipResult<T extends RuntimeNarrativeWorld> =
  | {
      readonly kind: "skipped";
      readonly state: T;
      readonly events: readonly RuntimeEvent[];
    }
  | {
      readonly kind: "rejected";
      readonly reason: SequenceRejectionReason;
      readonly state: T;
      readonly events: readonly RuntimeEvent[];
    };

export const skipRuntimeNarrativeSequence = <T extends RuntimeNarrativeWorld>(
  bundle: Pick<RuntimeBundle, "dialogues" | "sequences">,
  state: T,
  sequenceId: Id<"sequence">,
  options: RuntimeNarrativeOptions = {},
): RuntimeNarrativeSequenceSkipResult<T> => {
  const sequence = bundle.sequences.find((candidate) => candidate.id === sequenceId);
  if (!sequence) {
    throw new RuntimeNarrativeRequestError(
      "missing-sequence",
      `Requested sequence '${sequenceId}' does not exist.`,
      sequenceId,
    );
  }

  const operation = skipSequence(state.story, sequence);
  if (operation.kind === "rejected") {
    return {
      kind: "rejected",
      reason: operation.reason,
      state,
      events: [],
    };
  }

  const requests = applyRuntimeNarrativeRequestEvents(
    bundle,
    withStory(state, operation.transition.state),
    operation.transition.events,
    options,
  );
  return {
    kind: "skipped",
    state: requests.state,
    events: requests.events,
  };
};

export const advanceRuntimeNarrativeSequences = <T extends RuntimeNarrativeWorld>(
  bundle: Pick<RuntimeBundle, "dialogues" | "sequences">,
  state: T,
  ticks: number,
  options: RuntimeNarrativeOptions = {},
): RuntimeNarrativeTransition<T> => {
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError("Narrative sequence advancement must be a non-negative safe integer.");
  }

  let nextState = state;
  const emitted: RuntimeEvent[] = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    const activeIds = nextState.story.activeSequences
      .map((active) => active.sequenceId)
      .sort((left, right) => left.localeCompare(right));
    for (const sequenceId of activeIds) {
      if (!nextState.story.activeSequences.some((active) => active.sequenceId === sequenceId)) {
        continue;
      }
      const sequence = bundle.sequences.find((candidate) => candidate.id === sequenceId);
      if (!sequence) {
        throw new RuntimeNarrativeRequestError(
          "missing-sequence",
          `Active sequence '${sequenceId}' does not exist in the runtime bundle.`,
          sequenceId,
        );
      }
      const operation = advanceSequence(nextState.story, sequence, 1);
      if (operation.kind === "rejected") {
        throw new RuntimeNarrativeRequestError(
          "sequence-rejected",
          `Sequence '${sequenceId}' could not advance: ${operation.reason}.`,
          sequenceId,
        );
      }
      const requests = applyRuntimeNarrativeRequestEvents(
        bundle,
        withStory(nextState, operation.transition.state),
        operation.transition.events,
        options,
      );
      nextState = requests.state;
      emitted.push(...requests.events);
    }
  }
  return { state: nextState, events: emitted };
};
