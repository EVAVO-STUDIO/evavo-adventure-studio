import type { Id } from "@evavo/adventure-project-schema";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  advanceNavigableRuntimeWorld,
  beginActorMovement,
  createInitialNavigableRuntimeWorldState,
} from "../src/movement.js";

const hash = "0".repeat(64);
const id = <T extends string>(value: string) => value as Id<T>;

const actorFrame = (frameId: string, x: number) => ({
  id: frameId,
  assetId: "asset.detective",
  sourceRect: { x, y: 0, width: 12, height: 20 },
  sourceSize: { width: 18, height: 24 },
  trimOffset: { x: 3, y: 4 },
  pivot: { x: 9, y: 23 },
  footPoint: { x: 9, y: 23 },
  durationTicks: 2,
  mirrorEligible: true,
});

const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.movement",
  title: "Movement",
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
  startSceneId: "scene.platforms",
  startEntranceId: "entrance.left",
  assetManifestFingerprint: hash,
  assetCompilerVersion: "0.1.0-test",
  assets: [
    {
      assetId: "asset.background",
      kind: "image",
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/background.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image",
        width: 320,
        height: 200,
        palette: false,
        colourCount: 16,
      },
    },
    {
      assetId: "asset.detective",
      kind: "spritesheet",
      outputFiles: [
        {
          role: "atlas-manifest",
          runtimePath: "assets/detective/atlas.json",
          mediaType: "application/json",
          sha256: hash,
          byteLength: 1,
        },
        {
          role: "page-000",
          runtimePath: "assets/detective/page.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "spritesheet",
        pages: [{ outputRole: "page-000", width: 64, height: 64 }],
        frames: [
          {
            frameId: "frame.idle",
            pageOutputRole: "page-000",
            sourceRect: { x: 0, y: 0, width: 12, height: 20 },
            originalSize: { width: 18, height: 24 },
            trimOffset: { x: 3, y: 4 },
            padding: 1,
          },
          {
            frameId: "frame.walk-1",
            pageOutputRole: "page-000",
            sourceRect: { x: 12, y: 0, width: 12, height: 20 },
            originalSize: { width: 18, height: 24 },
            trimOffset: { x: 3, y: 4 },
            padding: 1,
          },
          {
            frameId: "frame.walk-2",
            pageOutputRole: "page-000",
            sourceRect: { x: 24, y: 0, width: 12, height: 20 },
            originalSize: { width: 18, height: 24 },
            trimOffset: { x: 3, y: 4 },
            padding: 1,
          },
        ],
      },
    },
  ],
  inventoryItems: [],
  actors: [
    {
      id: "actor.detective",
      name: "Detective",
      frames: [actorFrame("frame.idle", 0), actorFrame("frame.walk-1", 12), actorFrame("frame.walk-2", 24)],
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
          frameIds: ["frame.walk-1", "frame.walk-2"],
          loop: true,
          interruptible: true,
        },
      ],
    },
  ],
  scenes: [
    {
      id: "scene.platforms",
      name: "Platforms",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.background",
      navigationAreas: [
        {
          id: "navigation.left",
          shape: {
            points: [
              { x: 0, y: 0 },
              { x: 50, y: 0 },
              { x: 50, y: 50 },
              { x: 0, y: 50 },
            ],
          },
          elevation: 0,
        },
        {
          id: "navigation.right",
          shape: {
            points: [
              { x: 100, y: 0 },
              { x: 150, y: 0 },
              { x: 150, y: 50 },
              { x: 100, y: 50 },
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
          id: "entrance.left",
          position: { x: 10, y: 25 },
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
    projectId: "project.movement",
    objectDefinitions: [],
    scenes: [
      {
        sceneId: "scene.platforms",
        actorInstances: [
          {
            id: "actor-instance.detective",
            actorId: "actor.detective",
            position: { x: 10, y: 25 },
            facing: "east",
            animationState: "idle",
          },
          {
            id: "actor-instance.fixed-guard",
            actorId: "actor.detective",
            position: { x: 20, y: 25 },
            facing: "east",
            animationState: "idle",
            mobility: "fixed",
          },
        ],
        objectInstances: [],
        navigationPortals: [
          {
            id: "portal.bridge",
            fromAreaId: "navigation.left",
            toAreaId: "navigation.right",
            fromPoint: { x: 50, y: 25 },
            toPoint: { x: 100, y: 25 },
            bidirectional: true,
            enabledWhen: {
              kind: "flag",
              flag: "bridgeLowered",
              equals: true,
            },
          },
        ],
      },
    ],
  },
});

describe("fixed-tick actor movement", () => {
  it("rejects fixed instances and routes gated portals from story state", () => {
    const initial = createInitialNavigableRuntimeWorldState(bundle);
    expect(
      beginActorMovement(bundle, initial, id<"actor-instance">("actor-instance.fixed-guard"), {
        x: 40,
        y: 25,
      }),
    ).toMatchObject({ kind: "rejected", reason: "fixed-instance" });

    expect(
      beginActorMovement(bundle, initial, id<"actor-instance">("actor-instance.detective"), {
        x: 140,
        y: 25,
      }),
    ).toMatchObject({
      kind: "unreachable",
      routeResult: { reason: "no-connected-route" },
    });
  });

  it("advances subpixel movement and restores idle animation on arrival", () => {
    const initial = createInitialNavigableRuntimeWorldState(bundle);
    const enabled = {
      ...initial,
      story: {
        ...initial.story,
        flags: { bridgeLowered: true },
      },
    };
    const started = beginActorMovement(
      bundle,
      enabled,
      id<"actor-instance">("actor-instance.detective"),
      { x: 140, y: 25 },
      { speedPixelsPerSecond: 60 },
    );
    expect(started.kind).toBe("started");
    if (started.kind !== "started") {
      throw new Error("Expected movement to start.");
    }
    expect(started.state.actorInstances["actor-instance.detective"]?.animationState).toBe("walk");

    const partial = advanceNavigableRuntimeWorld(bundle, started.state, 15);
    expect(partial.state.actorInstances["actor-instance.detective"]?.position).toEqual({ x: 25, y: 25 });
    expect(partial.state.story.tick).toBe(15);

    const completed = advanceNavigableRuntimeWorld(bundle, partial.state, 115);
    expect(completed.state.actorInstances["actor-instance.detective"]?.position).toEqual({ x: 140, y: 25 });
    expect(completed.state.movements["actor-instance.detective"]).toBeUndefined();
    expect(completed.state.actorInstances["actor-instance.detective"]?.animationState).toBe("idle");
    expect(completed.state.story.tick).toBe(130);
    expect(completed.movementEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "movement-segment-completed",
          portalId: "portal.bridge",
        }),
        expect.objectContaining({ kind: "movement-completed" }),
      ]),
    );
  });

  it("snaps clicks beyond a walk surface to the reachable boundary", () => {
    const initial = createInitialNavigableRuntimeWorldState(bundle);
    const started = beginActorMovement(
      bundle,
      initial,
      id<"actor-instance">("actor-instance.detective"),
      { x: 70, y: 25 },
      { speedPixelsPerSecond: 60 },
    );

    expect(started.kind).toBe("started");
    if (started.kind === "started") {
      expect(started.route.snappedEnd).toBe(true);
      expect(started.route.points.at(-1)).toEqual({ x: 50, y: 25 });
    }
  });
});
