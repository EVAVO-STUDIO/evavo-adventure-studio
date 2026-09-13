import type { AnimationPlaybackState } from "@evavo/adventure-animation";
import { ADVENTURE_MOTION_UNITS_PER_PIXEL, adventurePlayFeelProfileById } from "@evavo/adventure-play-feel";
import type { Actor } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { ActorInstanceAnimationEvent } from "./index.js";
import type { ActorMovementState, NavigableRuntimeWorldState } from "./movement-types.js";

const actorsById = (bundle: Pick<RuntimeBundle, "actors">): ReadonlyMap<string, Actor> =>
  new Map(bundle.actors.map((actor) => [actor.id as string, actor] as const));

const animationFrames = (actor: Actor, clipId: AnimationPlaybackState["clipId"]) => {
  const clip = actor.animations.find((candidate) => candidate.id === clipId);
  if (!clip) {
    throw new Error(`Actor '${actor.id}' has no animation clip '${clipId}'.`);
  }
  if (!clip.loop) {
    throw new Error(`Profile-driven movement animation '${clip.id}' must be authored as a looping clip.`);
  }
  const framesById = new Map(actor.frames.map((frame) => [frame.id as string, frame] as const));
  const frames = clip.frameIds.map((frameId) => {
    const frame = framesById.get(frameId);
    if (!frame) {
      throw new Error(`Animation clip '${clip.id}' references missing frame '${frameId}'.`);
    }
    return frame;
  });
  if (frames.length === 0) {
    throw new Error(`Animation clip '${clip.id}' has no frames.`);
  }
  return frames;
};

const safeCycleTicks = (
  actor: Actor,
  playback: AnimationPlaybackState,
): {
  readonly frames: ReturnType<typeof animationFrames>;
  readonly cycleTicks: number;
} => {
  const frames = animationFrames(actor, playback.clipId);
  const cycleTicks = frames.reduce((total, frame) => {
    if (!Number.isSafeInteger(frame.durationTicks) || frame.durationTicks <= 0) {
      throw new RangeError(`Animation frame '${frame.id}' requires a positive safe duration.`);
    }
    const next = total + frame.durationTicks;
    if (!Number.isSafeInteger(next)) {
      throw new RangeError("Animation cycle duration exceeds the safe integer range.");
    }
    return next;
  }, 0);
  return { frames, cycleTicks };
};

const absoluteAnimationTick = (
  distanceMicropixels: number,
  cycleMicropixels: number,
  cycleTicks: number,
): number => {
  if (
    !Number.isSafeInteger(distanceMicropixels) ||
    distanceMicropixels < 0 ||
    !Number.isSafeInteger(cycleMicropixels) ||
    cycleMicropixels <= 0
  ) {
    throw new RangeError("Profiled movement distance and cycle size must be safe integers.");
  }
  const value = (BigInt(distanceMicropixels) * BigInt(cycleTicks)) / BigInt(cycleMicropixels);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("Animation cycle position exceeds the safe integer range.");
  }
  return Number(value);
};

export const playbackForProfiledMovement = (
  actor: Actor,
  playback: AnimationPlaybackState,
  movement: ActorMovementState & {
    readonly profiled: NonNullable<ActorMovementState["profiled"]>;
  },
): AnimationPlaybackState => {
  const profile = adventurePlayFeelProfileById(movement.profiled.profileId);
  const cycleMicropixels = Math.round(
    profile.animation.pixelsPerWalkCycle * ADVENTURE_MOTION_UNITS_PER_PIXEL,
  );
  const { frames, cycleTicks } = safeCycleTicks(actor, playback);
  const absoluteTick = absoluteAnimationTick(
    movement.profiled.extension.motion.distanceMicropixels,
    cycleMicropixels,
    cycleTicks,
  );
  const loopIteration = Math.floor(absoluteTick / cycleTicks);
  let tickInCycle = absoluteTick % cycleTicks;
  let frameIndex = 0;
  let ticksIntoFrame = 0;

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    if (!frame) continue;
    if (tickInCycle < frame.durationTicks) {
      frameIndex = index;
      ticksIntoFrame = tickInCycle;
      break;
    }
    tickInCycle -= frame.durationTicks;
  }

  return {
    clipId: playback.clipId,
    frameIndex,
    ticksIntoFrame,
    loopIteration,
    completed: false,
  };
};

const profileDrivenActorIds = (state: NavigableRuntimeWorldState): ReadonlySet<string> => {
  const ids = new Set<string>();
  for (const movement of Object.values(state.movements)) {
    if (!movement.profiled) continue;
    const actor = state.actorInstances[movement.actorInstanceId];
    if (actor?.animationState === movement.walkAnimationState) {
      ids.add(movement.actorInstanceId);
    }
  }
  return ids;
};

export interface ProfiledMovementAnimationSync {
  readonly state: NavigableRuntimeWorldState;
  readonly animationEvents: readonly ActorInstanceAnimationEvent[];
}

export const synchronizeProfiledMovementAnimations = (
  bundle: Pick<RuntimeBundle, "actors">,
  state: NavigableRuntimeWorldState,
  animationEvents: readonly ActorInstanceAnimationEvent[],
): ProfiledMovementAnimationSync => {
  const drivenIds = profileDrivenActorIds(state);
  if (drivenIds.size === 0) {
    return { state, animationEvents };
  }

  const actors = actorsById(bundle);
  const actorInstances = { ...state.actorInstances };
  for (const actorInstanceId of [...drivenIds].sort((left, right) => left.localeCompare(right))) {
    const runtime = actorInstances[actorInstanceId];
    const movement = state.movements[actorInstanceId];
    if (!runtime || !movement?.profiled) {
      throw new Error(`Profile-driven actor '${actorInstanceId}' is missing runtime movement state.`);
    }
    const actor = actors.get(runtime.actorId);
    if (!actor) {
      throw new Error(`Actor '${runtime.actorId}' does not exist.`);
    }
    actorInstances[actorInstanceId] = {
      ...runtime,
      playback: playbackForProfiledMovement(
        actor,
        runtime.playback,
        movement as ActorMovementState & {
          readonly profiled: NonNullable<ActorMovementState["profiled"]>;
        },
      ),
    };
  }

  return {
    state: { ...state, actorInstances },
    animationEvents: animationEvents.filter((event) => !drivenIds.has(event.actorInstanceId)),
  };
};
