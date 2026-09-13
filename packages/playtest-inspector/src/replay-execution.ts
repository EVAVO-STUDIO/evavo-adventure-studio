import {
  executeReplay,
  parseReplayLog,
  ReplayCompatibilityError,
  validateReplayCompatibility,
} from "@evavo/adventure-replay";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { createPackagedRuntimeController } from "@evavo/adventure-runtime-controller";
import { controlledActorRequestFromSave } from "@evavo/adventure-runtime-controller/input";
import type { SaveGame } from "@evavo/adventure-save-game";
import { inspectSaveGame, type SaveGameInspection } from "./index.js";
import { assertReplayWithinExecutionLimits, type ReplayExecutionLimits } from "./replay-limits.js";

export {
  assertReplayWithinExecutionLimits,
  DEFAULT_ABSOLUTE_MAXIMUM_REPLAY_DURATION_TICKS,
  DEFAULT_MAXIMUM_REPLAY_DURATION_SECONDS,
  DEFAULT_MAXIMUM_REPLAY_EVENTS,
  type ReplayExecutionLimitCode,
  ReplayExecutionLimitError,
  type ReplayExecutionLimits,
  resolveReplayExecutionLimits,
} from "./replay-limits.js";

export interface InspectedReplayExecution {
  readonly replayFingerprint: string;
  readonly eventCount: number;
  readonly initialTick: number;
  readonly finalTick: number;
  readonly finalSaveFingerprint: string;
  readonly expectedFinalSaveFingerprint: string | null;
  readonly checkpointMatched: boolean | null;
  readonly finalSaveDocument: SaveGame;
  readonly finalSave: SaveGameInspection;
}

export const executeInspectedReplay = (
  bundle: RuntimeBundle,
  input: unknown,
  limits: ReplayExecutionLimits = {},
): InspectedReplayExecution => {
  const replay = parseReplayLog(input);
  const issues = validateReplayCompatibility(bundle, replay);
  if (issues.length > 0) throw new ReplayCompatibilityError(issues);
  assertReplayWithinExecutionLimits(bundle, replay, limits);

  const controller = createPackagedRuntimeController(bundle, {
    requestedActorInstanceId: controlledActorRequestFromSave(
      replay.initialSave.interface.controlledActorInstanceId,
    ),
  });
  const result = executeReplay(bundle, replay, controller);
  const expected = replay.expectedFinalSaveFingerprint ?? null;

  return {
    replayFingerprint: replay.replayFingerprint,
    eventCount: result.eventCount,
    initialTick: replay.initialSave.world.story.tick,
    finalTick: result.finalTick,
    finalSaveFingerprint: result.finalSaveFingerprint,
    expectedFinalSaveFingerprint: expected,
    checkpointMatched: expected === null ? null : expected === result.finalSaveFingerprint,
    finalSaveDocument: result.finalSave,
    finalSave: inspectSaveGame(bundle, result.finalSave),
  };
};
