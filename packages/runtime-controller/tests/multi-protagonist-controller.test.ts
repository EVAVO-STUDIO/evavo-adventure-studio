import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { createMultiProtagonistPackagedRuntimeController } from "../src/multi-protagonist-controller.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;
const hash = "0".repeat(64);

const imageAsset = (assetId: string, runtimePath: string) => ({
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

const actorAsset = (suffix: string) => ({
  assetId: `asset.actor.${suffix}`,
  kind: "spritesheet",
  outputFiles: [
    {
      role: "atlas-manifest",
      runtimePath: `assets/${suffix}/atlas.json`,
      mediaType: "application/json",
      sha256: hash,
      byteLength: 1,
    },
    {
      role: "page-000",
      runtimePath: `assets/${suffix}/page.png`,
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
        frameId: `frame.${suffix}.idle`,
        pageOutputRole: "page-000",
        sourceRect: { x: 0, y: 0, width: 12, height: 20 },
        originalSize: { width: 18, height: 24 },
        trimOffset: { x: 3, y: 4 },
        padding: 1,
      },
      {
        frameId: `frame.${suffix}.walk`,
        pageOutputRole: "page-000",
        sourceRect: { x: 12, y: 0, width: 12, height: 20 },
        originalSize: { width: 18, height: 24 },
        trimOffset: { x: 3, y: 4 },
        padding: 1,
      },
    ],
  },
});

const actor = (suffix: string) => ({
  id: `actor.${suffix}`,
  name: suffix,
  frames: [
    {
      id: `frame.${suffix}.idle`,
      assetId: `asset.actor.${suffix}`,
      sourceRect: { x: 0, y: 0, width: 12, height: 20 },
      sourceSize: { width: 18, height: 24 },
      trimOffset: { x: 3, y: 4 },
      pivot: { x: 9, y: 23 },
      footPoint: { x: 9, y: 23 },
      durationTicks: 4,
      mirrorEligible: true,
    },
    {
      id: `frame.${suffix}.walk`,
      assetId: `asset.actor.${suffix}`,
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
      id: `animation.${suffix}.idle-east`,
      state: "idle",
      facing: "east",
      frameIds: [`frame.${suffix}.idle`],
      loop: true,
      interruptible: true,
    },
    {
      id: `animation.${suffix}.walk-east`,
      state: "walk",
      facing: "east",
      frameIds: [`frame.${suffix}.walk`],
      loop: true,
      interruptible: true,
    },
  ],
});

const scene = (suffix: string, actorX: number) => ({
  id: `scene.${suffix}`,
  name: suffix,
  width: 320,
  height: 200,
  backgroundAssetId: `asset.scene.${suffix}`,
  navigationAreas: [
    {
      id: `navigation.${suffix}`,
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
    { id: `entrance.${suffix}`, position: { x: actorX, y: 140 }, facing: "east" },
  ],
  fallbackText: "Nothing happens.",
});

const bundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.multi-session",
  title: "Cross State",
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
  startSceneId: "scene.a",
  startEntranceId: "entrance.a",
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [
    imageAsset("asset.scene.a", "assets/a.png"),
    imageAsset("asset.scene.b", "assets/b.png"),
    actorAsset("a"),
    actorAsset("b"),
  ],
  inventoryItems: [
    { id: "item.plan", name: "Plan", description: "A folded plan." },
    { id: "item.badge", name: "Badge", description: "An old badge." },
  ],
  actors: [actor("a"), actor("b")],
  scenes: [scene("a", 60), scene("b", 220)],
  dialogues: [],
  sequences: [],
  sceneInstances: {
    manifestVersion: 1,
    projectId: "project.multi-session",
    objectDefinitions: [],
    scenes: [
      {
        sceneId: "scene.a",
        actorInstances: [
          {
            id: "actor-instance.a",
            actorId: "actor.a",
            position: { x: 60, y: 140 },
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
      {
        sceneId: "scene.b",
        actorInstances: [
          {
            id: "actor-instance.b",
            actorId: "actor.b",
            position: { x: 220, y: 140 },
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
  multiProtagonist: {
    manifestVersion: 1,
    projectId: "project.multi-session",
    activeProtagonistId: "actor.a",
    protagonists: [
      {
        protagonistId: "actor.a",
        startSceneId: "scene.a",
        startEntranceId: "entrance.a",
        startingInventory: ["item.plan"],
      },
      {
        protagonistId: "actor.b",
        startSceneId: "scene.b",
        startEntranceId: "entrance.b",
        startingInventory: ["item.badge"],
      },
    ],
  },
} as unknown as RuntimeBundle;

describe("multi-protagonist packaged session", () => {
  it("switches controlled actors while preserving global time and local inventories", () => {
    const controller = createMultiProtagonistPackagedRuntimeController(bundle);
    expect(controller.activeProtagonistId()).toBe("actor.a");
    expect(controller.controlledActorInstanceId()).toBe("actor-instance.a");
    expect(controller.worldState().story.currentSceneId).toBe("scene.a");
    expect(controller.worldState().story.inventory).toEqual(["item.plan"]);

    controller.createFrame(12);
    controller.switchProtagonist(id<"actor">("actor.b"));
    expect(controller.activeProtagonistId()).toBe("actor.b");
    expect(controller.controlledActorInstanceId()).toBe("actor-instance.b");
    expect(controller.worldState().story.currentSceneId).toBe("scene.b");
    expect(controller.worldState().story.inventory).toEqual(["item.badge"]);
    expect(controller.worldState().story.tick).toBe(12);

    controller.createFrame(18);
    controller.switchProtagonist(id<"actor">("actor.a"));
    expect(controller.worldState().story.currentSceneId).toBe("scene.a");
    expect(controller.worldState().story.inventory).toEqual(["item.plan"]);
    expect(controller.worldState().story.tick).toBe(18);
  });

  it("round-trips the active protagonist and all local state through save/restore", () => {
    const controller = createMultiProtagonistPackagedRuntimeController(bundle);
    controller.createFrame(5);
    controller.switchProtagonist(id<"actor">("actor.b"));
    const save = controller.createSaveGame();
    expect(save.multiProtagonist?.activeProtagonistId).toBe("actor.b");
    expect(save.multiProtagonist?.protagonists["actor.a"]?.inventory).toEqual(["item.plan"]);
    expect(save.multiProtagonist?.protagonists["actor.b"]?.inventory).toEqual(["item.badge"]);

    controller.switchProtagonist(id<"actor">("actor.a"));
    controller.restoreSaveGame(save);
    expect(controller.activeProtagonistId()).toBe("actor.b");
    expect(controller.controlledActorInstanceId()).toBe("actor-instance.b");
    expect(controller.worldState().story.currentSceneId).toBe("scene.b");
    expect(controller.worldState().story.inventory).toEqual(["item.badge"]);
  });
});
