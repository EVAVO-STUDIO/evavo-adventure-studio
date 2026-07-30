import {
  executeReplay,
  parseReplayLog,
  ReplayCompatibilityError,
  validateReplayCompatibility,
} from "@evavo/adventure-replay";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { createPackagedRuntimeController } from "@evavo/adventure-runtime-controller";
import { inspectSaveGame, type SaveGameInspection } from "./index.js";

export interface InspectedReplayExecution {
  readonly replayFingerprint: string;
  readonly eventCount: number;
  readonly initialTick: number;
  readonly finalTick: number;
  readonly finalSaveFingerprint: string;
  readonly expectedFinalSaveFingerprint: string | null;
  readonly checkpointMatched: boolean | null;
  readonly finalSave: SaveGameInspection;
}

export const executeInspectedReplay = (
  bundle: RuntimeBundle,
  input: unknown,
): InspectedReplayExecution => {
  const replay = parseReplayLog(input);
  const issues = validateReplayCompatibility(bundle, replay);
  if (issues.length > 0) throw new ReplayCompatibilityError(issues);

  const controller = createPackagedRuntimeController(bundle, {
    requestedActorInstanceId:
      replay.initialSave.interface.controlledActorInstanceId,
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
    checkpointMatched:
      expected === null ? null : expected === result.finalSaveFingerprint,
    finalSave: inspectSaveGame(bundle, result.finalSave),
  };
};
