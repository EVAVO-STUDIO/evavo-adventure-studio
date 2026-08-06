import { describe, expect, it } from "vitest";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  createSaveGame,
  loadSaveGame,
  type SaveGame,
} from "@evavo/adventure-save-game";
import {
  beginActorMovement,
} from "@evavo/adventure-scene-runtime/movement";
import {
  advanceInteractiveRuntimeWorld,
  createInitialInteractiveRuntimeWorldState,
  type InteractiveRuntimeWorldState,
} from "@evavo/adventure-scene-runtime/commands";
import {
  createReplayLog,
  executeReplay,
  parseReplayLog,
  serializeReplayLog,
  type ReplayRuntimeAdapter,
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
  projectId: "project.profiled-replay",
  title: "Profiled Replay",
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
  playFeelProfileId: "pulp-grounded",
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
    projectId: "project.profiled-replay",
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

const startedWorld = (): InteractiveRuntimeWorldState => {
  const initial = createInitialInteractiveRuntimeWorldState(bundle);
  const started = beginActorMovement(
    bundle,
    initial,
    actorInstanceId,
    { x: 270, y: 160 },
  );
  if (started.kind !== "started") throw new Error("Expected movement start.");
  return advanceInteractiveRuntimeWorld(
    bundle,
    started.state as InteractiveRuntimeWorldState,
    23,
  ).state;
};

class ProfiledReplayRuntime implements ReplayRuntimeAdapter {
  private world = createInitialInteractiveRuntimeWorldState(bundle);

  restoreSaveGame(input: unknown): number {
    const save = loadSaveGame(bundle, input);
    this.world = save.world as InteractiveRuntimeWorldState;
    return this.world.story.tick;
  }

  createFrame(tick: number): unknown {
    const delta = tick - this.world.story.tick;
    if (!Number.isSafeInteger(delta) || delta < 0) {
      throw new RangeError("Replay time cannot move backwards.");
    }
    this.world = advanceInteractiveRuntimeWorld(bundle, this.world, delta).state;
    return { tick };
  }

  activate(): void {
    throw new Error("This replay fixture has no activation events.");
  }

  handleKey(): boolean {
    return false;
  }

  createSaveGame(): SaveGame {
    return createSaveGame(bundle, this.world, interfaceState);
  }
}

describe("profiled movement replay convergence", () => {
  it("preserves an in-flight movement and reaches the expected final fingerprint", () => {
    const initialWorld = startedWorld();
    const initialSave = createSaveGame(bundle, initialWorld, interfaceState);
    const additionalTicks = 91;
    const finalWorld = advanceInteractiveRuntimeWorld(
      bundle,
      initialWorld,
      additionalTicks,
    ).state;
    const expectedFinalSave = createSaveGame(
      bundle,
      finalWorld,
      interfaceState,
    );
    const replay = createReplayLog(bundle, initialSave, {
      events: [],
      finalTick: initialSave.world.story.tick + additionalTicks,
      expectedFinalSaveFingerprint: expectedFinalSave.saveFingerprint,
    });
    const parsed = parseReplayLog(
      JSON.parse(serializeReplayLog(replay)) as unknown,
    );

    expect(
      parsed.initialSave.world.movements[actorInstanceId]?.profiled,
    ).toEqual(initialSave.world.movements[actorInstanceId]?.profiled);

    const result = executeReplay(
      bundle,
      parsed,
      new ProfiledReplayRuntime(),
    );

    expect(result.finalSaveFingerprint).toBe(
      expectedFinalSave.saveFingerprint,
    );
    expect(result.finalTick).toBe(expectedFinalSave.world.story.tick);
    expect(result.eventCount).toBe(0);
  });
});
