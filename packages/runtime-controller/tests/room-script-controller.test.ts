import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { createRoomScriptPackagedRuntimeController } from "../src/room-script-controller.js";

const hash = "0".repeat(64);
const image = (assetId: string, runtimePath: string) => ({
  assetId,
  kind: "image",
  outputFiles: [
    {
      role: "primary",
      runtimePath,
      mediaType: "image/png",
      sha256: hash,
      byteLength: 1,
    },
  ],
  metadata: { kind: "image", width: 320, height: 200, palette: true, colourCount: 16 },
});

const bundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.room-script-controller",
  title: "Room Script Controller",
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
  assets: [image("asset.room", "assets/room.png"), image("asset.cutaway", "assets/cutaway.png")],
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
      id: "scene.cutaway",
      name: "Cutaway",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.cutaway",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [{ id: "entrance.cutaway", position: { x: 20, y: 170 }, facing: "east" }],
      fallbackText: "Nothing happens.",
    },
  ],
  dialogues: [],
  sequences: [
    {
      id: "sequence.gag",
      name: "Gag",
      mode: "cutscene",
      durationTicks: 2,
      loop: false,
      blocking: true,
      savePolicy: "boundary-only",
      skip: { allowed: true, safeAfterTick: 0, completionActions: [] },
      tracks: [],
      cueCount: 0,
    },
  ],
  roomScripts: {
    manifestVersion: 1,
    projectId: "project.room-script-controller",
    scripts: [
      {
        id: "room-script.room.first",
        sceneId: "scene.room",
        trigger: { kind: "scene-first-enter" },
        once: true,
        actions: [{ kind: "set-flag", flag: "introSeen", value: true }],
        cutaway: {
          sceneId: "scene.cutaway",
          entranceId: "entrance.cutaway",
          sequenceId: "sequence.gag",
          returnToPreviousLocation: true,
        },
      },
    ],
  },
} as unknown as RuntimeBundle;

describe("room-script packaged controller", () => {
  it("saves an active cutaway and deterministically returns after sequence completion", () => {
    const controller = createRoomScriptPackagedRuntimeController(bundle);
    controller.createFrame(0);
    expect(controller.worldState().story.currentSceneId).toBe("scene.cutaway");
    expect(controller.roomScriptState().activeCutaway?.returnSceneId).toBe("scene.room");
    expect(controller.worldState().story.flags.introSeen).toBe(true);

    const midCutaway = controller.createSaveGame();
    expect(midCutaway.roomScripts?.activeCutaway?.sequenceId).toBe("sequence.gag");

    controller.createFrame(2);
    expect(controller.worldState().story.currentSceneId).toBe("scene.room");
    expect(controller.roomScriptState().activeCutaway).toBeNull();
    expect(controller.drainRoomScriptEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "room-cutaway-started" }),
        expect.objectContaining({ kind: "room-cutaway-returned" }),
      ]),
    );

    controller.restoreSaveGame(midCutaway);
    expect(controller.worldState().story.currentSceneId).toBe("scene.cutaway");
    controller.createFrame(2);
    expect(controller.worldState().story.currentSceneId).toBe("scene.room");
    expect(controller.worldState().story.flags.introSeen).toBe(true);
  });
});
