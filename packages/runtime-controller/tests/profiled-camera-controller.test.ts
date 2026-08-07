import {
  createReplayLog,
  executeReplay,
} from "@evavo/adventure-replay";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { createSaveGame } from "@evavo/adventure-save-game";
import { describe, expect, it } from "vitest";
import { createPackagedRuntimeController } from "../src/packaged-controller.js";

const hash = "0".repeat(64);
const actorInstanceId =
  "actor-instance.traveller" as Id<"actor-instance">;

const actorFrame = (id: string, x: number) => ({
  id,
  assetId: "asset.traveller",
  sourceRect: { x, y: 0, width: 14, height: 28 },
  sourceSize: { width: 18, height: 32 },
  trimOffset: { x: 2, y: 4 },
  pivot: { x: 9, y: 31 },
  footPoint: { x: 9, y: 31 },
  durationTicks: 2,
  mirrorEligible: true,
});

const bundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.profiled-camera-controller",
  title: "Profiled Camera Controller",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "camera-strict",
    showScore: false,
    allowHotspotAssist: false,
  },
  playFeelProfileId: "pulp-grounded",
  startSceneId: "scene.road",
  startEntranceId: "entrance.road",
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [
    {
      assetId: "asset.road",
      kind: "image",
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/road.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image",
        width: 640,
        height: 200,
        palette: true,
        colourCount: 64,
      },
    },
    {
      assetId: "asset.traveller",
      kind: "spritesheet",
      outputFiles: [
        {
          role: "atlas-manifest",
          runtimePath: "assets/traveller/atlas.json",
          mediaType: "application/json",
          sha256: hash,
          byteLength: 1,
        },
        {
          role: "page-000",
          runtimePath: "assets/traveller/page.png",
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
            sourceRect: { x: 0, y: 0, width: 14, height: 28 },
            originalSize: { width: 18, height: 32 },
            trimOffset: { x: 2, y: 4 },
            padding: 1,
          },
          {
            frameId: "frame.walk-a",
            pageOutputRole: "page-000",
            sourceRect: { x: 14, y: 0, width: 14, height: 28 },
            originalSize: { width: 18, height: 32 },
            trimOffset: { x: 2, y: 4 },
            padding: 1,
          },
          {
            frameId: "frame.walk-b",
            pageOutputRole: "page-000",
            sourceRect: { x: 28, y: 0, width: 14, height: 28 },
            originalSize: { width: 18, height: 32 },
            trimOffset: { x: 2, y: 4 },
            padding: 1,
          },
        ],
      },
    },
    {
      assetId: "asset.console",
      kind: "image",
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/console.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image",
        width: 20,
        height: 20,
        palette: true,
        colourCount: 8,
      },
    },
  ],
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
      name: "Long Road",
      width: 640,
      height: 200,
      backgroundAssetId: "asset.road",
      navigationAreas: [
        {
          id: "navigation.road",
          shape: {
            points: [
              { x: 0, y: 120 },
              { x: 640, y: 120 },
              { x: 640, y: 200 },
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
          id: "entrance.road",
          position: { x: 80, y: 160 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  dialogues: [],
  sequences: [
    {
      id: "sequence.camera-snap",
      name: "Camera Snap",
      mode: "cutscene",
      durationTicks: 30,
      loop: false,
      blocking: false,
      savePolicy: "allowed",
      skip: {
        allowed: true,
        safeAfterTick: 0,
        completionActions: [],
      },
      tracks: [
        {
          id: "sequence-track.camera",
          kind: "camera",
          cues: [
            {
              kind: "camera-shot",
              atTick: 0,
              durationTicks: 0,
              position: { x: 200, y: 0 },
              easing: "step",
            },
          ],
        },
      ],
      cueCount: 1,
    },
  ],
  sceneInstances: {
    manifestVersion: 1,
    projectId: "project.profiled-camera-controller",
    objectDefinitions: [
      {
        id: "object-definition.console",
        name: "Camera Console",
        initialStateId: "object-state.console.ready",
        states: [
          {
            id: "object-state.console.ready",
            visual: {
              kind: "image",
              assetId: "asset.console",
              pivot: { x: 10, y: 10 },
              opacity: 1,
            },
            visible: true,
            interactionShape: {
              points: [
                { x: -10, y: -10 },
                { x: 10, y: -10 },
                { x: 10, y: 10 },
                { x: -10, y: 10 },
              ],
            },
            cursor: "use",
            interactions: [
              {
                id: "interaction.console.use",
                verb: "use",
                actions: [
                  {
                    kind: "play-sequence",
                    sequenceId: "sequence.camera-snap",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    scenes: [
      {
        sceneId: "scene.road",
        actorInstances: [
          {
            id: actorInstanceId,
            actorId: "actor.traveller",
            position: { x: 80, y: 160 },
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
            id: "object.road.console",
            definitionId: "object-definition.console",
            position: { x: 120, y: 150 },
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

const interfaceState = {
  controlledActorInstanceId: actorInstanceId,
  selectedVerbId: null,
  selectedItemId: null,
  statusText: "WALKING",
  parser: { text: "", history: [] },
} as const;

describe("profiled camera in the packaged runtime controller", () => {
  it("applies tick-zero sequence shots and restores the exact directed frame", () => {
    const controller = createPackagedRuntimeController(bundle);
    controller.activate({ x: 120, y: 150 });

    expect(controller.cameraState()?.activeShot).toMatchObject({
      sequenceId: "sequence.camera-snap",
      durationTicks: 0,
      to: { x: 200, y: 0 },
    });
    expect(controller.createFrame(0).camera.position).toEqual({ x: 200, y: 0 });

    const save = controller.createSaveGame();
    expect(save.interface.profiledCamera).toEqual(controller.cameraState());

    const restored = createPackagedRuntimeController(bundle);
    restored.restoreSaveGame(save);
    expect(restored.createFrame(0).camera).toEqual(
      controller.createFrame(0).camera,
    );
    expect(restored.cameraState()).toEqual(controller.cameraState());
  });

  it("follows profiled movement and converts screen input through the camera", () => {
    const controller = createPackagedRuntimeController(bundle);
    controller.activate({ x: 300, y: 160 });
    const followedFrame = controller.createFrame(360);

    expect(followedFrame.camera.position.x).toBeGreaterThan(0);
    expect(controller.cameraState()?.camera.tick).toBe(360);

    const cameraX = followedFrame.camera.position.x;
    controller.activate({ x: 250, y: 160 });
    const movement = controller.worldState().movements[actorInstanceId];
    expect(movement?.route.points.at(-1)).toEqual({
      x: cameraX + 250,
      y: 160,
    });
  });

  it("loads a legacy save without camera state by recreating canonical framing", () => {
    const source = createPackagedRuntimeController(bundle);
    source.activate({ x: 300, y: 160 });
    source.createFrame(120);
    const legacySave = createSaveGame(
      bundle,
      source.worldState(),
      interfaceState,
    );

    expect(legacySave.interface.profiledCamera).toBeUndefined();

    const restored = createPackagedRuntimeController(bundle);
    restored.restoreSaveGame(legacySave);
    const frame = restored.createFrame(legacySave.world.story.tick);
    expect(restored.cameraState()).not.toBeNull();
    expect(frame.camera.position).toEqual(restored.cameraState()?.camera.position);
    expect(restored.createSaveGame().interface.profiledCamera).toBeUndefined();
  });

  it("keeps legacy replay fingerprints stable after canonical camera recreation", () => {
    const source = createPackagedRuntimeController(bundle);
    source.activate({ x: 300, y: 160 });
    source.createFrame(90);
    const legacyInitialSave = createSaveGame(
      bundle,
      source.worldState(),
      interfaceState,
    );

    const direct = createPackagedRuntimeController(bundle);
    direct.restoreSaveGame(legacyInitialSave);
    direct.createFrame(240);
    const expectedLegacySave = direct.createSaveGame();
    expect(expectedLegacySave.interface.profiledCamera).toBeUndefined();

    const replay = createReplayLog(bundle, legacyInitialSave, {
      events: [],
      finalTick: 240,
      expectedFinalSaveFingerprint: expectedLegacySave.saveFingerprint,
    });
    const replayController = createPackagedRuntimeController(bundle);
    const result = executeReplay(bundle, replay, replayController);

    expect(result.finalSaveFingerprint).toBe(
      expectedLegacySave.saveFingerprint,
    );
    expect(result.finalSave.interface.profiledCamera).toBeUndefined();
  });

  it("preserves camera state and final save identity through replay", () => {
    const direct = createPackagedRuntimeController(bundle);
    direct.activate({ x: 300, y: 160 });
    direct.createFrame(90);
    const initialSave = direct.createSaveGame();
    direct.createFrame(240);
    const expectedSave = direct.createSaveGame();

    const replay = createReplayLog(bundle, initialSave, {
      events: [],
      finalTick: 240,
      expectedFinalSaveFingerprint: expectedSave.saveFingerprint,
    });
    const replayController = createPackagedRuntimeController(bundle);
    const result = executeReplay(bundle, replay, replayController);

    expect(result.finalSaveFingerprint).toBe(expectedSave.saveFingerprint);
    expect(result.finalSave.interface.profiledCamera).toEqual(
      expectedSave.interface.profiledCamera,
    );
  });
});
