import { describe, expect, it } from "vitest";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  advanceNavigableRuntimeWorld,
  beginActorMovement,
  createInitialNavigableRuntimeWorldState,
} from "../src/movement.js";

const actorInstanceId =
  "actor-instance.traveller" as Id<"actor-instance">;

const actorFrame = (frameId: string, x: number) => ({
  id: frameId,
  assetId: "asset.traveller",
  sourceRect: { x, y: 0, width: 14, height: 28 },
  sourceSize: { width: 18, height: 32 },
  trimOffset: { x: 2, y: 4 },
  pivot: { x: 9, y: 31 },
  footPoint: { x: 9, y: 31 },
  durationTicks: 3,
  mirrorEligible: true,
});

const runtimeBundle = (portal = false): RuntimeBundle =>
  ({
    bundleVersion: 1,
    sourceSchemaVersion: 1,
    projectId: "project.profiled-world",
    title: "Profiled World",
    presentation: {
      nativeWidth: 320,
      nativeHeight: 200,
      interactionMode: "context",
      integerScale: true,
      textureSampling: "nearest",
      logicalTicksPerSecond: 60,
      pixelMotionPolicy: "strict",
      showScore: false,
      allowHotspotAssist: false,
    },
    playFeelProfileId: "storybook-deliberate",
    startSceneId: "scene.road",
    startEntranceId: "entrance.road",
    assetManifestFingerprint: "0".repeat(64),
    assetCompilerVersion: "test",
    assets: [],
    inventoryItems: [],
    actors: [
      {
        id: "actor.traveller",
        name: "Traveller",
        frames: [
          actorFrame("frame.idle", 0),
          actorFrame("frame.walk-a", 14),
          actorFrame("frame.walk-b", 28),
        ],
        animations: [
          {
            id: "animation.idle-east",
            state: "idle",
            facing: "east",
            frameIds: ["frame.idle"],
            loop: true,
            interruptible: true,
          },
          {
            id: "animation.walk-east",
            state: "walk",
            facing: "east",
            frameIds: ["frame.walk-a", "frame.walk-b"],
            loop: true,
            interruptible: true,
          },
        ],
      },
    ],
    scenes: [
      {
        id: "scene.road",
        name: "Road",
        width: 320,
        height: 200,
        backgroundAssetId: "asset.road",
        navigationAreas: portal
          ? [
              {
                id: "navigation.left",
                shape: {
                  points: [
                    { x: 0, y: 130 },
                    { x: 100, y: 130 },
                    { x: 100, y: 190 },
                    { x: 0, y: 190 },
                  ],
                },
                elevation: 0,
              },
              {
                id: "navigation.right",
                shape: {
                  points: [
                    { x: 150, y: 130 },
                    { x: 300, y: 130 },
                    { x: 300, y: 190 },
                    { x: 150, y: 190 },
                  ],
                },
                elevation: 0,
              },
            ]
          : [
              {
                id: "navigation.road",
                shape: {
                  points: [
                    { x: 0, y: 130 },
                    { x: 300, y: 130 },
                    { x: 300, y: 190 },
                    { x: 0, y: 190 },
                  ],
                },
                elevation: 0,
              },
            ],
        depthBands: [],
        occluders: [],
        hotspots: [],
        entrances: [
          {
            id: "entrance.road",
            position: { x: 20, y: 160 },
            facing: "east",
          },
        ],
        fallbackText: "Nothing happens.",
      },
    ],
    dialogues: [],
    sequences: [],
    sceneInstances: {
      manifestVersion: 1,
      projectId: "project.profiled-world",
      objectDefinitions: [],
      scenes: [
        {
          sceneId: "scene.road",
          actorInstances: [
            {
              id: actorInstanceId,
              actorId: "actor.traveller",
              position: { x: 20, y: 160 },
              facing: "east",
              animationState: "idle",
              mobility: "walkable",
            },
          ],
          objectInstances: [],
          navigationPortals: portal
            ? [
                {
                  id: "portal.bridge",
                  fromAreaId: "navigation.left",
                  toAreaId: "navigation.right",
                  fromPoint: { x: 100, y: 160 },
                  toPoint: { x: 150, y: 160 },
                  bidirectional: true,
                  traversalCost: 12,
                },
              ]
            : [],
        },
      ],
    },
  }) as unknown as RuntimeBundle;

const finishSteppedMovement = (
  bundle: RuntimeBundle,
  initial: ReturnType<typeof createInitialNavigableRuntimeWorldState>,
) => {
  let state = initial;
  const events: ReturnType<
    typeof advanceNavigableRuntimeWorld
  >["movementEvents"][number][] = [];
  let ticks = 0;
  while (state.movements[actorInstanceId]) {
    const advanced = advanceNavigableRuntimeWorld(bundle, state, 1);
    state = advanced.state;
    events.push(...advanced.movementEvents);
    ticks += 1;
    if (ticks > 2_000) throw new Error("Profiled movement did not arrive.");
  }
  return { state, events, ticks };
};

describe("profiled movement in the canonical runtime world", () => {
  it("uses the bundle profile and converges identically in chunks or single ticks", () => {
    const bundle = runtimeBundle();
    const initial = createInitialNavigableRuntimeWorldState(bundle);
    const started = beginActorMovement(
      bundle,
      initial,
      actorInstanceId,
      { x: 270, y: 160 },
    );

    expect(started.kind).toBe("started");
    if (started.kind !== "started") throw new Error("Expected movement start.");
    expect(started.movementMode).toBe("profiled");
    expect(started.event).toMatchObject({
      movementMode: "profiled",
      profileId: "storybook-deliberate",
    });
    expect(started.state.movements[actorInstanceId]?.profiled).toBeDefined();

    const stepped = finishSteppedMovement(bundle, started.state);
    const chunked = advanceNavigableRuntimeWorld(
      bundle,
      started.state,
      stepped.ticks,
    );

    expect(chunked.state).toEqual(stepped.state);
    expect(chunked.movementEvents).toEqual(stepped.events);
    expect(stepped.state.actorInstances[actorInstanceId]?.position).toEqual({
      x: 270,
      y: 160,
    });
    expect(
      stepped.state.actorInstances[actorInstanceId]?.animationState,
    ).toBe("idle");
    expect(
      stepped.events.some((event) => event.kind === "movement-footfall"),
    ).toBe(true);
    expect(
      stepped.events.some(
        (event) =>
          event.kind === "movement-phase-changed" &&
          event.phase === "arrived",
      ),
    ).toBe(true);
    expect(stepped.events.at(-1)).toMatchObject({
      kind: "movement-completed",
      destination: { x: 270, y: 160 },
    });
  });

  it("retains the exact legacy path when a caller explicitly disables profiles", () => {
    const bundle = runtimeBundle();
    const initial = createInitialNavigableRuntimeWorldState(bundle);
    const started = beginActorMovement(
      bundle,
      initial,
      actorInstanceId,
      { x: 80, y: 160 },
      {
        playFeelProfileId: null,
        speedPixelsPerSecond: 60,
      },
    );

    expect(started.kind).toBe("started");
    if (started.kind !== "started") throw new Error("Expected movement start.");
    expect(started.movementMode).toBe("legacy");
    expect(started.state.movements[actorInstanceId]?.profiled).toBeUndefined();

    const advanced = advanceNavigableRuntimeWorld(bundle, started.state, 15);
    expect(advanced.state.actorInstances[actorInstanceId]?.position).toEqual({
      x: 35,
      y: 160,
    });
  });

  it("falls back visibly when a portal cost is not physical walking distance", () => {
    const bundle = runtimeBundle(true);
    const initial = createInitialNavigableRuntimeWorldState(bundle);
    const started = beginActorMovement(
      bundle,
      initial,
      actorInstanceId,
      { x: 250, y: 160 },
    );

    expect(started.kind).toBe("started");
    if (started.kind !== "started") throw new Error("Expected movement start.");
    expect(started).toMatchObject({
      movementMode: "legacy",
      profileFallbackReason: "non-geometric-portal",
      event: {
        movementMode: "legacy",
        profileId: "storybook-deliberate",
        fallbackReason: "non-geometric-portal",
      },
    });
    expect(started.state.movements[actorInstanceId]?.profiled).toBeUndefined();
  });
});
