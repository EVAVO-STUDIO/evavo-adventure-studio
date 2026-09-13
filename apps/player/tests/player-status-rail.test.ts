import { describe, expect, it } from "vitest";
import { createPlayerStatusRail } from "../src/player-status-rail.js";

describe("Player status rail", () => {
  it("holds transient feedback until its presentation window expires", () => {
    let now = 100;
    const writes: string[] = [];
    const rail = createPlayerStatusRail((text) => writes.push(text), {
      now: () => now,
      defaultHoldMilliseconds: 1200,
    });

    rail.replace("READY");
    rail.announce("GAME SAVED");
    rail.refresh("CLICK TO WALK");

    expect(rail.current()).toBe("GAME SAVED");
    expect(rail.isHeld()).toBe(true);
    expect(writes).toEqual(["READY", "GAME SAVED"]);

    now = 1300;
    rail.refresh("CLICK TO WALK");
    expect(rail.current()).toBe("CLICK TO WALK");
    expect(rail.isHeld()).toBe(false);
    expect(writes).toEqual(["READY", "GAME SAVED", "CLICK TO WALK"]);
  });

  it("lets deliberate gameplay status replace a held announcement immediately", () => {
    let now = 0;
    const writes: string[] = [];
    const rail = createPlayerStatusRail((text) => writes.push(text), { now: () => now });

    rail.announce("REPLAY EXPORTED");
    rail.replace("LOOK AT LEDGER");
    now = 100;
    rail.refresh("LOOK AT LEDGER");

    expect(rail.isHeld()).toBe(false);
    expect(writes).toEqual(["REPLAY EXPORTED", "LOOK AT LEDGER"]);
  });

  it("rejects invalid hold durations", () => {
    expect(() =>
      createPlayerStatusRail(() => undefined, { defaultHoldMilliseconds: -1 }),
    ).toThrow(RangeError);

    const rail = createPlayerStatusRail(() => undefined, { now: () => 0 });
    expect(() => rail.announce("INVALID", Number.NaN)).toThrow(RangeError);
  });
});
