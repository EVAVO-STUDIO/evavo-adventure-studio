import type { ReplayLog } from "@evavo/adventure-replay";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";

export const DEFAULT_MAXIMUM_REPLAY_EVENTS = 10_000;
export const DEFAULT_MAXIMUM_REPLAY_DURATION_SECONDS = 3_600;
export const DEFAULT_ABSOLUTE_MAXIMUM_REPLAY_DURATION_TICKS = 216_000;

export interface ReplayExecutionLimits {
  readonly maxEvents?: number;
  readonly maxDurationTicks?: number;
}

export type ReplayExecutionLimitCode =
  | "event-count-exceeded"
  | "duration-exceeded";

export class ReplayExecutionLimitError extends Error {
  readonly code: ReplayExecutionLimitCode;
  readonly actual: number;
  readonly limit: number;

  constructor(
    code: ReplayExecutionLimitCode,
    actual: number,
    limit: number,
  ) {
    super(
      code === "event-count-exceeded"
        ? `Replay contains ${actual} event(s); the execution limit is ${limit}.`
        : `Replay spans ${actual} logical tick(s); the execution limit is ${limit}.`,
    );
    this.name = "ReplayExecutionLimitError";
    this.code = code;
    this.actual = actual;
    this.limit = limit;
  }
}

const positiveInteger = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer.`);
  }
  return value;
};

const defaultMaximumDurationTicks = (
  bundle: Pick<RuntimeBundle, "presentation">,
): number =>
  Math.min(
    bundle.presentation.logicalTicksPerSecond *
      DEFAULT_MAXIMUM_REPLAY_DURATION_SECONDS,
    DEFAULT_ABSOLUTE_MAXIMUM_REPLAY_DURATION_TICKS,
  );

export const resolveReplayExecutionLimits = (
  bundle: Pick<RuntimeBundle, "presentation">,
  limits: ReplayExecutionLimits = {},
): Required<ReplayExecutionLimits> => ({
  maxEvents: positiveInteger(
    limits.maxEvents ?? DEFAULT_MAXIMUM_REPLAY_EVENTS,
    "maxEvents",
  ),
  maxDurationTicks: positiveInteger(
    limits.maxDurationTicks ?? defaultMaximumDurationTicks(bundle),
    "maxDurationTicks",
  ),
});

export const assertReplayWithinExecutionLimits = (
  bundle: Pick<RuntimeBundle, "presentation">,
  replay: Pick<ReplayLog, "events" | "finalTick" | "initialSave">,
  limits: ReplayExecutionLimits = {},
): void => {
  const resolved = resolveReplayExecutionLimits(bundle, limits);
  if (replay.events.length > resolved.maxEvents) {
    throw new ReplayExecutionLimitError(
      "event-count-exceeded",
      replay.events.length,
      resolved.maxEvents,
    );
  }

  const duration = replay.finalTick - replay.initialSave.world.story.tick;
  if (duration > resolved.maxDurationTicks) {
    throw new ReplayExecutionLimitError(
      "duration-exceeded",
      duration,
      resolved.maxDurationTicks,
    );
  }
};
