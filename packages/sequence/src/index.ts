import {
  type ActiveSequenceState,
  applyActions,
  type RuntimeEvent,
  type RuntimeState,
  type RuntimeTransition,
} from "@evavo/adventure-core";
import type { Id, Sequence, SequenceCue } from "@evavo/adventure-project-schema";

interface ScheduledCue {
  readonly trackId: Id<"sequence-track">;
  readonly cueIndex: number;
  readonly cue: SequenceCue;
}

export type SequenceRejectionReason =
  | "already-active"
  | "not-active"
  | "skip-not-allowed"
  | "skip-boundary-not-reached";

export type SequenceOperation =
  | { readonly kind: "active"; readonly transition: RuntimeTransition }
  | { readonly kind: "completed"; readonly transition: RuntimeTransition }
  | { readonly kind: "skipped"; readonly transition: RuntimeTransition }
  | {
      readonly kind: "rejected";
      readonly reason: SequenceRejectionReason;
      readonly state: RuntimeState;
    };

const MAX_LOOP_ITERATIONS_PER_ADVANCE = 1024;

const buildSchedule = (sequence: Sequence): readonly ScheduledCue[] =>
  sequence.tracks
    .flatMap((track) =>
      track.cues.map((cue, cueIndex) => ({
        trackId: track.id,
        cueIndex,
        cue,
      })),
    )
    .sort((left, right) => {
      if (left.cue.atTick !== right.cue.atTick) {
        return left.cue.atTick - right.cue.atTick;
      }
      const trackDifference = left.trackId.localeCompare(right.trackId);
      return trackDifference !== 0 ? trackDifference : left.cueIndex - right.cueIndex;
    });

const findActiveSequence = (
  state: RuntimeState,
  sequenceId: Id<"sequence">,
): ActiveSequenceState | undefined =>
  state.activeSequences.find((active) => active.sequenceId === sequenceId);

const replaceActiveSequence = (state: RuntimeState, active: ActiveSequenceState): RuntimeState => ({
  ...state,
  activeSequences: state.activeSequences.map((candidate) =>
    candidate.sequenceId === active.sequenceId ? active : candidate,
  ),
});

const removeActiveSequence = (state: RuntimeState, sequenceId: Id<"sequence">): RuntimeState => ({
  ...state,
  activeSequences: state.activeSequences.filter((active) => active.sequenceId !== sequenceId),
});

const cueCursorsAtTick = (sequence: Sequence, elapsedTicks: number): Readonly<Record<string, number>> => {
  const cursors: Record<string, number> = {};
  for (const track of sequence.tracks) {
    let count = 0;
    for (const cue of track.cues) {
      if (cue.atTick <= elapsedTicks) {
        count += 1;
      }
    }
    cursors[track.id] = count;
  }
  return cursors;
};

interface ProcessWindowResult {
  readonly state: RuntimeState;
  readonly events: readonly RuntimeEvent[];
}

const processWindow = (
  state: RuntimeState,
  sequence: Sequence,
  fromExclusive: number,
  toInclusive: number,
  initialEvents: readonly RuntimeEvent[] = [],
): ProcessWindowResult => {
  let nextState = state;
  const events: RuntimeEvent[] = [...initialEvents];

  for (const scheduled of buildSchedule(sequence)) {
    if (scheduled.cue.atTick <= fromExclusive || scheduled.cue.atTick > toInclusive) {
      continue;
    }

    events.push({
      kind: "sequence-cue-reached",
      sequenceId: sequence.id,
      trackId: scheduled.trackId,
      cueIndex: scheduled.cueIndex,
      cue: scheduled.cue,
    });

    if (scheduled.cue.kind === "story-action") {
      const transition = applyActions(nextState, [scheduled.cue.action]);
      nextState = transition.state;
      events.push(...transition.events);
    }
  }

  return { state: nextState, events };
};

const activeAt = (sequence: Sequence, elapsedTicks: number, iteration: number): ActiveSequenceState => ({
  sequenceId: sequence.id,
  elapsedTicks,
  iteration,
  nextCueIndexByTrack: cueCursorsAtTick(sequence, elapsedTicks),
});

const assertValidActiveState = (active: ActiveSequenceState, sequence: Sequence): void => {
  if (
    !Number.isSafeInteger(active.elapsedTicks) ||
    active.elapsedTicks < 0 ||
    active.elapsedTicks > sequence.durationTicks ||
    !Number.isSafeInteger(active.iteration) ||
    active.iteration < 0
  ) {
    throw new RangeError(
      `Saved playback state for sequence '${sequence.id}' is outside its valid timeline bounds.`,
    );
  }
};

export const startSequence = (state: RuntimeState, sequence: Sequence): SequenceOperation => {
  if (findActiveSequence(state, sequence.id)) {
    return { kind: "rejected", reason: "already-active", state };
  }

  const initialActive = activeAt(sequence, 0, 0);
  const withSequence: RuntimeState = {
    ...state,
    activeSequences: [...state.activeSequences, initialActive],
  };
  const processed = processWindow(withSequence, sequence, -1, 0, [
    { kind: "sequence-started", sequenceId: sequence.id },
  ]);

  return {
    kind: "active",
    transition: {
      state: replaceActiveSequence(processed.state, activeAt(sequence, 0, 0)),
      events: processed.events,
    },
  };
};

export const advanceSequence = (
  state: RuntimeState,
  sequence: Sequence,
  ticks: number,
): SequenceOperation => {
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError("Sequence advancement must be a non-negative safe integer.");
  }

  const active = findActiveSequence(state, sequence.id);
  if (!active) {
    return { kind: "rejected", reason: "not-active", state };
  }
  assertValidActiveState(active, sequence);
  if (ticks === 0) {
    return { kind: "active", transition: { state, events: [] } };
  }

  let nextState = state;
  let current = active;
  let remaining = ticks;
  let loopIterations = 0;
  const events: RuntimeEvent[] = [];

  while (remaining > 0) {
    const available = sequence.durationTicks - current.elapsedTicks;
    const step = Math.min(remaining, available);
    const target = current.elapsedTicks + step;
    const processed = processWindow(nextState, sequence, current.elapsedTicks, target);
    events.push(...processed.events);
    nextState = processed.state;
    remaining -= step;

    if (target < sequence.durationTicks) {
      current = activeAt(sequence, target, current.iteration);
      nextState = replaceActiveSequence(nextState, current);
      continue;
    }

    if (!sequence.loop) {
      const completed = applyActions(nextState, sequence.skip.completionActions);
      nextState = removeActiveSequence(completed.state, sequence.id);
      events.push(...completed.events, { kind: "sequence-completed", sequenceId: sequence.id });
      return {
        kind: "completed",
        transition: { state: nextState, events },
      };
    }

    loopIterations += 1;
    if (loopIterations > MAX_LOOP_ITERATIONS_PER_ADVANCE) {
      throw new RangeError(
        "Sequence advancement crossed too many loop boundaries; advance in smaller chunks.",
      );
    }

    current = activeAt(sequence, 0, current.iteration + 1);
    nextState = replaceActiveSequence(nextState, current);
    events.push({
      kind: "sequence-looped",
      sequenceId: sequence.id,
      iteration: current.iteration,
    });

    const restarted = processWindow(nextState, sequence, -1, 0);
    nextState = replaceActiveSequence(restarted.state, current);
    events.push(...restarted.events);
  }

  return {
    kind: "active",
    transition: { state: nextState, events },
  };
};

export const skipSequence = (state: RuntimeState, sequence: Sequence): SequenceOperation => {
  const active = findActiveSequence(state, sequence.id);
  if (!active) {
    return { kind: "rejected", reason: "not-active", state };
  }
  assertValidActiveState(active, sequence);
  if (!sequence.skip.allowed) {
    return { kind: "rejected", reason: "skip-not-allowed", state };
  }
  if (active.elapsedTicks < sequence.skip.safeAfterTick) {
    return {
      kind: "rejected",
      reason: "skip-boundary-not-reached",
      state,
    };
  }

  const completed = applyActions(state, sequence.skip.completionActions);
  const finalState = removeActiveSequence(completed.state, sequence.id);

  return {
    kind: "skipped",
    transition: {
      state: finalState,
      events: [
        ...completed.events,
        { kind: "sequence-skipped", sequenceId: sequence.id },
        { kind: "sequence-completed", sequenceId: sequence.id },
      ],
    },
  };
};
