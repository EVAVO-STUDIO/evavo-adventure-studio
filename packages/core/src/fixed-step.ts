export interface FixedStepConfig {
  readonly ticksPerSecond: number;
  readonly maxCatchUpTicks: number;
  readonly maxFrameDeltaMilliseconds: number;
}

export interface FixedStepClockState {
  readonly remainderMilliseconds: number;
  readonly totalDroppedMilliseconds: number;
}

export interface FixedStepAdvance {
  readonly state: FixedStepClockState;
  readonly ticksToRun: number;
  readonly interpolationAlpha: number;
  readonly droppedMilliseconds: number;
}

export const createFixedStepClock = (): FixedStepClockState => ({
  remainderMilliseconds: 0,
  totalDroppedMilliseconds: 0,
});

const validateConfig = (config: FixedStepConfig): void => {
  if (!Number.isFinite(config.ticksPerSecond) || config.ticksPerSecond <= 0) {
    throw new RangeError("ticksPerSecond must be a positive finite number.");
  }
  if (!Number.isSafeInteger(config.maxCatchUpTicks) || config.maxCatchUpTicks < 1) {
    throw new RangeError("maxCatchUpTicks must be a positive safe integer.");
  }
  if (!Number.isFinite(config.maxFrameDeltaMilliseconds) || config.maxFrameDeltaMilliseconds <= 0) {
    throw new RangeError("maxFrameDeltaMilliseconds must be a positive finite number.");
  }
};

export const advanceFixedStepClock = (
  state: FixedStepClockState,
  elapsedMilliseconds: number,
  config: FixedStepConfig,
): FixedStepAdvance => {
  validateConfig(config);
  if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds < 0) {
    throw new RangeError("elapsedMilliseconds must be a non-negative finite number.");
  }
  if (
    !Number.isFinite(state.remainderMilliseconds) ||
    state.remainderMilliseconds < 0 ||
    !Number.isFinite(state.totalDroppedMilliseconds) ||
    state.totalDroppedMilliseconds < 0
  ) {
    throw new RangeError("Fixed-step clock state is invalid.");
  }

  const tickMilliseconds = 1000 / config.ticksPerSecond;
  const acceptedDelta = Math.min(elapsedMilliseconds, config.maxFrameDeltaMilliseconds);
  const clampedDrop = elapsedMilliseconds - acceptedDelta;
  const accumulated = state.remainderMilliseconds + acceptedDelta;
  const availableTicks = Math.floor(accumulated / tickMilliseconds);
  const ticksToRun = Math.min(availableTicks, config.maxCatchUpTicks);
  const droppedTicks = availableTicks - ticksToRun;
  const droppedMilliseconds = clampedDrop + droppedTicks * tickMilliseconds;
  const remainderMilliseconds = accumulated - availableTicks * tickMilliseconds;

  return {
    state: {
      remainderMilliseconds,
      totalDroppedMilliseconds: state.totalDroppedMilliseconds + droppedMilliseconds,
    },
    ticksToRun,
    interpolationAlpha: remainderMilliseconds / tickMilliseconds,
    droppedMilliseconds,
  };
};
