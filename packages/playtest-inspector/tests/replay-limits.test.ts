import { describe, expect, it } from "vitest";
import type { ReplayLog } from "@evavo/adventure-replay";
import {
  assertReplayWithinExecutionLimits,
  ReplayExecutionLimitError,
  resolveReplayExecutionLimits,
} from "../src/replay-limits.js";

const bundle = {
  presentation: { logicalTicksPerSecond: 60 },
};

const replay = (
  eventCount: number,
  initialTick: number,
  finalTick: number,
) =>
  ({
    events: Array.from({ length: eventCount }, (_, sequence) => ({
      kind: "activate" as const,
      tick: initialTick,
      sequence,
      position: { x: 0, y: 0 },
    })),
    initialSave: { world: { story: { tick: initialTick } } },
    finalTick,
  }) as ReplayLog;

describe("replay execution limits", () => {
  it("derives the default duration from the bundle tick rate", () => {
    expect(resolveReplayExecutionLimits(bundle)).toEqual({
      maxEvents: 10_000,
      maxDurationTicks: 216_000,
    });
  });

  it("rejects excessive event counts before execution", () => {
    expect(() =>
      assertReplayWithinExecutionLimits(bundle, replay(4, 0, 10), {
        maxEvents: 3,
      }),
    ).toThrow(
      new ReplayExecutionLimitError("event-count-exceeded", 4, 3),
    );
  });

  it("rejects excessive logical duration before execution", () => {
    expect(() =>
      assertReplayWithinExecutionLimits(bundle, replay(0, 40, 61), {
        maxDurationTicks: 20,
      }),
    ).toThrow(new ReplayExecutionLimitError("duration-exceeded", 21, 20));
  });

  it("rejects invalid caller-supplied limits", () => {
    expect(() =>
      resolveReplayExecutionLimits(bundle, { maxEvents: 0 }),
    ).toThrow(/positive safe integer/);
    expect(() =>
      resolveReplayExecutionLimits(bundle, {
        maxDurationTicks: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrow(/positive safe integer/);
  });
});
