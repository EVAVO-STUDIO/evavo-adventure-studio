import type { Actor, Id } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { advanceAnimation, startAnimation } from "../src/index.js";

const id = <T extends string>(value: string) => value as Id<T>;

const actor: Actor = {
  id: id<"actor">("actor.detective"),
  name: "Detective",
  frames: [
    {
      id: id<"sprite-frame">("frame.idle-hold"),
      assetId: id<"asset">("asset.detective"),
      sourceRect: { x: 0, y: 0, width: 32, height: 64 },
      sourceSize: { width: 32, height: 64 },
      trimOffset: { x: 0, y: 0 },
      pivot: { x: 16, y: 64 },
      footPoint: { x: 16, y: 63 },
      durationTicks: 4,
      events: ["blink-start"],
      mirrorEligible: true,
    },
    {
      id: id<"sprite-frame">("frame.idle-blink"),
      assetId: id<"asset">("asset.detective"),
      sourceRect: { x: 32, y: 0, width: 32, height: 64 },
      sourceSize: { width: 32, height: 64 },
      trimOffset: { x: 0, y: 0 },
      pivot: { x: 16, y: 64 },
      footPoint: { x: 16, y: 63 },
      durationTicks: 8,
      events: ["blink-end"],
      mirrorEligible: true,
    },
  ],
  animations: [
    {
      id: id<"animation-clip">("animation.idle-once"),
      state: "idle",
      facing: "south",
      frameIds: [id<"sprite-frame">("frame.idle-hold"), id<"sprite-frame">("frame.idle-blink")],
      loop: false,
      interruptible: true,
    },
    {
      id: id<"animation-clip">("animation.idle-loop"),
      state: "idle",
      facing: "south",
      frameIds: [id<"sprite-frame">("frame.idle-hold"), id<"sprite-frame">("frame.idle-blink")],
      loop: true,
      interruptible: true,
    },
  ],
};

describe("sprite animation cadence", () => {
  it("preserves authored frame holds and emits markers on entry", () => {
    const started = startAnimation(actor, id<"animation-clip">("animation.idle-once"));
    expect(started.frame.id).toBe("frame.idle-hold");
    expect(started.events.map((event) => event.kind)).toEqual(["frame-entered", "marker"]);

    const held = advanceAnimation(actor, started.state, 3);
    expect(held.frame.id).toBe("frame.idle-hold");
    expect(held.state.ticksIntoFrame).toBe(3);
    expect(held.events).toEqual([]);

    const blink = advanceAnimation(actor, held.state, 1);
    expect(blink.frame.id).toBe("frame.idle-blink");
    expect(blink.events).toEqual([
      expect.objectContaining({ kind: "frame-entered" }),
      expect.objectContaining({ kind: "marker", marker: "blink-end" }),
    ]);
  });

  it("holds the final frame when a non-looping performance completes", () => {
    const started = startAnimation(actor, id<"animation-clip">("animation.idle-once"));
    const completed = advanceAnimation(actor, started.state, 12);

    expect(completed.state).toMatchObject({
      frameIndex: 1,
      ticksIntoFrame: 8,
      completed: true,
    });
    expect(completed.frame.id).toBe("frame.idle-blink");
    expect(completed.events.at(-1)).toMatchObject({ kind: "completed" });
  });

  it("loops at exact authored boundaries without smoothing", () => {
    const started = startAnimation(actor, id<"animation-clip">("animation.idle-loop"));
    const looped = advanceAnimation(actor, started.state, 12);

    expect(looped.state).toMatchObject({
      frameIndex: 0,
      ticksIntoFrame: 0,
      loopIteration: 1,
      completed: false,
    });
    expect(looped.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "looped", iteration: 1 })]),
    );
  });
});
