import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import { describe, expect, it } from "vitest";
import {
  advanceProfiledRuntimeCamera,
  canonicalProfiledRuntimeCameraJson,
  createProfiledRuntimeCamera,
  parseProfiledRuntimeCameraJson,
  restoreProfiledRuntimeCamera,
} from "../src/profiled-camera.js";

const actorInstanceId = "actor-instance.scrolling-proof" as Id<"actor-instance">;

const bundle = (): RuntimeBundle =>
  ({
    playFeelProfileId: "pulp-grounded",
    presentation: {
      nativeWidth: 320,
      nativeHeight: 200,
      logicalTicksPerSecond: 60,
    },
    scenes: [
      {
        id: "scene.scrolling-proof",
        width: 640,
        height: 200,
        entrances: [
          {
            id: "entrance.scrolling-proof",
            position: { x: 36, y: 170 },
            facing: "east",
          },
        ],
      },
    ],
    sequences: [],
  }) as unknown as RuntimeBundle;

const world = (tick: number, x: number): InteractiveRuntimeWorldState =>
  ({
    story: {
      tick,
      currentSceneId: "scene.scrolling-proof",
      currentEntranceId: "entrance.scrolling-proof",
      activeSequences: [],
    },
    actorInstances: {
      [actorInstanceId]: {
        instanceId: actorInstanceId,
        sceneId: "scene.scrolling-proof",
        actorId: "actor.scrolling-proof",
        position: { x, y: 170 },
      },
    },
    movements: {},
    pendingObjectCommands: {},
  }) as unknown as InteractiveRuntimeWorldState;

describe("classic 320×200 scrolling room stress proof", () => {
  it("follows a controlled actor across a 640×200 room and clamps exactly at both horizontal edges", () => {
    const runtime = bundle();
    let previous = world(0, 36);
    let state = createProfiledRuntimeCamera({
      bundle: runtime,
      world: previous,
      controlledActorInstanceId: actorInstanceId,
    });
    expect(state?.camera.position).toEqual({ x: 0, y: 0 });

    let observedPositiveScroll = false;
    for (let tick = 1; tick <= 360; tick += 1) {
      const x = 36 + ((604 - 36) * tick) / 360;
      const next = world(tick, x);
      const advanced = advanceProfiledRuntimeCamera({
        bundle: runtime,
        state,
        previousWorld: previous,
        nextWorld: next,
        controlledActorInstanceId: actorInstanceId,
      });
      state = advanced.state;
      previous = next;
      if ((state?.camera.position.x ?? 0) > 0) observedPositiveScroll = true;
      expect(Number.isInteger(state?.camera.position.x)).toBe(true);
      expect(state?.camera.position.y).toBe(0);
      expect(state?.camera.position.x).toBeGreaterThanOrEqual(0);
      expect(state?.camera.position.x).toBeLessThanOrEqual(320);
    }

    expect(observedPositiveScroll).toBe(true);
    expect(state?.camera.position.x).toBe(320);

    for (let tick = 361; tick <= 720; tick += 1) {
      const progress = (tick - 360) / 360;
      const x = 604 - (604 - 36) * progress;
      const next = world(tick, x);
      const advanced = advanceProfiledRuntimeCamera({
        bundle: runtime,
        state,
        previousWorld: previous,
        nextWorld: next,
        controlledActorInstanceId: actorInstanceId,
      });
      state = advanced.state;
      previous = next;
    }

    expect(state?.camera.position).toEqual({ x: 0, y: 0 });
  });

  it("round-trips the scrolled camera state exactly through canonical save metadata", () => {
    const runtime = bundle();
    let previous = world(0, 36);
    let state = createProfiledRuntimeCamera({
      bundle: runtime,
      world: previous,
      controlledActorInstanceId: actorInstanceId,
    });

    for (let tick = 1; tick <= 240; tick += 1) {
      const next = world(tick, 36 + tick * 2);
      state = advanceProfiledRuntimeCamera({
        bundle: runtime,
        state,
        previousWorld: previous,
        nextWorld: next,
        controlledActorInstanceId: actorInstanceId,
      }).state;
      previous = next;
    }
    if (!state) throw new Error("Expected profiled camera state.");
    expect(state.camera.position.x).toBeGreaterThan(0);

    const json = canonicalProfiledRuntimeCameraJson(state);
    expect(parseProfiledRuntimeCameraJson(json)).toEqual(state);
    expect(
      restoreProfiledRuntimeCamera({
        bundle: runtime,
        world: previous,
        controlledActorInstanceId: actorInstanceId,
        savedState: JSON.parse(json) as unknown,
      }),
    ).toEqual(state);
  });
});
