import { describe, expect, it } from "vitest";
import {
  assertReplayInputFileSize,
  MAXIMUM_REPLAY_BUNDLE_BYTES,
  MAXIMUM_REPLAY_FILE_BYTES,
  ReplayInputFileTooLargeError,
} from "../src/replay-file-limits.js";

describe("replay execution input file limits", () => {
  it("accepts files at their exact byte ceiling", () => {
    expect(() =>
      assertReplayInputFileSize("game.bundle.json", MAXIMUM_REPLAY_BUNDLE_BYTES, MAXIMUM_REPLAY_BUNDLE_BYTES),
    ).not.toThrow();
    expect(() =>
      assertReplayInputFileSize("playtest.replay.json", MAXIMUM_REPLAY_FILE_BYTES, MAXIMUM_REPLAY_FILE_BYTES),
    ).not.toThrow();
  });

  it("rejects files above their ceiling", () => {
    expect(() => assertReplayInputFileSize("playtest.replay.json", 33, 32)).toThrow(
      new ReplayInputFileTooLargeError("playtest.replay.json", 33, 32),
    );
  });

  it("rejects invalid size metadata", () => {
    expect(() => assertReplayInputFileSize("input.json", -1, 32)).toThrow(/non-negative safe integer/);
    expect(() => assertReplayInputFileSize("input.json", 1, 0)).toThrow(/positive safe integer/);
  });
});
