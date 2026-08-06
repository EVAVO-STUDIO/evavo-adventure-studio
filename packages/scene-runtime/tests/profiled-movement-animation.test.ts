import {
  currentAnimationFrame,
  startAnimation,
} from "@evavo/adventure-animation";
import {
  ADVENTURE_MOTION_UNITS_PER_PIXEL,
  adventurePlayFeelProfileById,
} from "@evavo/adventure-play-feel";
import type { Actor, Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  playbackForProfiledMovement,
  synchronizeProfiledMovementAnimations,
} from "../src/movement-animation.js";
import type {
  ActorMovementState,
  NavigableRuntimeWorldState,
} from "../src/movement-types.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;
const actorInstanceId = id<"actor-instance">("actor-instance.traveller");
const otherActorInstanceId = id<"actor-instance">("actor-instance.witness");

const frame = (name: string, durationTicks: number) => ({
  id: id<"sprite-frame">(`frame.${name}`),
  assetId: id<"asset">("asset.traveller"),
  sourceRect: { x: 0, y: 0, width: 16, height: 32 },
  sourceSize: { width: 16, height: 32 },
  trimOffset: { x: 0, y: 0 },
  pivot: { x: 8, y: 31 },
  footPoint: { x: 8, y: 31 },
  durationTicks,
  mirrorEligible: true,
});

const actor: Actor = {
  id: id<"actor">("actor.traveller"),
  name: "Traveller",
  frames: [frame("walk-a", 1), frame("walk-b", 3), frame("walk-c", 2)],
  animations: [
    {
      id: id<"animation-clip">("animation.walk-east"),
      state: "walk",
      facing: "east",
      frameIds: [
        id<"sprite-frame">("frame.walk-a"),
        id<"sprite-frame">("frame.walk-b"),
        id<"sprite-frame">("frame.walk-c"),
      ],
      loop: true,
      interruptible: true,
    },
  ],
};

const route = {
  points: [
    { x: 0, y: 160 },
    { x: 200, y: 160 },
  ],
  segments: [
    {
      from: { x: 0, y: 160 },
      to: { x: 200, y: 160 },
      kind: "walk" as const,
      areaId: id<"navigation-area">("navigation.road"),
      portalId: null,
      distance: 200,
    },
  ],
  distance: 200,
  startAreaId: id<"navigation-area">("navigation.road"),
  endAreaId: id<"navigation-area">("navigation.road"),
  snappedStart: false,
  snappedEnd: false,
};

const profiledMovement = (): ActorMovementState & {
  readonly profiled: NonNullable<ActorMovementState["profiled"]>;
} => {
  const profile = adventurePlayFeelProfileById("storybook-deliberate");
  const cycleMicropixels = Math.round(
    profile.animation.pixelsPerWalkCycle * ADVENTURE_MOTION_UNITS_PER_PIXEL,
  );
  const distanceMicropixels = cycleMicropixels * 2 + Math.floor(cycleMicropixels / 2);
  return {
    actorInstanceId,
    route,
    nextSegmentIndex: 0,
    distanceAlongSegment: 0,
    speedPixelsPerSecond: profile.movement.topSpeedPixelsPerSecond,
    walkAnimationState: "walk",
    arrivalAnimationState: "idle",
    profiled: {
      stateVersion: 1,
      actorInstanceId,
      profileId: profile.id,
      routeFingerprint: "fnv1a64:0000000000000000",
      routePointCount: 2,
      extension: {
        extensionVersion: 1,
        profileId: profile.id,
        routeFingerprint: "fnv1a64:0000000000000000",
        motion: {
          stateVersion: 1,
          tick: 1,
          phase: "moving",
          distanceMicropixels,
          velocityMicropixelsPerSecond: 1,
          distanceRemainder: 0,
          segmentIndex: 0,
          distanceAlongSegmentMicropixels: distanceMicropixels,
          position: { x: 1, y: 160 },
          unquantizedPosition: { x: 1, y: 160 },
          walkCyclePhase: 0.5,
        },
      },
      lastPhase: "moving",
      completedSegmentCount: 0,
    },
  };
};

const runtimeActor = (instanceId: Id<"actor-instance">) => ({
  instanceId,
  sceneId: id<"scene">("scene.road"),
  actorId: actor.id,
  position: { x: 1, y: 160 },
  facing: "east",
  animationState: "walk",
  playback: startAnimation(actor, id<"animation-clip">("animation.walk-east")).state,
  visibleOverride: null,
});

const world = (
  movement: ActorMovementState | null,
): NavigableRuntimeWorldState =>
  ({
    story: { tick: 1 },
    actorInstances: {
      [actorInstanceId]: runtimeActor(actorInstanceId),
      [otherActorInstanceId]: runtimeActor(otherActorInstanceId),
    },
    movements: movement ? { [actorInstanceId]: movement } : {},
  }) as unknown as NavigableRuntimeWorldState;

const bundle = { actors: [actor] } as Pick<RuntimeBundle, "actors">;

const animationEvent = (instanceId: Id<"actor-instance">) => ({
  actorInstanceId: instanceId,
  event: {
    kind: "frame-entered" as const,
    clipId: id<"animation-clip">("animation.walk-east"),
    frameId: id<"sprite-frame">("frame.walk-b"),
    frameIndex: 1,
  },
});

describe("profiled movement animation presentation", () => {
  it("locks visible walk frames to travelled distance and filters tick-driven events", () => {
    const movement = profiledMovement();
    const synchronized = synchronizeProfiledMovementAnimations(
      bundle,
      world(movement),
      [animationEvent(actorInstanceId), animationEvent(otherActorInstanceId)],
    );
    const runtime = synchronized.state.actorInstances[actorInstanceId];
    if (!runtime) throw new Error("Expected profiled actor runtime state.");

    expect(runtime.playback).toMatchObject({
      frameIndex: 1,
      ticksIntoFrame: 2,
      loopIteration: 2,
      completed: false,
    });
    expect(currentAnimationFrame(actor, runtime.playback).id).toBe("frame.walk-b");
    expect(synchronized.animationEvents).toEqual([
      animationEvent(otherActorInstanceId),
    ]);
  });

  it("rejects a non-looping clip instead of silently drifting from movement phase", () => {
    const nonLooping: Actor = {
      ...actor,
      animations: actor.animations.map((clip) => ({ ...clip, loop: false })),
    };
    const movement = profiledMovement();
    const playback = startAnimation(
      nonLooping,
      id<"animation-clip">("animation.walk-east"),
    ).state;

    expect(() =>
      playbackForProfiledMovement(nonLooping, playback, movement),
    ).toThrow(/must be authored as a looping clip/u);
  });

  it("leaves legacy movement playback and animation events untouched", () => {
    const profiled = profiledMovement();
    const legacy: ActorMovementState = {
      actorInstanceId: profiled.actorInstanceId,
      route: profiled.route,
      nextSegmentIndex: profiled.nextSegmentIndex,
      distanceAlongSegment: profiled.distanceAlongSegment,
      speedPixelsPerSecond: profiled.speedPixelsPerSecond,
      walkAnimationState: profiled.walkAnimationState,
      arrivalAnimationState: profiled.arrivalAnimationState,
    };
    const sourceWorld = world(legacy);
    const events = [animationEvent(actorInstanceId)];
    const synchronized = synchronizeProfiledMovementAnimations(
      bundle,
      sourceWorld,
      events,
    );

    expect(synchronized.state).toBe(sourceWorld);
    expect(synchronized.animationEvents).toBe(events);
  });
});
