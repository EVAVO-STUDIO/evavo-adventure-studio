import type { Point } from "@evavo/adventure-project-schema";
import {
  createReplayLog,
  serializeReplayLog,
  type ReplayEvent,
  type ReplayLog,
} from "@evavo/adventure-replay";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { loadSaveGame, type SaveGame } from "@evavo/adventure-save-game";
import type { ParserKeyInput } from "./parser.js";

export class ReplayRecordingStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayRecordingStateError";
  }
}

export interface ReplayRecordingStatus {
  readonly recording: boolean;
  readonly eventCount: number;
  readonly initialTick: number | null;
  readonly lastEventTick: number | null;
  readonly hasCompletedReplay: boolean;
}

export interface PlayerReplayRecorder {
  start(initialSave: SaveGame): void;
  cancel(): void;
  recordActivation(tick: number, position: Point): void;
  recordParserInput(tick: number, input: ParserKeyInput): void;
  finish(finalSave: SaveGame): ReplayLog;
  latestReplay(): ReplayLog | null;
  latestReplayJson(): string | null;
  status(): ReplayRecordingStatus;
}

export const createPlayerReplayRecorder = (
  bundle: RuntimeBundle,
): PlayerReplayRecorder => {
  let initialSave: SaveGame | null = null;
  let events: ReplayEvent[] = [];
  let nextSequence = 0;
  let latest: ReplayLog | null = null;

  const ensureRecording = (): SaveGame => {
    if (!initialSave) {
      throw new ReplayRecordingStateError("Replay recording has not started.");
    }
    return initialSave;
  };

  const append = (event: ReplayEvent): void => {
    const initial = ensureRecording();
    const previous = events.at(-1);
    if (event.tick < initial.world.story.tick) {
      throw new ReplayRecordingStateError(
        `Replay event tick ${event.tick} precedes recording start tick ${initial.world.story.tick}.`,
      );
    }
    if (previous && event.tick < previous.tick) {
      throw new ReplayRecordingStateError(
        `Replay event tick ${event.tick} precedes previous event tick ${previous.tick}.`,
      );
    }
    events.push(event);
    nextSequence += 1;
  };

  return {
    start: (save) => {
      if (initialSave) {
        throw new ReplayRecordingStateError("Replay recording has already started.");
      }
      initialSave = loadSaveGame(bundle, save);
      events = [];
      nextSequence = 0;
    },
    cancel: () => {
      initialSave = null;
      events = [];
      nextSequence = 0;
    },
    recordActivation: (tick, position) => {
      if (!initialSave) return;
      append({
        kind: "activate",
        tick,
        sequence: nextSequence,
        position,
      });
    },
    recordParserInput: (tick, input) => {
      if (!initialSave) return;
      append({
        kind: "parser-key",
        tick,
        sequence: nextSequence,
        input,
      });
    },
    finish: (save) => {
      const initial = ensureRecording();
      const finalSave = loadSaveGame(bundle, save);
      const replay = createReplayLog(bundle, initial, {
        events,
        finalTick: finalSave.world.story.tick,
        expectedFinalSaveFingerprint: finalSave.saveFingerprint,
      });
      latest = replay;
      initialSave = null;
      events = [];
      nextSequence = 0;
      return replay;
    },
    latestReplay: () => latest,
    latestReplayJson: () => (latest ? serializeReplayLog(latest) : null),
    status: () => ({
      recording: initialSave !== null,
      eventCount: events.length,
      initialTick: initialSave?.world.story.tick ?? null,
      lastEventTick: events.at(-1)?.tick ?? null,
      hasCompletedReplay: latest !== null,
    }),
  };
};
