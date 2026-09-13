import { createReplayLog } from "@evavo/adventure-replay";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { createPackagedRuntimeController } from "@evavo/adventure-runtime-controller";
import { describe, expect, it } from "vitest";
import { executeInspectedReplay } from "../src/replay-execution.js";

const hash = "0".repeat(64);
const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.replay-execution",
  title: "Replay Execution",
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
      frames: [
        {
          id: "frame.idle",
          assetId: "asset.detective",
          sourceRect: { x: 0, y: 0, width: 12, height: 20 },
          sourceSize: { width: 18, height: 24 },
          trimOffset: { x: 3, y: 4 },
          pivot: { x: 9, y: 23 },
          footPoint: { x: 9, y: 23 },
          durationTicks: 4,
          mirrorEligible: true,
        },
        {
          id: "frame.walk",
          assetId: "asset.detective",
          sourceRect: { x: 12, y: 0, width: 12, height: 20 },
          sourceSize: { width: 18, height: 24 },
          trimOffset: { x: 3, y: 4 },
          pivot: { x: 9, y: 23 },
          footPoint: { x: 9, y: 23 },
          durationTicks: 4,
          mirrorEligible: true,
        },
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
    projectId: "project.replay-execution",
    objectDefinitions: [],
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
        objectInstances: [],
        navigationPortals: [],
      },
    ],
  },
});

describe("renderer-free replay execution", () => {
  it("replays native activation through the shared controller", () => {
    const direct = createPackagedRuntimeController(bundle);
    const initial = direct.createSaveGame();
    direct.activate({ x: 120, y: 120 });
    direct.createFrame(50);
    const expectedFinal = direct.createSaveGame();
    const replay = createReplayLog(bundle, initial, {
      events: [
        {
          kind: "activate",
          tick: 0,
          sequence: 0,
          position: { x: 120, y: 120 },
        },
      ],
      finalTick: 50,
      expectedFinalSaveFingerprint: expectedFinal.saveFingerprint,
    });

    const execution = executeInspectedReplay(bundle, replay);

    expect(execution).toMatchObject({
      replayFingerprint: replay.replayFingerprint,
      eventCount: 1,
      initialTick: 0,
      finalTick: 50,
      finalSaveFingerprint: expectedFinal.saveFingerprint,
      checkpointMatched: true,
      finalSave: {
        tick: 50,
        controlledActorInstanceId: "actor-instance.detective",
        actors: [
          expect.objectContaining({
            instanceId: "actor-instance.detective",
            position: { x: 120, y: 120 },
            moving: false,
          }),
        ],
      },
    });
  });
});
