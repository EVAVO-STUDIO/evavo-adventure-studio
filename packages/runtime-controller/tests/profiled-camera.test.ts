import { describe, expect, it } from "vitest";
import type { RuntimeEvent } from "@evavo/adventure-core";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import {
  advanceProfiledRuntimeCamera,
  canonicalProfiledRuntimeCameraJson,
  createProfiledRuntimeCamera,
  parseProfiledRuntimeCameraJson,
  resolvedProfiledRuntimeCamera,
  restoreProfiledRuntimeCamera,
  validateProfiledRuntimeCameraCompatibility,
} from "../src/profiled-camera.js";

const actorInstanceId =
  "actor-instance.traveller" as Id<"actor-instance">;
const sequenceId = "sequence.pan" as Id<"sequence">;
const trackId = "sequence-track.camera" as Id<"sequence-track">;

const bundle = (
  profileId: RuntimeBundle["playFeelProfileId"] | null = "pulp-grounded",
): RuntimeBundle =>
  ({
    ...(profileId ? { playFeelProfileId: profileId } : {}),
    presentation: {
      nativeWidth: 160,
      nativeHeight: 100,
      logicalTicksPerSecond: 60,
    },
    scenes: [
      {
        id: "scene.road",
        width: 320,
        height: 200,
        entrances: [
          {
            id: "entrance.road",
            position: { x: 40, y: 150 },
            facing: "east",
          },
        ],
      },
    ],
    sequences: [
      {
        id: sequenceId,
        durationTicks: 30,
        loop: false,
        tracks: [
          {
            id: trackId,
            cues: [
              {
                kind: "camera-shot",
                atTick: 2,
                durationTicks: 4,
                position: { x: 180, y: 120 },
                easing: "ease-in-out",
              },
            ],
          },
        ],
      },
    ],
  }) as unknown as RuntimeBundle;

const world = (
  tick: number,
  actorX: number,
  activeSequence = false,
): InteractiveRuntimeWorldState =>
  ({
    story: {
      tick,
      currentSceneId: "scene.road",
      currentEntranceId: "entrance.road",
      activeSequences: activeSequence
        ? [
            {
              sequenceId,
              elapsedTicks: Math.max(0, tick - 1),
              iteration: 0,
              nextCueIndexByTrack: {},
            },
          ]
        : [],
    },
    actorInstances: {
      [actorInstanceId]: {
        instanceId: actorInstanceId,
        sceneId: "scene.road",
        actorId: "actor.traveller",
        position: { x: actorX, y: 150 },
      },
    },
    movements: {},
    pendingObjectCommands: {},
  }) as unknown as InteractiveRuntimeWorldState;

const cameraCue = (): RuntimeEvent => ({
  kind: "sequence-cue-reached",
  sequenceId,
  trackId,
  cueIndex: 0,
  cue: {
    kind: "camera-shot",
    atTick: 2,
    durationTicks: 4,
    position: { x: 180, y: 120 },
    easing: "ease-in-out",
  },
});

describe("profiled runtime camera", () => {
  it("follows a controlled actor deterministically inside scene bounds", () => {
    const runtime = bundle();
    const initialWorld = world(0, 40);
    const initial = createProfiledRuntimeCamera({
      bundle: runtime,
      world: initialWorld,
      controlledActorInstanceId: actorInstanceId,
    });
    expect(initial).not.toBeNull();

    const run = () => {
      let state = initial;
      let previous = initialWorld;
      for (let tick = 1; tick <= 180; tick += 1) {
        const next = world(tick, 40 + tick * 1.2);
        state = advanceProfiledRuntimeCamera({
          bundle: runtime,
          state,
          previousWorld: previous,
          nextWorld: next,
          controlledActorInstanceId: actorInstanceId,
        }).state;
        previous = next;
      }
      return state;
    };

    const first = run();
    const second = run();
    expect(second).toEqual(first);
    expect(first?.camera.position.x).toBeGreaterThan(0);
    expect(first?.camera.position.x).toBeLessThanOrEqual(160);
    expect(first?.camera.position.y).toBeLessThanOrEqual(100);
    expect(Number.isInteger(first?.camera.position.x)).toBe(true);
    expect(Number.isInteger(first?.camera.position.y)).toBe(true);
  });

  it("executes authored camera-shot easing and releases after completion", () => {
    const runtime = bundle();
    let previous = world(0, 40, true);
    let state = createProfiledRuntimeCamera({
      bundle: runtime,
      world: previous,
      controlledActorInstanceId: actorInstanceId,
    });

    const firstWorld = world(1, 40, true);
    state = advanceProfiledRuntimeCamera({
      bundle: runtime,
      state,
      previousWorld: previous,
      nextWorld: firstWorld,
      controlledActorInstanceId: actorInstanceId,
      runtimeEvents: [cameraCue()],
    }).state;
    previous = firstWorld;
    expect(state?.activeShot).not.toBeNull();

    for (let tick = 2; tick <= 5; tick += 1) {
      const next = world(tick, 40, true);
      state = advanceProfiledRuntimeCamera({
        bundle: runtime,
        state,
        previousWorld: previous,
        nextWorld: next,
        controlledActorInstanceId: actorInstanceId,
      }).state;
      previous = next;
    }

    expect(state?.camera.position).toEqual({ x: 160, y: 100 });
    const completedWorld = world(6, 40, false);
    const completed = advanceProfiledRuntimeCamera({
      bundle: runtime,
      state,
      previousWorld: previous,
      nextWorld: completedWorld,
      controlledActorInstanceId: actorInstanceId,
      runtimeEvents: [
        { kind: "sequence-completed", sequenceId },
      ],
    });
    expect(completed.state?.activeShot).toBeNull();
    expect(completed.camera.position).toEqual({ x: 160, y: 100 });
  });

  it("keeps fixed tableaux still until a sequence explicitly moves them", () => {
    const runtime = bundle("storybook-deliberate");
    const initialWorld = world(0, 40);
    const initial = createProfiledRuntimeCamera({
      bundle: runtime,
      world: initialWorld,
      controlledActorInstanceId: actorInstanceId,
    });
    const moved = advanceProfiledRuntimeCamera({
      bundle: runtime,
      state: initial,
      previousWorld: initialWorld,
      nextWorld: world(1, 240),
      controlledActorInstanceId: actorInstanceId,
    });
    expect(moved.camera.position).toEqual({ x: 0, y: 0 });
  });

  it("round-trips strict camera state and rejects authored cue drift", () => {
    const runtime = bundle();
    const initialWorld = world(0, 40, true);
    const started = advanceProfiledRuntimeCamera({
      bundle: runtime,
      state: createProfiledRuntimeCamera({
        bundle: runtime,
        world: initialWorld,
        controlledActorInstanceId: actorInstanceId,
      }),
      previousWorld: initialWorld,
      nextWorld: world(1, 40, true),
      controlledActorInstanceId: actorInstanceId,
      runtimeEvents: [cameraCue()],
    }).state;
    if (!started) throw new Error("Expected a profiled camera.");

    const json = canonicalProfiledRuntimeCameraJson(started);
    expect(parseProfiledRuntimeCameraJson(json)).toEqual(started);
    expect(
      restoreProfiledRuntimeCamera({
        bundle: runtime,
        world: world(1, 40, true),
        controlledActorInstanceId: actorInstanceId,
        savedState: JSON.parse(json) as unknown,
      }),
    ).toEqual(started);

    const changedBundle = {
      ...runtime,
      sequences: runtime.sequences.map((sequence) => ({
        ...sequence,
        tracks: sequence.tracks.map((track) => ({
          ...track,
          cues: track.cues.map((cue) =>
            cue.kind === "camera-shot"
              ? { ...cue, position: { x: 40, y: 20 } }
              : cue,
          ),
        })),
      })),
    };
    expect(
      validateProfiledRuntimeCameraCompatibility({
        bundle: changedBundle,
        world: world(1, 40, true),
        state: started,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "shot-cue-mismatch" }),
      ]),
    );
  });

  it("resets exactly on scene changes without advancing the camera twice", () => {
    const runtime = {
      ...bundle(),
      scenes: [
        ...bundle().scenes,
        {
          id: "scene.hall",
          width: 400,
          height: 220,
          entrances: [
            {
              id: "entrance.hall",
              position: { x: 300, y: 170 },
              facing: "west",
            },
          ],
        },
      ],
    } as RuntimeBundle;
    const previous = world(0, 40);
    const state = createProfiledRuntimeCamera({
      bundle: runtime,
      world: previous,
      controlledActorInstanceId: actorInstanceId,
    });
    const next = {
      ...world(1, 40),
      story: {
        ...world(1, 40).story,
        currentSceneId: "scene.hall",
        currentEntranceId: "entrance.hall",
      },
    } as InteractiveRuntimeWorldState;
    const advanced = advanceProfiledRuntimeCamera({
      bundle: runtime,
      state,
      previousWorld: previous,
      nextWorld: next,
      controlledActorInstanceId: actorInstanceId,
    });

    expect(advanced.state?.sceneId).toBe("scene.hall");
    expect(advanced.state?.camera.tick).toBe(1);
    expect(advanced.camera.position.x).toBeGreaterThan(0);
  });

  it("preserves the legacy origin camera when no profile is selected", () => {
    const runtime = bundle(null);
    const created = createProfiledRuntimeCamera({
      bundle: runtime,
      world: world(0, 40),
      controlledActorInstanceId: actorInstanceId,
    });
    expect(created).toBeNull();
    expect(resolvedProfiledRuntimeCamera(runtime, created)).toEqual({
      position: { x: 0, y: 0 },
      viewport: { width: 160, height: 100 },
      shakeOffset: { x: 0, y: 0 },
    });
  });
});
