import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  createPackagedFeatureSessionController,
  describePackagedFeatureSession,
} from "../src/feature-session.js";

const hash = "0".repeat(64);

const bundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.specialized-session",
  title: "Specialized Session",
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
  startSceneId: "scene.room",
  startEntranceId: "entrance.room",
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [
    {
      assetId: "asset.room",
      kind: "image",
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/room.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image",
        width: 320,
        height: 200,
        palette: true,
        colourCount: 16,
      },
    },
  ],
  inventoryItems: [],
  actors: [],
  scenes: [
    {
      id: "scene.room",
      name: "Room",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.room",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [{ id: "entrance.room", position: { x: 20, y: 170 }, facing: "east" }],
      fallbackText: "Nothing happens.",
    },
    {
      id: "scene.mode",
      name: "Insert",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.room",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [{ id: "entrance.mode", position: { x: 0, y: 0 }, facing: "south" }],
      fallbackText: "No response.",
    },
  ],
  dialogues: [],
  sequences: [],
  specializedModes: {
    manifestVersion: 1,
    projectId: "project.specialized-session",
    modes: [
      {
        id: "specialized-mode.action-proof",
        kind: "action",
        once: true,
        sceneId: "scene.mode",
        entranceId: "entrance.mode",
        startStateId: "aim",
        return: { kind: "previous-location" },
        states: [
          {
            id: "aim",
            inputRegions: [
              {
                id: "hit",
                label: "Hit target",
                shape: {
                  points: [
                    { x: 0, y: 0 },
                    { x: 100, y: 0 },
                    { x: 100, y: 100 },
                    { x: 0, y: 100 },
                  ],
                },
                actions: [{ kind: "set-flag", flag: "action.won", value: true }],
                finishOutcomeId: "won",
              },
            ],
          },
        ],
      },
    ],
  },
} as unknown as RuntimeBundle;

describe("packaged specialized mode controller", () => {
  it("is automatically selected by the feature-session stack", () => {
    expect(describePackagedFeatureSession(bundle)).toMatchObject({
      specializedModes: true,
      stack: ["base", "specialized-modes"],
    });
    const controller = createPackagedFeatureSessionController(bundle);
    expect(controller.startSpecializedMode).toBeTypeOf("function");
  });

  it("saves and restores an active mode with its exact return checkpoint", () => {
    const controller = createPackagedFeatureSessionController(bundle);
    controller.startSpecializedMode?.("specialized-mode.action-proof");
    expect(controller.activeSpecializedModeId?.()).toBe("specialized-mode.action-proof");
    expect(controller.worldState().story.currentSceneId).toBe("scene.mode");

    const midMode = controller.createSaveGame();
    expect(midMode.specializedModes?.active).toMatchObject({
      modeId: "specialized-mode.action-proof",
      stateId: "aim",
      returnSceneId: "scene.room",
      returnEntranceId: "entrance.room",
    });

    controller.activate({ x: 50, y: 50 });
    expect(controller.activeSpecializedModeId?.()).toBeNull();
    expect(controller.worldState().story.currentSceneId).toBe("scene.room");
    expect(controller.worldState().story.flags["action.won"]).toBe(true);

    controller.restoreSaveGame(midMode);
    expect(controller.activeSpecializedModeId?.()).toBe("specialized-mode.action-proof");
    expect(controller.worldState().story.currentSceneId).toBe("scene.mode");
    controller.activate({ x: 50, y: 50 });
    expect(controller.worldState().story.currentSceneId).toBe("scene.room");
    expect(controller.worldState().story.flags["action.won"]).toBe(true);
  });
});
