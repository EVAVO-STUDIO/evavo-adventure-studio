import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractionChoreography } from "@evavo/adventure-scene-instances/staging";
import { startAnimation } from "@evavo/adventure-animation";
import { describe, expect, it } from "vitest";
import {
  advanceInteractionChoreography,
  beginInteractionChoreography,
} from "../src/choreography.js";
import type { RuntimeWorldState } from "../src/index.js";

const asId = <T extends string>(value: string): string & { readonly __id: T } => value as never;

const actor = {
  id: asId<"actor">("actor.detective"),
  name: "Detective",
  frames: [
    {
      id: asId<"sprite-frame">("frame.idle"),
      assetId: asId<"asset">("asset.detective"),
      sourceRect: { x: 0, y: 0, width: 16, height: 32 },
      sourceSize: { width: 16, height: 32 },
      trimOffset: { x: 0, y: 0 },
      pivot: { x: 8, y: 32 },
      footPoint: { x: 8, y: 32 },
      durationTicks: 8,
      mirrorEligible: true,
    },
    {
      id: asId<"sprite-frame">("frame.reach"),
      assetId: asId<"asset">("asset.detective"),
      sourceRect: { x: 16, y: 0, width: 16, height: 32 },
      sourceSize: { width: 16, height: 32 },
      trimOffset: { x: 0, y: 0 },
      pivot: { x: 8, y: 32 },
      footPoint: { x: 8, y: 32 },
      durationTicks: 1,
      mirrorEligible: true,
    },
  ],
  animations: [
    {
      id: asId<"animation-clip">("animation.idle"),
      state: "idle",
      facing: "north",
      frameIds: [asId<"sprite-frame">("frame.idle")],
      loop: true,
      interruptible: true,
    },
    {
      id: asId<"animation-clip">("animation.reach"),
      state: "reach",
      facing: "north",
      frameIds: [asId<"sprite-frame">("frame.reach")],
      loop: false,
      interruptible: false,
    },
  ],
};

const choreography: InteractionChoreography = {
  id: asId<"interaction-choreography">("choreo.use-desk"),
  interactionId: asId<"interaction">("interaction.use-desk"),
  approachSlotIds: [],
  beats: [
    { kind: "actor-animation", animationState: "reach", waitForCompletion: true },
    { kind: "hold", ticks: 2 },
  ],
  recoveryAnimationState: "idle",
};

const bundle = {
  actors: [actor],
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
        interactionChoreographies: [choreography],
        entryChoreographies: [],
        occlusionPlanes: [],
        paletteLightZones: [],
      },
    ],
  },
} as unknown as RuntimeBundle;

const idle = startAnimation(actor, asId<"animation-clip">("animation.idle")).state;
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
      position: { x: 80, y: 150 },
      facing: "north",
      animationState: "idle",
      playback: idle,
      visibleOverride: null,
    },
  },
};

describe("interaction choreography runtime", () => {
  it("waits for authored animation and hold beats before recovering", () => {
    const started = beginInteractionChoreography(
      bundle,
      world,
      asId<"actor-instance">("actor-instance.detective"),
      choreography,
    );
    expect(started.active?.waitingForAnimation).toBe(true);
    expect(started.state.actorInstances["actor-instance.detective"]?.animationState).toBe("reach");

    const animationCompleted: RuntimeWorldState = {
      ...started.state,
      actorInstances: {
        ...started.state.actorInstances,
        "actor-instance.detective": {
          ...started.state.actorInstances["actor-instance.detective"]!,
          playback: {
            ...started.state.actorInstances["actor-instance.detective"]!.playback,
            completed: true,
          },
        },
      },
    };
    const afterAnimation = advanceInteractionChoreography(
      bundle,
      animationCompleted,
      started.active!,
      0,
    );
    expect(afterAnimation.active?.holdTicksRemaining).toBe(2);

    const held = advanceInteractionChoreography(bundle, afterAnimation.state, afterAnimation.active!, 1);
    expect(held.active?.holdTicksRemaining).toBe(1);

    const finished = advanceInteractionChoreography(bundle, held.state, held.active!, 1);
    expect(finished.active).toBeNull();
    expect(finished.state.actorInstances["actor-instance.detective"]?.animationState).toBe("idle");
    expect(finished.choreographyEvents.at(-1)?.kind).toBe("choreography-completed");
  });
});
