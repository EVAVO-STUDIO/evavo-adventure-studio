import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import { describe, expect, it } from "vitest";
import {
  createSaveGame,
  loadSaveGame,
  serializeSaveGame,
  validateSaveGameCompatibility,
  type SaveGame,
  type SaveGameProfiledRuntimeCameraState,
} from "../src/index.js";

const hash = "0".repeat(64);

const bundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.camera-save",
  title: "Camera Save",
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
  assets: [],
  inventoryItems: [],
  actors: [],
  scenes: [
    {
      id: "scene.road",
      name: "Road",
      width: 640,
      height: 200,
      backgroundAssetId: "asset.road",
      navigationAreas: [],
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
    projectId: "project.camera-save",
    objectDefinitions: [],
    scenes: [],
  },
} as unknown as RuntimeBundle;

const world: InteractiveRuntimeWorldState = {
  story: {
    schemaVersion: 1,
    projectId: "project.camera-save" as never,
    tick: 12,
    currentSceneId: "scene.road" as never,
    currentEntranceId: "entrance.road" as never,
    flags: {},
    variables: {},
    inventory: [],
    awardedScoreIds: [],
    consumedInteractionIds: [],
    consumedDialogueChoiceIds: [],
    activeDialogue: null,
    activeSequences: [],
    objectStates: {},
    randomStreams: { main: 1 },
    score: 0,
  },
  actorInstances: {},
  movements: {},
  pendingObjectCommands: {},
};

const camera: SaveGameProfiledRuntimeCameraState = {
  stateVersion: 1,
  profileId: "pulp-grounded",
  sceneId: "scene.road" as never,
  camera: {
    stateVersion: 1,
    tick: 12,
    position: { x: 20, y: 0 },
    unquantizedPosition: { x: 20.25, y: 0 },
    velocityPixelsPerSecond: { x: 8, y: 0 },
    settledTicks: 0,
  },
  activeShot: null,
};

const interfaceState = {
  controlledActorInstanceId: null,
  selectedVerbId: null,
  selectedItemId: null,
  statusText: "READY",
  parser: { text: "", history: [] },
} as const;

describe("profiled camera save state", () => {
  it("round-trips strict camera state through the normal save API", () => {
    const save = createSaveGame(bundle, world, {
      ...interfaceState,
      profiledCamera: camera,
    });
    const loaded = loadSaveGame(
      bundle,
      JSON.parse(serializeSaveGame(save)) as unknown,
    );

    expect(loaded.interface.profiledCamera).toEqual(camera);
  });

  it("preserves the legacy interface shape when camera state is absent", () => {
    const save = createSaveGame(bundle, world, interfaceState);
    const parsed = JSON.parse(serializeSaveGame(save)) as {
      interface: Record<string, unknown>;
    };

    expect(parsed.interface).not.toHaveProperty("profiledCamera");
    expect(loadSaveGame(bundle, parsedSave(save))).toBeDefined();
  });

  it("reports camera tick and authored-shot drift before restoration", () => {
    const save = createSaveGame(bundle, world, {
      ...interfaceState,
      profiledCamera: camera,
    });
    const corrupted = {
      ...save,
      interface: {
        ...save.interface,
        profiledCamera: {
          ...camera,
          camera: { ...camera.camera, tick: 13 },
          activeShot: {
            sequenceId: "sequence.missing",
            trackId: "sequence-track.missing",
            cueIndex: 0,
            startedAtStoryTick: 15,
            durationTicks: 10,
            from: { x: 0, y: 0 },
            to: { x: 20, y: 0 },
            easing: "linear",
          },
        },
      },
    } as SaveGame;

    expect(validateSaveGameCompatibility(bundle, corrupted)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-profiled-camera",
          path: "interface.profiledCamera.camera.tick",
        }),
        expect.objectContaining({
          code: "invalid-profiled-camera",
          path: "interface.profiledCamera.activeShot.sequenceId",
        }),
        expect.objectContaining({
          code: "invalid-profiled-camera",
          path: "interface.profiledCamera.activeShot.startedAtStoryTick",
        }),
      ]),
    );
  });
});

const parsedSave = (save: SaveGame): unknown =>
  JSON.parse(serializeSaveGame(save)) as unknown;
