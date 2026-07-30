import { describe, expect, it } from "vitest";
import type {
  ReplayInspection,
  SaveGameInspection,
} from "@evavo/adventure-playtest-inspector";
import { compareReplayCheckpoint } from "../src/playtest-replay-checkpoint.js";

const replayWithCheckpoint = (
  expectedFinalSaveFingerprint: string | null,
): ReplayInspection =>
  ({ expectedFinalSaveFingerprint }) as ReplayInspection;

const inspectedSave = (saveFingerprint: string): SaveGameInspection =>
  ({ saveFingerprint }) as SaveGameInspection;

describe("replay final save checkpoint comparison", () => {
  it("reports when the replay did not record a final checkpoint", () => {
    expect(compareReplayCheckpoint(replayWithCheckpoint(null), null)).toEqual({
      status: "not-recorded",
      expectedFingerprint: null,
      actualFingerprint: null,
    });
  });

  it("waits for Save B when the replay contains a checkpoint", () => {
    expect(
      compareReplayCheckpoint(replayWithCheckpoint("fnv1a64:0000000000000001"), null),
    ).toEqual({
      status: "awaiting-after-save",
      expectedFingerprint: "fnv1a64:0000000000000001",
      actualFingerprint: null,
    });
  });

  it("distinguishes an exact checkpoint match from divergence", () => {
    const expected = "fnv1a64:0000000000000001";

    expect(
      compareReplayCheckpoint(
        replayWithCheckpoint(expected),
        inspectedSave(expected),
      ),
    ).toEqual({
      status: "match",
      expectedFingerprint: expected,
      actualFingerprint: expected,
    });
    expect(
      compareReplayCheckpoint(
        replayWithCheckpoint(expected),
        inspectedSave("fnv1a64:0000000000000002"),
      ),
    ).toEqual({
      status: "mismatch",
      expectedFingerprint: expected,
      actualFingerprint: "fnv1a64:0000000000000002",
    });
  });
});
