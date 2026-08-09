import { advanceFixedStepClock, createFixedStepClock } from "@evavo/adventure-core/fixed-step";
import type {
  AdventureFramePacingAdvance,
  AdventureFramePacingState,
  AdventurePlayFeelProfile,
} from "./types.js";

export const createAdventureFramePacingState = (): AdventureFramePacingState => ({
  logicalTick: 0,
  ...createFixedStepClock(),
});

export const advanceAdventureFramePacing = (
  state: AdventureFramePacingState,
  elapsedMilliseconds: number,
  profile: AdventurePlayFeelProfile,
): AdventureFramePacingAdvance => {
  if (!Number.isSafeInteger(state.logicalTick) || state.logicalTick < 0) {
    throw new RangeError("Frame-pacing logicalTick must be a non-negative safe integer.");
  }
  const advanced = advanceFixedStepClock(
    {
      remainderMilliseconds: state.remainderMilliseconds,
      totalDroppedMilliseconds: state.totalDroppedMilliseconds,
    },
    elapsedMilliseconds,
    {
      ticksPerSecond: profile.logicalTicksPerSecond,
      maxCatchUpTicks: profile.presentation.maximumCatchUpTicks,
      maxFrameDeltaMilliseconds: profile.presentation.maximumFrameDeltaMilliseconds,
    },
  );
  const interpolationAlpha =
    profile.presentation.renderInterpolation === "none" ? 0 : advanced.interpolationAlpha;
  const logicalTick = state.logicalTick + advanced.ticksToRun;
  return {
    state: { logicalTick, ...advanced.state },
    ticksToRun: advanced.ticksToRun,
    interpolationAlpha,
    droppedMilliseconds: advanced.droppedMilliseconds,
    presentationTick: logicalTick + interpolationAlpha,
  };
};
