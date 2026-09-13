import { startAnimation } from "@evavo/adventure-animation";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  advanceEntryChoreography,
  beginEntryChoreography,
} from "../src/entry.js";
import type { RuntimeWorldState } from "../src/index.js";

const asId = <T extends string>(value: string): string & { readonly __id: T } => value as never;

const actor = {
  id: asId<"actor">("actor.detective"),
  name: "Detective",
  frames: [
    {
      id: asId<"sprite-frame">("frame.walk"),
      assetId: asId<"asset">("asset.detective"),
      sourceRect: { x: 0, y: 0, width: 16, height: 32 },
      sourceSize: { width: 16, height: 32 },
      trimOffset: { x: 0, y: 0 },
      pivot: { x: 8, y: 32 },
      footPoint: { x: 8, y: 32 },
      durationTicks: 4,
      mirrorEligible: true,
    },
    {
      id: asId<"sprite-frame">("frame.idle"),
      assetId: asId<"asset">("asset.detective"),
      sourceRect: { x: 16, y: 0, width: 16, height: 32 },
      sourceSize: { width: 16, height: 32 },
      trimOffset: { x: 0, y: 0 },
      pivot: { x: 8, y: 32 },
      footPoint: { x: 8, y: 32 },
      durationTicks: 8,
      mirrorEligible: true,
    },
  ],
  animations: [
    {
      id: asId<"animation-clip">("animation.walk-east"),
      state: "walk",
      facing: "east",
      frameIds: [asId<"sprite-frame">("frame.walk")],
      loop: true,
      interruptible: true,
    },
    {
      id: asId<"animation-clip">("animation.idle-east"),
      state: "idle",
      facing: "east",
      frameIds: [asId<"sprite-frame">("frame.idle")],
      loop: true,
      interruptible: true,
    },
  ],
};

const bundle = {
  presentation: { logicalTicksPerSecond: 60 },
  actors: [actor],
  scenes: [
    {
      id: asId<"scene">("scene.office"),
      entrances: [
        {
          id: asId<"entrance">("entrance.office"),
          position: { x: 60, y: 150 },
          facing: "east",
        },
      ],
    },
  ],
  sceneStaging: {
    manifestVersion: 1,
    projectId: asId<"project">("project.test"),
    scenes: [
      {
        sceneId: asId<"scene">("scene.office"),
        actorFootprints: {},
        preferredWalkLanes: [],
        surfaceZones: [],
        depthScaleCurves: [],
        navigationScaleOverrides: [],
        navigationStateModifiers: [],
        approachSlotsByObject: {},
        interactionComfortRegionsByObject: {},
        interactionChoreographies: [],
        entryChoreographies: [
          {
            entranceId: asId<"entrance">("entrance.office"),
            spawnPosition: { x: 0, y: 150 },
            entryPath: [
              { x: 30, y: 150 },
              { x: 60, y: 150 },
            ],
            speedPixelsPerSecond: 60,
            entryAnimationState: "walk",
            arrivalFacing: "east",
            arrivalAnimationState: "idle",
            unlockControlAt: "path-end",
          },
        ],
        occlusionPlanes: [],
        paletteLightZones: [],
      },
    ],
  },
} as unknown as RuntimeBundle;

const playback = startAnimation(actor, asId<"animation-clip">("animation.idle-east")).state;
const world: RuntimeWorldState = {
  story: {
    schemaVersion: 1,
    projectId: asId<"project">("project.test"),
    tick: 0,
    currentSceneId: asId<"scene">("scene.office"),
    currentEntranceId: asId<"entrance">("entrance.office"),
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
  actorInstances: {
    "actor-instance.detective": {
      instanceId: asId<"actor-instance">("actor-instance.detective"),
      sceneId: asId<"scene">("scene.office"),
      actorId: actor.id,
      position: { x: 60, y: 150 },
      facing: "east",
      animationState: "idle",
      playback,
      visibleOverride: null,
    },
  },
};

describe("entry choreography runtime", () => {
  it("moves through authored native waypoints and applies arrival pose", () => {
    const started = beginEntryChoreography(
      bundle,
      world,
      asId<"actor-instance">("actor-instance.detective"),
      asId<"scene">("scene.office"),
      asId<"entrance">("entrance.office"),
    );
    expect(started.active).not.toBeNull();
    expect(started.state.actorInstances["actor-instance.detective"]?.position).toEqual({ x: 0, y: 150 });
    expect(started.state.actorInstances["actor-instance.detective"]?.animationState).toBe("walk");

    const halfway = advanceEntryChoreography(bundle, started.state, started.active!, 30);
    expect(halfway.active).not.toBeNull();
    expect(halfway.state.actorInstances["actor-instance.detective"]?.position.x).toBeCloseTo(30);

    const finished = advanceEntryChoreography(bundle, halfway.state, halfway.active!, 30);
    expect(finished.active).toBeNull();
    expect(finished.state.actorInstances["actor-instance.detective"]?.position).toEqual({ x: 60, y: 150 });
    expect(finished.state.actorInstances["actor-instance.detective"]?.animationState).toBe("idle");
    expect(finished.events.at(-1)?.kind).toBe("entry-choreography-completed");
  });

  it("preserves an immediate arrival pose through the controller merge handoff", () => {
    const immediateBundle = {
      ...bundle,
      sceneStaging: {
        ...bundle.sceneStaging,
        scenes: [
          {
            ...bundle.sceneStaging.scenes[0]!,
            entryChoreographies: [
              {
                entranceId: asId<"entrance">("entrance.office"),
                entryPath: [],
                speedPixelsPerSecond: 60,
                arrivalFacing: "east",
                arrivalAnimationState: "idle",
                unlockControlAt: "spawn" as const,
              },
            ],
          },
        ],
      },
    } as unknown as RuntimeBundle;

    const started = beginEntryChoreography(
      immediateBundle,
      {
        ...world,
        actorInstances: {
          ...world.actorInstances,
          "actor-instance.detective": {
            ...world.actorInstances["actor-instance.detective"]!,
            animationState: "walk",
            playback: startAnimation(actor, asId<"animation-clip">("animation.walk-east")).state,
          },
        },
      },
      asId<"actor-instance">("actor-instance.detective"),
      asId<"scene">("scene.office"),
      asId<"entrance">("entrance.office"),
    );

    expect(started.active).not.toBeNull();
    expect(started.state.actorInstances["actor-instance.detective"]?.animationState).toBe("idle");
    const completed = advanceEntryChoreography(immediateBundle, started.state, started.active!, 1);
    expect(completed.active).toBeNull();
    expect(completed.events.at(-1)?.kind).toBe("entry-choreography-completed");
    expect(completed.state.actorInstances["actor-instance.detective"]?.animationState).toBe("idle");
  });
});
