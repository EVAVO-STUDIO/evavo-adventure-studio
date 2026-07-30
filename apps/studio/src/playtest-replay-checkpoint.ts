import type { ReplayInspection } from "@evavo/adventure-playtest-inspector";
import type { SaveGameInspection } from "@evavo/adventure-playtest-inspector";

export type ReplayCheckpointComparison =
  | {
      readonly status: "not-recorded";
      readonly expectedFingerprint: null;
      readonly actualFingerprint: string | null;
    }
  | {
      readonly status: "awaiting-after-save";
      readonly expectedFingerprint: string;
      readonly actualFingerprint: null;
    }
  | {
      readonly status: "match" | "mismatch";
      readonly expectedFingerprint: string;
      readonly actualFingerprint: string;
    };

export const compareReplayCheckpoint = (
  replay: ReplayInspection,
  afterSave: SaveGameInspection | null,
): ReplayCheckpointComparison => {
  const expectedFingerprint = replay.expectedFinalSaveFingerprint;
  const actualFingerprint = afterSave?.saveFingerprint ?? null;

  if (expectedFingerprint === null) {
    return {
      status: "not-recorded",
      expectedFingerprint: null,
      actualFingerprint,
    };
  }
  if (actualFingerprint === null) {
    return {
      status: "awaiting-after-save",
      expectedFingerprint,
      actualFingerprint: null,
    };
  }
  return {
    status: expectedFingerprint === actualFingerprint ? "match" : "mismatch",
    expectedFingerprint,
    actualFingerprint,
  };
};
