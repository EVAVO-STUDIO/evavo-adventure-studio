import type { RuntimeEvent } from "@evavo/adventure-core";
import {
  type AdventureCameraState,
  type AdventurePlayFeelProfile,
  advanceAdventureCamera,
} from "@evavo/adventure-play-feel";
import type { Id } from "@evavo/adventure-project-schema";
import type { ResolvedCamera } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import {
  clampProfiledCameraPoint,
  initialProfiledCameraPosition,
  playFeelProfileForRuntimeCamera,
  profiledCameraScene,
  profiledCameraStateAt,
  profiledCameraTargetForWorld,
  quantizeProfiledCameraPoint,
} from "./profiled-camera-shared.js";
import type {
  AdvanceProfiledRuntimeCameraInput,
  CreateProfiledRuntimeCameraInput,
  ProfiledRuntimeCameraAdvance,
  ProfiledRuntimeCameraEasing,
  ProfiledRuntimeCameraShotState,
  ProfiledRuntimeCameraState,
} from "./profiled-camera-types.js";

export const createProfiledRuntimeCamera = (
  input: CreateProfiledRuntimeCameraInput,
): ProfiledRuntimeCameraState | null => {
  const profile = playFeelProfileForRuntimeCamera(input.bundle);
  if (!profile) return null;
  const scene = profiledCameraScene(input.bundle, input.world.story.currentSceneId);
  const target = profiledCameraTargetForWorld(input.bundle, input.world, input.controlledActorInstanceId);
  const position = initialProfiledCameraPosition(input.bundle, scene, target, profile);
  return {
    stateVersion: 1,
    profileId: profile.id,
    sceneId: scene.id,
    camera: profiledCameraStateAt(position, input.world.story.tick, profile),
    activeShot: null,
  };
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const easedProgress = (progress: number, easing: ProfiledRuntimeCameraEasing): number => {
  const value = clamp01(progress);
  switch (easing) {
    case "step":
      return value >= 1 ? 1 : 0;
    case "linear":
      return value;
    case "ease-in":
      return value * value;
    case "ease-out":
      return 1 - (1 - value) * (1 - value);
    case "ease-in-out":
      return value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2;
  }
};

const shotCameraState = (
  current: AdventureCameraState,
  shot: ProfiledRuntimeCameraShotState,
  storyTick: number,
  ticksPerSecond: number,
  profile: AdventurePlayFeelProfile,
): AdventureCameraState => {
  const elapsed = Math.max(0, storyTick - shot.startedAtStoryTick);
  const progress = shot.durationTicks === 0 ? 1 : elapsed / shot.durationTicks;
  const eased = easedProgress(progress, shot.easing);
  const unquantizedPosition = {
    x: shot.from.x + (shot.to.x - shot.from.x) * eased,
    y: shot.from.y + (shot.to.y - shot.from.y) * eased,
  };
  const tickDelta = storyTick - current.tick;
  const velocityPixelsPerSecond =
    tickDelta > 0
      ? {
          x: ((unquantizedPosition.x - current.unquantizedPosition.x) * ticksPerSecond) / tickDelta,
          y: ((unquantizedPosition.y - current.unquantizedPosition.y) * ticksPerSecond) / tickDelta,
        }
      : { x: 0, y: 0 };
  return {
    stateVersion: 1,
    tick: storyTick,
    position: quantizeProfiledCameraPoint(unquantizedPosition, profile),
    unquantizedPosition,
    velocityPixelsPerSecond,
    settledTicks: progress >= 1 ? current.settledTicks + Math.max(1, tickDelta) : 0,
  };
};

const genericCameraState = (
  bundle: RuntimeBundle,
  state: AdventureCameraState,
  previousWorld: InteractiveRuntimeWorldState,
  nextWorld: InteractiveRuntimeWorldState,
  controlledActorInstanceId: Id<"actor-instance"> | null,
  profile: AdventurePlayFeelProfile,
): AdventureCameraState => {
  const tickDelta = nextWorld.story.tick - previousWorld.story.tick;
  if (tickDelta === 0) return { ...state, tick: nextWorld.story.tick };
  const previousTarget = profiledCameraTargetForWorld(bundle, previousWorld, controlledActorInstanceId);
  const nextTarget = profiledCameraTargetForWorld(bundle, nextWorld, controlledActorInstanceId);
  const scene = profiledCameraScene(bundle, nextWorld.story.currentSceneId);
  return advanceAdventureCamera(
    state,
    {
      position: nextTarget,
      velocityPixelsPerSecond: {
        x: (nextTarget.x - previousTarget.x) * bundle.presentation.logicalTicksPerSecond,
        y: (nextTarget.y - previousTarget.y) * bundle.presentation.logicalTicksPerSecond,
      },
    },
    {
      width: bundle.presentation.nativeWidth,
      height: bundle.presentation.nativeHeight,
    },
    { width: scene.width, height: scene.height },
    profile,
    tickDelta,
  ).state;
};

interface CameraEventPlan {
  readonly state: ProfiledRuntimeCameraState;
  readonly releaseSequenceIds: ReadonlySet<string>;
}

const applyCameraEvents = (
  bundle: RuntimeBundle,
  state: ProfiledRuntimeCameraState,
  events: readonly RuntimeEvent[],
  storyTick: number,
  profile: AdventurePlayFeelProfile,
): CameraEventPlan => {
  let next = state;
  const releases = new Set<string>();
  const scene = profiledCameraScene(bundle, state.sceneId);

  for (const event of events) {
    if (event.kind === "sequence-cue-reached" && event.cue.kind === "camera-shot") {
      const to = clampProfiledCameraPoint(event.cue.position, bundle, scene);
      const shot: ProfiledRuntimeCameraShotState = {
        sequenceId: event.sequenceId,
        trackId: event.trackId,
        cueIndex: event.cueIndex,
        startedAtStoryTick: storyTick,
        durationTicks: event.cue.durationTicks,
        from: next.camera.unquantizedPosition,
        to,
        easing: event.cue.easing,
      };
      next = {
        ...next,
        activeShot: shot,
        camera:
          shot.durationTicks === 0
            ? shotCameraState(
                next.camera,
                shot,
                storyTick,
                bundle.presentation.logicalTicksPerSecond,
                profile,
              )
            : next.camera,
      };
    }
    if (event.kind === "sequence-completed" || event.kind === "sequence-skipped") {
      releases.add(event.sequenceId);
    }
  }
  return { state: next, releaseSequenceIds: releases };
};

export const advanceProfiledRuntimeCamera = (
  input: AdvanceProfiledRuntimeCameraInput,
): ProfiledRuntimeCameraAdvance => {
  const profile = playFeelProfileForRuntimeCamera(input.bundle);
  if (!profile) {
    return {
      state: null,
      camera: resolvedProfiledRuntimeCamera(input.bundle, null),
    };
  }
  const tickDelta = input.nextWorld.story.tick - input.previousWorld.story.tick;
  if (!Number.isSafeInteger(tickDelta) || tickDelta < 0 || tickDelta > 1) {
    throw new RangeError("Profiled runtime camera advancement requires zero or one logical tick.");
  }

  let state = input.state;
  if (state && state.profileId !== profile.id) {
    throw new RangeError("Runtime camera profile changed during active playback.");
  }
  const reset = !state || state.sceneId !== input.nextWorld.story.currentSceneId;
  if (reset) {
    state = createProfiledRuntimeCamera({
      bundle: input.bundle,
      world: input.nextWorld,
      controlledActorInstanceId: input.controlledActorInstanceId,
    });
  }
  if (!state) {
    return {
      state: null,
      camera: resolvedProfiledRuntimeCamera(input.bundle, null),
    };
  }

  const planned = applyCameraEvents(
    input.bundle,
    state,
    input.runtimeEvents ?? [],
    input.nextWorld.story.tick,
    profile,
  );
  state = planned.state;
  const camera = state.activeShot
    ? shotCameraState(
        state.camera,
        state.activeShot,
        input.nextWorld.story.tick,
        input.bundle.presentation.logicalTicksPerSecond,
        profile,
      )
    : reset
      ? state.camera
      : genericCameraState(
          input.bundle,
          state.camera,
          input.previousWorld,
          input.nextWorld,
          input.controlledActorInstanceId,
          profile,
        );
  const activeShot =
    state.activeShot && !planned.releaseSequenceIds.has(state.activeShot.sequenceId)
      ? state.activeShot
      : null;
  const nextState: ProfiledRuntimeCameraState = {
    ...state,
    camera,
    activeShot,
  };
  return {
    state: nextState,
    camera: resolvedProfiledRuntimeCamera(input.bundle, nextState),
  };
};

export const resolvedProfiledRuntimeCamera = (
  bundle: Pick<RuntimeBundle, "presentation">,
  state: ProfiledRuntimeCameraState | null,
): ResolvedCamera => ({
  position: state?.camera.position ?? { x: 0, y: 0 },
  viewport: {
    width: bundle.presentation.nativeWidth,
    height: bundle.presentation.nativeHeight,
  },
  shakeOffset: { x: 0, y: 0 },
});
