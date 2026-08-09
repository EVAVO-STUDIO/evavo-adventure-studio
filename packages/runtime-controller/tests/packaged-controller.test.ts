import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { createPackagedRuntimeController } from "../src/packaged-controller.js";

const hash = "0".repeat(64);

const imageAsset = (assetId: string, path: string, width: number, height: number) => ({
  assetId,
  kind: "image",
  outputFiles: [
    {
      role: "primary",
      runtimePath: path,
      mediaType: "image/png",
      sha256: hash,
      byteLength: 1,
    },
  ],
  metadata: {
    kind: "image",
    width,
    height,
    palette: true,
    colourCount: 16,
  },
});

const actorFrame = (id: string, x: number) => ({
  id,
  assetId: "asset.detective",
  sourceRect: { x, y: 0, width: 12, height: 20 },
  sourceSize: { width: 18, height: 24 },
  trimOffset: { x: 3, y: 4 },
  pivot: { x: 9, y: 23 },
  footPoint: { x: 9, y: 23 },
  durationTicks: 4,
  mirrorEligible: true,
});

const bundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.player-controller",
  title: "Player Controller",
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
  assetCompilerVersion: "test",
  assets: [
    imageAsset("asset.office", "assets/office.png", 320, 200),
    imageAsset("asset.cabinet", "assets/cabinet.png", 20, 20),
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
            frameId: "frame.walk",
            pageOutputRole: "page-000",
            sourceRect: { x: 12, y: 0, width: 12, height: 20 },
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
      frames: [actorFrame("frame.idle", 0), actorFrame("frame.walk", 12)],
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
          frameIds: ["frame.walk"],
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
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.office",
          position: { x: 80, y: 120 },
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
    projectId: "project.player-controller",
    objectDefinitions: [
      {
        id: "object-definition.cabinet",
        name: "Cabinet",
        initialStateId: "object-state.cabinet.closed",
        states: [
          {
            id: "object-state.cabinet.closed",
            visible: true,
            visual: {
              kind: "image",
              assetId: "asset.cabinet",
              pivot: { x: 10, y: 10 },
              opacity: 1,
            },
            interactionShape: {
              points: [
                { x: -10, y: -10 },
                { x: 10, y: -10 },
                { x: 10, y: 10 },
                { x: -10, y: 10 },
              ],
            },
            walkToOffset: { x: 0, y: 20 },
            cursor: "use",
            interactions: [
              {
                id: "interaction.cabinet.open",
                verb: "use",
                actions: [
                  {
                    kind: "set-object-state",
                    objectId: "object.office.cabinet",
                    state: "object-state.cabinet.open",
                  },
                ],
              },
            ],
          },
          {
            id: "object-state.cabinet.open",
            visible: true,
            visual: {
              kind: "image",
              assetId: "asset.cabinet",
              pivot: { x: 10, y: 10 },
              opacity: 1,
            },
            interactionShape: {
              points: [
                { x: -10, y: -10 },
                { x: 10, y: -10 },
                { x: 10, y: 10 },
                { x: -10, y: 10 },
              ],
            },
            cursor: "look",
            interactions: [
              {
                id: "interaction.cabinet.look",
                verb: "look",
                actions: [{ kind: "say", text: "The cabinet is empty." }],
              },
            ],
          },
        ],
      },
    ],
    scenes: [
      {
        sceneId: "scene.office",
        actorInstances: [
          {
            id: "actor-instance.detective",
            actorId: "actor.detective",
            position: { x: 80, y: 120 },
            facing: "east",
            animationState: "idle",
            mobility: "walkable",
            elevation: 0,
            zOffset: 0,
            scaleMultiplier: 1,
          },
        ],
        objectInstances: [
          {
            id: "object.office.cabinet",
            definitionId: "object-definition.cabinet",
            position: { x: 100, y: 100 },
            layer: "world",
            elevation: 0,
            zOffset: 0,
            scaleMultiplier: 1,
            mirrored: false,
          },
        ],
        navigationPortals: [],
      },
    ],
  },
} as unknown as RuntimeBundle;

describe("packaged runtime controller", () => {
  it("walks to an object, executes its context verb and updates feedback", () => {
    const statuses: string[] = [];
    const controller = createPackagedRuntimeController(bundle, {
      onStatusChange: (status) => statuses.push(status),
    });

    controller.setPointer({ x: 100, y: 100 });
    const hoverFrame = controller.createFrame(0);
    expect(hoverFrame.nodes.some((node) => String(node.id).startsWith("cursor.action"))).toBe(true);

    controller.activate({ x: 100, y: 100 });
    expect(controller.statusText()).toBe("USE AFTER APPROACH");
    expect(controller.worldState().pendingObjectCommands["actor-instance.detective"]).toBeDefined();

    controller.createFrame(25);
    expect(controller.worldState().story.objectStates["object.office.cabinet"]).toBe(
      "object-state.cabinet.open",
    );
    expect(controller.statusText()).toBe("USE COMPLETE");
    expect(statuses).toEqual(expect.arrayContaining(["USE AFTER APPROACH", "USE COMPLETE"]));
  });

  it("uses the new state cursor and surfaces speech feedback immediately", () => {
    const controller = createPackagedRuntimeController(bundle);
    controller.setPointer({ x: 100, y: 100 });
    controller.activate({ x: 100, y: 100 });
    controller.createFrame(25);

    controller.setPointer({ x: 100, y: 100 });
    controller.activate({ x: 100, y: 100 });
    expect(controller.statusText()).toBe("The cabinet is empty.");
  });

  it("starts ordinary walk movement when clicking empty floor", () => {
    const controller = createPackagedRuntimeController(bundle);
    controller.activate({ x: 120, y: 120 });

    expect(controller.statusText()).toBe("WALKING");
    controller.createFrame(50);
    expect(controller.worldState().actorInstances["actor-instance.detective"]?.position).toEqual({
      x: 120,
      y: 120,
    });
  });

  it("rejects invalid explicit actor selection before playback", () => {
    expect(() =>
      createPackagedRuntimeController(bundle, {
        requestedActorInstanceId: "actor-instance.missing",
      }),
    ).toThrow(/not placed/);
  });
});
