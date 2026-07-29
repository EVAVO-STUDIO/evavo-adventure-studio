import { describe, expect, it } from "vitest";
import {
  advanceFixedStepClock,
  createFixedStepClock,
  type FixedStepConfig,
} from "../src/fixed-step.js";

const config: FixedStepConfig = {
  ticksPerSecond: 60,
  maxCatchUpTicks: 4,
  maxFrameDeltaMilliseconds: 250,
};

describe("fixed-step clock", () => {
  it("accumulates fractional host time without inventing logical ticks", () => {
    const first = advanceFixedStepClock(
      createFixedStepClock(),
      1000 / 120,
      config,
    );
    expect(first.ticksToRun).toBe(0);
    expect(first.interpolationAlpha).toBeCloseTo(0.5);

    const second = advanceFixedStepClock(
      first.state,
      1000 / 120,
      config,
    );
    expect(second.ticksToRun).toBe(1);
    expect(second.interpolationAlpha).toBeCloseTo(0);
  });

  it("bounds catch-up and drops excess whole ticks", () => {
    const advanced = advanceFixedStepClock(
      createFixedStepClock(),
      100,
      config,
    );

    expect(advanced.ticksToRun).toBe(4);
    expect(advanced.droppedMilliseconds).toBeCloseTo(1000 / 30);
    expect(advanced.interpolationAlpha).toBeCloseTo(0);
  });

  it("clamps very large host stalls before catch-up", () => {
    const advanced = advanceFixedStepClock(
      createFixedStepClock(),
      2000,
      config,
    );

    expect(advanced.ticksToRun).toBe(4);
    expect(advanced.droppedMilliseconds).toBeGreaterThan(1800);
    expect(advanced.state.totalDroppedMilliseconds).toBe(
      advanced.droppedMilliseconds,
    );
  });

  it("rejects invalid clock input instead of corrupting time", () => {
    expect(() =>
      advanceFixedStepClock(createFixedStepClock(), -1, config),
    ).toThrow(RangeError);
    expect(() =>
      advanceFixedStepClock(createFixedStepClock(), 16, {
        ...config,
        maxCatchUpTicks: 0,
      }),
    ).toThrow(RangeError);
  });
});
