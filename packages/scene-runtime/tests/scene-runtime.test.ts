import type { Id } from "@evavo/adventure-project-schema";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  advanceRuntimeWorld,
  createInitialRuntimeWorldState,
  resolveRuntimeSceneFrame,
  setActorInstancePosition,
  setActorInstanceVisibility,
  setObjectInstanceState,
} from "../src/index.js";

const hash = "0".repeat(64);
const id = <T extends string>(value: string) => value as Id<T>;

const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.scene-runtime",
  title: "Scene Runtime",
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
  startSceneId: "scene.office",
  startEntranceId: "entrance.office",
  assetManifestFingerprint: hash,
  assetCompilerVersion: "0.1.0-test",
  assets: [
    {
      assetId: "asset.office",
      kind: "image",
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/office.png",
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
        colourCount: 32,
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
          runtimePath: "assets/detective/page-000.png",
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
            frameId: "frame.detective.idle-1",
            pageOutputRole: "page-000",
            sourceRect: { x: 1, y: 1, width: 12, height: 20 },
            originalSize: { width: 18, height: 24 },
            trimOffset: { x: 3, y: 4 },
            padding: 1,
          },
          {
            frameId: "frame.detective.idle-2",
            pageOutputRole: "page-000",
            sourceRect: { x: 15, y: 1, width: 12, height: 20 },
            originalSize: { width: 18, height: 24 },
            trimOffset: { x: 3, y: 4 },
            padding: 1,
          },
        ],
      },
    },
    {
      assetId: "asset.lamp",
      kind: "spritesheet",
      outputFiles: [
        {
          role: "atlas-manifest",
          runtimePath: "assets/lamp/atlas.json",
          mediaType: "application/json",
          sha256: hash,
          byteLength: 1,
        },
        {
          role: "page-000",
          runtimePath: "assets/lamp/page-000.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "spritesheet",
        pages: [{ outputRole: "page-000", width: 32, height: 32 }],
        frames: [
          {
            frameId: "frame.lamp.on",
            pageOutputRole: "page-000",
            sourceRect: { x: 1, y: 1, width: 10, height: 16 },
            originalSize: { width: 14, height: 18 },
            trimOffset: { x: 2, y: 1 },
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
      frames: [
        {
          id: "frame.detective.idle-1",
          assetId: "asset.detective",
          sourceRect: { x: 1, y: 1, width: 12, height: 20 },
          sourceSize: { width: 18, height: 24 },
          trimOffset: { x: 3, y: 4 },
          pivot: { x: 9, y: 23 },
          footPoint: { x: 9, y: 23 },
          durationTicks: 2,
          mirrorEligible: true,
        },
        {
          id: "frame.detective.idle-2",
          assetId: "asset.detective",
          sourceRect: { x: 15, y: 1, width: 12, height: 20 },
          sourceSize: { width: 18, height: 24 },
          trimOffset: { x: 3, y: 4 },
          pivot: { x: 9, y: 23 },
          footPoint: { x: 9, y: 23 },
          durationTicks: 2,
          mirrorEligible: true,
        },
      ],
      animations: [
        {
          id: "animation.detective.idle-east",
          state: "idle",
          facing: "east",
          frameIds: ["frame.detective.idle-1", "frame.detective.idle-2"],
          loop: true,
          interruptible: true,
        },
      ],
    },
  ],
  scenes: [
    {
      id: "scene.office",
      name: "Office",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.office",
      navigationAreas: [
        {
          id: "navigation.office",
          shape: {
            points: [
              { x: 0, y: 100 },
              { x: 320, y: 100 },
              { x: 320, y: 200 },
              { x: 0, y: 200 },
            ],
          },
          elevation: 0,
        },
      ],
      depthBands: [
        {
          id: "depth.office",
          farY: 100,
          nearY: 200,
          farScale: 0.75,
          nearScale: 1,
        },
      ],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.office",
          position: { x: 20, y: 170 },
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
    projectId: "project.scene-runtime",
    objectDefinitions: [
      {
        id: "object-definition.lamp",
        name: "Desk lamp",
        initialStateId: "object-state.lamp.on",
        states: [
          {
            id: "object-state.lamp.on",
            visual: {
              kind: "sprite-frame",
              assetId: "asset.lamp",
              frameId: "frame.lamp.on",
              sourceRect: { x: 1, y: 1, width: 10, height: 16 },
              sourceSize: { width: 14, height: 18 },
              trimOffset: { x: 2, y: 1 },
              pivot: { x: 7, y: 17 },
            },
            interactions: [],
          },
          {
            id: "object-state.lamp.off",
            visible: false,
            interactions: [],
          },
        ],
      },
    ],
    scenes: [
      {
        sceneId: "scene.office",
        actorInstances: [
          {
            id: "actor-instance.office.detective",
            actorId: "actor.detective",
            position: { x: 60.4, y: 160.6 },
            facing: "east",
            animationState: "idle",
          },
        ],
        objectInstances: [
          {
            id: "object.office.lamp",
            definitionId: "object-definition.lamp",
            position: { x: 200, y: 130 },
          },
        ],
      },
    ],
  },
});

describe("persistent scene runtime", () => {
  it("initialises placed actor animation and object state", () => {
    const world = createInitialRuntimeWorldState(bundle);

    expect(world.story.objectStates["object.office.lamp"]).toBe("object-state.lamp.on");
    expect(world.actorInstances["actor-instance.office.detective"]?.playback.frameIndex).toBe(0);
  });

  it("resolves background, actor and object using stable scene depth", () => {
    const frame = resolveRuntimeSceneFrame(bundle, createInitialRuntimeWorldState(bundle));

    expect(frame.nodes.map((node) => node.id)).toEqual([
      "render.scene.scene.office.background",
      "render.object.object.office.lamp",
      "render.actor-instance.actor-instance.office.detective",
    ]);
    const actor = frame.nodes.find(
      (node) => node.id === "render.actor-instance.actor-instance.office.detective",
    );
    expect(actor).toMatchObject({
      kind: "sprite",
      frameId: "frame.detective.idle-1",
      transform: { position: { x: 60, y: 161 } },
    });
  });

  it("advances animation on logical ticks without mutating source data", () => {
    const initial = createInitialRuntimeWorldState(bundle);
    const advanced = advanceRuntimeWorld(bundle, initial, 2);
    const frame = resolveRuntimeSceneFrame(bundle, advanced.state);
    const actor = frame.nodes.find(
      (node) => node.id === "render.actor-instance.actor-instance.office.detective",
    );

    expect(actor).toMatchObject({ frameId: "frame.detective.idle-2" });
    expect(advanced.state.story.tick).toBe(2);
    expect(initial.story.tick).toBe(0);
  });

  it("persists object states and actor placement overrides", () => {
    let world = createInitialRuntimeWorldState(bundle);
    world = setObjectInstanceState(
      bundle,
      world,
      id<"object">("object.office.lamp"),
      id<"object-state">("object-state.lamp.off"),
    );
    world = setActorInstancePosition(world, id<"actor-instance">("actor-instance.office.detective"), {
      x: 100,
      y: 180,
    });
    const frame = resolveRuntimeSceneFrame(bundle, world);

    expect(frame.nodes.some((node) => node.id === "render.object.object.office.lamp")).toBe(false);
    expect(
      frame.nodes.find((node) => node.id === "render.actor-instance.actor-instance.office.detective")
        ?.transform.position,
    ).toEqual({ x: 100, y: 180 });
  });

  it("supports explicit actor visibility overrides", () => {
    const initial = createInitialRuntimeWorldState(bundle);
    const hidden = setActorInstanceVisibility(
      initial,
      id<"actor-instance">("actor-instance.office.detective"),
      false,
    );

    expect(
      resolveRuntimeSceneFrame(bundle, hidden).nodes.some((node) =>
        String(node.id).includes("actor-instance"),
      ),
    ).toBe(false);
  });
});
