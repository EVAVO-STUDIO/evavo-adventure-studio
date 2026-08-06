import { describe, expect, it } from "vitest";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  beginActorMovement,
} from "@evavo/adventure-scene-runtime/movement";
import {
  advanceInteractiveRuntimeWorld,
  createInitialInteractiveRuntimeWorldState,
  type InteractiveRuntimeWorldState,
} from "@evavo/adventure-scene-runtime/commands";
import {
  createSaveGame,
  loadSaveGame,
  serializeSaveGame,
  validateSaveGameCompatibility,
  type SaveGame,
} from "../src/index.js";

const actorInstanceId =
  "actor-instance.traveller" as Id<"actor-instance">;

const actorFrame = (frameId: string, x: number) => ({
  id: frameId,
  assetId: "asset.traveller",
  sourceRect: { x, y: 0, width: 14, height: 28 },
  sourceSize: { width: 18, height: 32 },
  trimOffset: { x: 2, y: 4 },
  pivot: { x: 9, y: 31 },
  footPoint: { x: 9, y: 31 },
  durationTicks: 3,
  mirrorEligible: true,
});

const bundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.profiled-save",
  title: "Profiled Save",
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
  playFeelProfileId: "gothic-measured",
  startSceneId: "scene.road",
  startEntranceId: "entrance.road",
  assetManifestFingerprint: "0".repeat(64),
  assetCompilerVersion: "test",
  assets: [],
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
      name: "Road",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.road",
      navigationAreas: [
        {
          id: "navigation.road",
          shape: {
            points: [
              { x: 0, y: 130 },
              { x: 300, y: 130 },
              { x: 300, y: 190 },
              { x: 0, y: 190 },
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
    projectId: "project.profiled-save",
    objectDefinitions: [],
    scenes: [
      {
        sceneId: "scene.road",
        actorInstances: [
          {
            id: actorInstanceId,
            actorId: "actor.traveller",
            position: { x: 20, y: 160 },
            facing: "east",
            animationState: "idle",
            mobility: "walkable",
          },
        ],
        objectInstances: [],
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

const movingWorld = (
  playFeelProfileId: "gothic-measured" | null = "gothic-measured",
): InteractiveRuntimeWorldState => {
  const initial = createInitialInteractiveRuntimeWorldState(bundle);
  const started = beginActorMovement(
    bundle,
    initial,
    actorInstanceId,
    { x: 260, y: 160 },
    { playFeelProfileId },
  );
  if (started.kind !== "started") throw new Error("Expected movement start.");
  return advanceInteractiveRuntimeWorld(
    bundle,
    started.state as InteractiveRuntimeWorldState,
    37,
  ).state;
};

describe("profiled movement save compatibility", () => {
  it("round-trips deterministic motion state through the normal save API", () => {
    const world = movingWorld();
    const save = createSaveGame(bundle, world, interfaceState);
    const loaded = loadSaveGame(
      bundle,
      JSON.parse(serializeSaveGame(save)) as unknown,
    );
    const movement = loaded.world.movements[actorInstanceId];

    expect(movement?.profiled).toEqual(
      world.movements[actorInstanceId]?.profiled,
    );
    expect(movement?.profiled?.profileId).toBe("gothic-measured");
    expect(loaded.world.actorInstances[actorInstanceId]?.position).toEqual(
      movement?.profiled?.extension.motion.position,
    );
  });

  it("preserves the exact legacy movement shape when no profile is active", () => {
    const world = movingWorld(null);
    const save = createSaveGame(bundle, world, interfaceState);
    const parsed = JSON.parse(serializeSaveGame(save)) as {
      world: { movements: Record<string, Record<string, unknown>> };
    };
    const movement = parsed.world.movements[actorInstanceId];

    expect(movement).toBeDefined();
    expect(movement).not.toHaveProperty("profiled");
    expect(Object.keys(movement ?? {}).sort()).toEqual([
      "actorInstanceId",
      "arrivalAnimationState",
      "distanceAlongSegment",
      "nextSegmentIndex",
      "route",
      "speedPixelsPerSecond",
      "walkAnimationState",
    ]);
  });

  it("reports deterministic state drift before a saved mover is restored", () => {
    const save = createSaveGame(bundle, movingWorld(), interfaceState);
    const movement = save.world.movements[actorInstanceId];
    if (!movement?.profiled) throw new Error("Expected profiled movement.");
    const incompatible = {
      ...save,
      world: {
        ...save.world,
        movements: {
          ...save.world.movements,
          [actorInstanceId]: {
            ...movement,
            profiled: {
              ...movement.profiled,
              completedSegmentCount:
                movement.profiled.completedSegmentCount + 1,
            },
          },
        },
      },
    } as SaveGame;

    expect(validateSaveGameCompatibility(bundle, incompatible)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-profiled-movement",
          path: expect.stringContaining("completedSegmentCount"),
        }),
      ]),
    );
  });
});
