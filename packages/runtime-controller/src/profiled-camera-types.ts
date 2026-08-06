import type { RuntimeEvent } from "@evavo/adventure-core";
import type {
  AdventureCameraState,
  AdventurePlayFeelProfileId,
} from "@evavo/adventure-play-feel";
import type { Id, Point } from "@evavo/adventure-project-schema";
import type { ResolvedCamera } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";

export type ProfiledRuntimeCameraEasing =
  | "step"
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out";

export interface ProfiledRuntimeCameraShotState {
  readonly sequenceId: Id<"sequence">;
  readonly trackId: Id<"sequence-track">;
  readonly cueIndex: number;
  readonly startedAtStoryTick: number;
  readonly durationTicks: number;
  readonly from: Point;
  readonly to: Point;
  readonly easing: ProfiledRuntimeCameraEasing;
}

export interface ProfiledRuntimeCameraState {
  readonly stateVersion: 1;
  readonly profileId: AdventurePlayFeelProfileId;
  readonly sceneId: Id<"scene">;
  readonly camera: AdventureCameraState;
  readonly activeShot: ProfiledRuntimeCameraShotState | null;
}

export interface CreateProfiledRuntimeCameraInput {
  readonly bundle: RuntimeBundle;
  readonly world: InteractiveRuntimeWorldState;
  readonly controlledActorInstanceId: Id<"actor-instance"> | null;
}

export interface AdvanceProfiledRuntimeCameraInput {
  readonly bundle: RuntimeBundle;
  readonly state: ProfiledRuntimeCameraState | null;
  readonly previousWorld: InteractiveRuntimeWorldState;
  readonly nextWorld: InteractiveRuntimeWorldState;
  readonly controlledActorInstanceId: Id<"actor-instance"> | null;
  readonly runtimeEvents?: readonly RuntimeEvent[];
}

export interface RestoreProfiledRuntimeCameraInput
  extends CreateProfiledRuntimeCameraInput {
  readonly savedState: unknown | null;
}

export type ProfiledRuntimeCameraCompatibilityIssueCode =
  | "camera-not-supported"
  | "profile-mismatch"
  | "logical-tick-rate-mismatch"
  | "scene-mismatch"
  | "missing-scene"
  | "camera-tick-mismatch"
  | "camera-out-of-bounds"
  | "camera-quantization-mismatch"
  | "missing-shot-sequence"
  | "inactive-shot-sequence"
  | "missing-shot-track"
  | "missing-shot-cue"
  | "shot-cue-mismatch"
  | "shot-start-in-future"
  | "shot-out-of-bounds";

export interface ProfiledRuntimeCameraCompatibilityIssue {
  readonly severity: "error";
  readonly code: ProfiledRuntimeCameraCompatibilityIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface ProfiledRuntimeCameraCompatibilityInput {
  readonly bundle: RuntimeBundle;
  readonly world: InteractiveRuntimeWorldState;
  readonly state: ProfiledRuntimeCameraState;
}

export interface ProfiledRuntimeCameraAdvance {
  readonly state: ProfiledRuntimeCameraState | null;
  readonly camera: ResolvedCamera;
}
