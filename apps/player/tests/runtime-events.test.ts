import { describe, expect, it } from "vitest";
import { canonicalRuntimeTickFromPlayerTick } from "../src/runtime-events.js";

describe("player runtime restore tick mapping", () => {
  it("maps a continuous player-session tick back to the restored canonical runtime tick", () => {
    expect(canonicalRuntimeTickFromPlayerTick(950, 700)).toBe(250);
    expect(canonicalRuntimeTickFromPlayerTick(951, 700)).toBe(251);
  });

  it("rejects invalid mapped ticks", () => {
    expect(() => canonicalRuntimeTickFromPlayerTick(10, 11)).toThrow(RangeError);
    expect(() => canonicalRuntimeTickFromPlayerTick(1.5, 0)).toThrow(RangeError);
  });
});