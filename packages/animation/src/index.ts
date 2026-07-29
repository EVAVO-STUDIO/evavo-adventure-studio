import type {
  Actor,
  AnimationClip,
  Id,
  SpriteFrame,
} from "@evavo/adventure-project-schema";

export interface AnimationPlaybackState {
  readonly clipId: Id<"animation-clip">;
  readonly frameIndex: number;
  readonly ticksIntoFrame: number;
  readonly loopIteration: number;
  readonly completed: boolean;
}

export type AnimationEvent =
  | {
      readonly kind: "frame-entered";
      readonly clipId: Id<"animation-clip">;
      readonly frameId: Id<"sprite-frame">;
      readonly frameIndex: number;
    }
  | {
      readonly kind: "marker";
      readonly clipId: Id<"animation-clip">;
      readonly frameId: Id<"sprite-frame">;
      readonly marker: string;
    }
  | {
      readonly kind: "looped";
      readonly clipId: Id<"animation-clip">;
      readonly iteration: number;
    }
  | {
      readonly kind: "completed";
      readonly clipId: Id<"animation-clip">;
    };

export interface AnimationTransition {
  readonly state: AnimationPlaybackState;
  readonly frame: SpriteFrame;
  readonly events: readonly AnimationEvent[];
}

const MAX_FRAME_TRANSITIONS_PER_ADVANCE = 4096;

const findClip = (
  actor: Actor,
  clipId: Id<"animation-clip">,
): AnimationClip => {
  const clip = actor.animations.find((candidate) => candidate.id === clipId);
  if (!clip) {
    throw new Error(`Actor '${actor.id}' has no animation clip '${clipId}'.`);
  }
  return clip;
};

const framesForClip = (
  actor: Actor,
  clip: AnimationClip,
): readonly SpriteFrame[] => {
  const framesById = new Map(
    actor.frames.map((frame) => [frame.id as string, frame]),
  );
  return clip.frameIds.map((frameId) => {
    const frame = framesById.get(frameId);
    if (!frame) {
      throw new Error(
        `Animation clip '${clip.id}' references missing frame '${frameId}'.`,
      );
    }
    return frame;
  });
};

const frameEvents = (
  clip: AnimationClip,
  frame: SpriteFrame,
  frameIndex: number,
): readonly AnimationEvent[] => [
  {
    kind: "frame-entered",
    clipId: clip.id,
    frameId: frame.id,
    frameIndex,
  },
  ...(frame.events ?? []).map(
    (marker): AnimationEvent => ({
      kind: "marker",
      clipId: clip.id,
      frameId: frame.id,
      marker,
    }),
  ),
];

const assertPlaybackState = (
  state: AnimationPlaybackState,
  clip: AnimationClip,
  frames: readonly SpriteFrame[],
): void => {
  const frame = frames[state.frameIndex];
  if (
    state.clipId !== clip.id ||
    !Number.isSafeInteger(state.frameIndex) ||
    state.frameIndex < 0 ||
    !frame ||
    !Number.isSafeInteger(state.ticksIntoFrame) ||
    state.ticksIntoFrame < 0 ||
    state.ticksIntoFrame > frame.durationTicks ||
    !Number.isSafeInteger(state.loopIteration) ||
    state.loopIteration < 0
  ) {
    throw new RangeError(`Animation playback state for '${clip.id}' is invalid.`);
  }
};

export const startAnimation = (
  actor: Actor,
  clipId: Id<"animation-clip">,
): AnimationTransition => {
  const clip = findClip(actor, clipId);
  const frames = framesForClip(actor, clip);
  const frame = frames[0];
  if (!frame) {
    throw new Error(`Animation clip '${clip.id}' has no frames.`);
  }

  return {
    state: {
      clipId: clip.id,
      frameIndex: 0,
      ticksIntoFrame: 0,
      loopIteration: 0,
      completed: false,
    },
    frame,
    events: frameEvents(clip, frame, 0),
  };
};

export const currentAnimationFrame = (
  actor: Actor,
  state: AnimationPlaybackState,
): SpriteFrame => {
  const clip = findClip(actor, state.clipId);
  const frames = framesForClip(actor, clip);
  assertPlaybackState(state, clip, frames);
  const frame = frames[state.frameIndex];
  if (!frame) {
    throw new RangeError(`Animation frame index ${state.frameIndex} is invalid.`);
  }
  return frame;
};

export const advanceAnimation = (
  actor: Actor,
  state: AnimationPlaybackState,
  ticks: number,
): AnimationTransition => {
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError("Animation advancement must be a non-negative safe integer.");
  }

  const clip = findClip(actor, state.clipId);
  const frames = framesForClip(actor, clip);
  assertPlaybackState(state, clip, frames);
  if (state.completed || ticks === 0) {
    return {
      state,
      frame: currentAnimationFrame(actor, state),
      events: [],
    };
  }

  let nextState = state;
  let remainingTicks = ticks;
  let transitions = 0;
  const events: AnimationEvent[] = [];

  while (remainingTicks > 0 && !nextState.completed) {
    const frame = frames[nextState.frameIndex];
    if (!frame) {
      throw new RangeError(`Animation frame index ${nextState.frameIndex} is invalid.`);
    }

    const ticksRemainingInFrame = frame.durationTicks - nextState.ticksIntoFrame;
    if (remainingTicks < ticksRemainingInFrame) {
      nextState = {
        ...nextState,
        ticksIntoFrame: nextState.ticksIntoFrame + remainingTicks,
      };
      remainingTicks = 0;
      break;
    }

    remainingTicks -= ticksRemainingInFrame;
    transitions += 1;
    if (transitions > MAX_FRAME_TRANSITIONS_PER_ADVANCE) {
      throw new RangeError(
        "Animation advancement crossed too many frame boundaries; advance in smaller chunks.",
      );
    }

    const nextFrameIndex = nextState.frameIndex + 1;
    const nextFrame = frames[nextFrameIndex];
    if (nextFrame) {
      nextState = {
        ...nextState,
        frameIndex: nextFrameIndex,
        ticksIntoFrame: 0,
      };
      events.push(...frameEvents(clip, nextFrame, nextFrameIndex));
      continue;
    }

    if (clip.loop) {
      const firstFrame = frames[0];
      if (!firstFrame) {
        throw new Error(`Animation clip '${clip.id}' has no frames.`);
      }
      nextState = {
        ...nextState,
        frameIndex: 0,
        ticksIntoFrame: 0,
        loopIteration: nextState.loopIteration + 1,
      };
      events.push(
        {
          kind: "looped",
          clipId: clip.id,
          iteration: nextState.loopIteration,
        },
        ...frameEvents(clip, firstFrame, 0),
      );
      continue;
    }

    nextState = {
      ...nextState,
      frameIndex: frames.length - 1,
      ticksIntoFrame: frame.durationTicks,
      completed: true,
    };
    events.push({ kind: "completed", clipId: clip.id });
  }

  return {
    state: nextState,
    frame: currentAnimationFrame(actor, nextState),
    events,
  };
};
