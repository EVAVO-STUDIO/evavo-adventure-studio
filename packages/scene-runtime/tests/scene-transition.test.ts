import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { createInitialRuntimeWorldState } from "../src/index.js";
import {
  RuntimeActorSceneTransitionError,
  reconcileRuntimeActorWithStoryLocation,
  relocateRuntimeActorToEntrance,
} from "../src/scene-transition.js";

const hash = "0".repeat(64);

const bundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.scene-transition",
  title: "Scene Transition",
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
  startSceneId: "scene.archive",
  startEntranceId: "entrance.archive.start",
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [],
  inventoryItems: [],
  actors: [
    {
      id: "actor.archivist",
      name: "Archivist",
      frames: [
        {
          id: "frame.idle-east",
          assetId: "asset.archivist",
          sourceRect: { x: 0, y: 0, width: 16, height: 24 },
          sourceSize: { width: 16, height: 24 },
          trimOffset: { x: 0, y: 0 },
          pivot: { x: 8, y: 23 },
          footPoint: { x: 8, y: 23 },
          durationTicks: 5,
          mirrorEligible: true,
        },
        {
          id: "frame.idle-west",
          assetId: "asset.archivist",
          sourceRect: { x: 16, y: 0, width: 16, height: 24 },
          sourceSize: { width: 16, height: 24 },
          trimOffset: { x: 0, y: 0 },
          pivot: { x: 8, y: 23 },
          footPoint: { x: 8, y: 23 },
          durationTicks: 5,
          mirrorEligible: true,
        },
      ],
      animations: [
        {
          id: "animation.idle-east",
          state: "idle",
          facing: "east",
          frameIds: ["frame.idle-east"],
          loop: true,
          interruptible: true,
        },
        {
          id: "animation.idle-west",
          state: "idle",
          facing: "west",
          frameIds: ["frame.idle-west"],
          loop: true,
          interruptible: true,
        },
      ],
    },
  ],
  scenes: [
    {
      id: "scene.archive",
      name: "Archive",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.archive",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.archive.start",
          position: { x: 40, y: 150 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
    {
      id: "scene.chapel",
      name: "Chapel",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.chapel",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.chapel.archive-door",
          position: { x: 272, y: 148 },
          facing: "west",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  dialogues: [],
  sequences: [],
  sceneInstances: {
    manifestVersion: 1,
    projectId: "project.scene-transition",
    objectDefinitions: [],
    scenes: [
      {
        sceneId: "scene.archive",
        actorInstances: [
          {
            id: "actor-instance.archivist" as Id<"actor-instance">,
            actorId: "actor.archivist",
            position: { x: 40, y: 150 },
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
        sceneId: "scene.chapel",
        actorInstances: [],
        objectInstances: [],
        navigationPortals: [],
      },
    ],
  },
} as unknown as RuntimeBundle;

describe("runtime actor scene transitions", () => {
  it("moves a persistent actor to the destination entrance and arrival pose", () => {
    const initial = createInitialRuntimeWorldState(bundle);
    const relocated = relocateRuntimeActorToEntrance(
      bundle,
      initial,
      "actor-instance.archivist" as Id<"actor-instance">,
      "scene.chapel" as Id<"scene">,
      "entrance.chapel.archive-door" as Id<"entrance">,
    );

    expect(relocated.actorInstances["actor-instance.archivist"]).toMatchObject({
      sceneId: "scene.chapel",
      position: { x: 272, y: 148 },
      facing: "west",
      animationState: "idle",
      playback: { clipId: "animation.idle-west", frameIndex: 0 },
    });
    expect(initial.actorInstances["actor-instance.archivist"]?.sceneId).toBe("scene.archive");
  });

  it("repairs an older world whose actor scene disagrees with story state", () => {
    const initial = createInitialRuntimeWorldState(bundle);
    const legacyWorld = {
      ...initial,
      story: {
        ...initial.story,
        currentSceneId: "scene.chapel",
        currentEntranceId: "entrance.chapel.archive-door",
      },
    } as typeof initial;

    const reconciled = reconcileRuntimeActorWithStoryLocation(
      bundle,
      legacyWorld,
      "actor-instance.archivist" as Id<"actor-instance">,
    );
    expect(reconciled.actorInstances["actor-instance.archivist"]?.sceneId).toBe("scene.chapel");
    expect(reconciled.actorInstances["actor-instance.archivist"]?.position).toEqual({ x: 272, y: 148 });
  });

  it("fails with a typed diagnostic when an entrance is invalid", () => {
    const initial = createInitialRuntimeWorldState(bundle);
    expect(() =>
      relocateRuntimeActorToEntrance(
        bundle,
        initial,
        "actor-instance.archivist" as Id<"actor-instance">,
        "scene.chapel" as Id<"scene">,
        "entrance.chapel.missing" as Id<"entrance">,
      ),
    ).toThrow(RuntimeActorSceneTransitionError);
  });
});
