import {
  type AdventureCameraState,
  type AdventureNativePoint,
  type AdventurePlayFeelProfile,
  adventurePlayFeelProfileById,
  createAdventureCameraState,
} from "@evavo/adventure-play-feel";
import type { Id, Point } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";

export const PROFILED_CAMERA_POSITION_EPSILON = 1e-7;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export const sameProfiledCameraPoint = (
  left: AdventureNativePoint,
  right: AdventureNativePoint,
  tolerance = PROFILED_CAMERA_POSITION_EPSILON,
): boolean => Math.abs(left.x - right.x) <= tolerance && Math.abs(left.y - right.y) <= tolerance;

export const profiledCameraScene = (
  bundle: Pick<RuntimeBundle, "scenes">,
  sceneId: Id<"scene">,
): RuntimeBundle["scenes"][number] => {
  const scene = bundle.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) throw new Error(`Runtime scene '${sceneId}' does not exist.`);
  return scene;
};

export const profiledCameraMaximum = (
  bundle: Pick<RuntimeBundle, "presentation">,
  scene: Pick<RuntimeBundle["scenes"][number], "width" | "height">,
): Point => ({
  x: Math.max(0, scene.width - bundle.presentation.nativeWidth),
  y: Math.max(0, scene.height - bundle.presentation.nativeHeight),
});

export const clampProfiledCameraPoint = (
  point: AdventureNativePoint,
  bundle: Pick<RuntimeBundle, "presentation">,
  scene: Pick<RuntimeBundle["scenes"][number], "width" | "height">,
): Point => {
  const maximum = profiledCameraMaximum(bundle, scene);
  return {
    x: clamp(point.x, 0, maximum.x),
    y: clamp(point.y, 0, maximum.y),
  };
};

export const profiledCameraTargetForWorld = (
  bundle: Pick<RuntimeBundle, "scenes" | "presentation">,
  world: InteractiveRuntimeWorldState,
  controlledActorInstanceId: Id<"actor-instance"> | null,
): Point => {
  if (controlledActorInstanceId) {
    const actor = world.actorInstances[controlledActorInstanceId];
    if (actor?.sceneId === world.story.currentSceneId) return actor.position;
  }
  const scene = profiledCameraScene(bundle, world.story.currentSceneId);
  const entrance = scene.entrances.find((candidate) => candidate.id === world.story.currentEntranceId);
  return (
    entrance?.position ?? {
      x: bundle.presentation.nativeWidth / 2,
      y: bundle.presentation.nativeHeight / 2,
    }
  );
};

export const quantizeProfiledCameraPoint = (point: Point, profile: AdventurePlayFeelProfile): Point =>
  profile.camera.quantization === "native-pixel" ? { x: Math.round(point.x), y: Math.round(point.y) } : point;

export const initialProfiledCameraPosition = (
  bundle: Pick<RuntimeBundle, "presentation">,
  scene: Pick<RuntimeBundle["scenes"][number], "width" | "height">,
  target: Point,
  profile: AdventurePlayFeelProfile,
): Point => {
  if (profile.camera.mode === "fixed") return { x: 0, y: 0 };
  const viewport = bundle.presentation;
  const anchor =
    profile.camera.mode === "dead-zone-follow"
      ? {
          x: viewport.nativeWidth * ((profile.camera.deadZone.left + profile.camera.deadZone.right) / 2),
          y: viewport.nativeHeight * ((profile.camera.deadZone.top + profile.camera.deadZone.bottom) / 2),
        }
      : {
          x: viewport.nativeWidth / 2,
          y: viewport.nativeHeight / 2,
        };
  return clampProfiledCameraPoint({ x: target.x - anchor.x, y: target.y - anchor.y }, bundle, scene);
};

export const profiledCameraStateAt = (
  position: Point,
  storyTick: number,
  profile: AdventurePlayFeelProfile,
): AdventureCameraState => ({
  ...createAdventureCameraState(position),
  tick: storyTick,
  position: quantizeProfiledCameraPoint(position, profile),
});

export const playFeelProfileForRuntimeCamera = (bundle: RuntimeBundle): AdventurePlayFeelProfile | null => {
  if (!bundle.playFeelProfileId) return null;
  const profile = adventurePlayFeelProfileById(bundle.playFeelProfileId);
  if (profile.logicalTicksPerSecond !== bundle.presentation.logicalTicksPerSecond) {
    throw new RangeError(
      `Play-feel profile '${profile.id}' requires ` +
        `${profile.logicalTicksPerSecond} logical ticks per second, but the ` +
        `runtime bundle uses ${bundle.presentation.logicalTicksPerSecond}.`,
    );
  }
  return profile;
};
