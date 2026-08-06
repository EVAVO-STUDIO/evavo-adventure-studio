import { adventurePlayFeelProfileById } from "@evavo/adventure-play-feel";
import type { Point } from "@evavo/adventure-project-schema";
import {
  parseProfiledRuntimeCameraState,
} from "./profiled-camera-save.js";
import { createProfiledRuntimeCamera } from "./profiled-camera-runtime.js";
import {
  clampProfiledCameraPoint,
  PROFILED_CAMERA_POSITION_EPSILON,
  profiledCameraMaximum,
  sameProfiledCameraPoint,
} from "./profiled-camera-shared.js";
import type {
  ProfiledRuntimeCameraCompatibilityInput,
  ProfiledRuntimeCameraCompatibilityIssue,
  ProfiledRuntimeCameraState,
  RestoreProfiledRuntimeCameraInput,
} from "./profiled-camera-types.js";

const compatibilityIssue = (
  issues: ProfiledRuntimeCameraCompatibilityIssue[],
  code: ProfiledRuntimeCameraCompatibilityIssue["code"],
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

const pointInsideCameraBounds = (
  point: Point,
  maximum: Point,
): boolean =>
  point.x >= -PROFILED_CAMERA_POSITION_EPSILON &&
  point.y >= -PROFILED_CAMERA_POSITION_EPSILON &&
  point.x <= maximum.x + PROFILED_CAMERA_POSITION_EPSILON &&
  point.y <= maximum.y + PROFILED_CAMERA_POSITION_EPSILON;

export const validateProfiledRuntimeCameraCompatibility = (
  input: ProfiledRuntimeCameraCompatibilityInput,
): readonly ProfiledRuntimeCameraCompatibilityIssue[] => {
  const issues: ProfiledRuntimeCameraCompatibilityIssue[] = [];
  const state = parseProfiledRuntimeCameraState(input.state);
  if (!input.bundle.playFeelProfileId) {
    compatibilityIssue(
      issues,
      "camera-not-supported",
      "profileId",
      "The runtime bundle does not select a play-feel camera profile.",
    );
    return issues;
  }
  if (state.profileId !== input.bundle.playFeelProfileId) {
    compatibilityIssue(
      issues,
      "profile-mismatch",
      "profileId",
      "Saved camera profile does not match the runtime bundle profile.",
    );
  }
  const profile = adventurePlayFeelProfileById(state.profileId);
  if (
    profile.logicalTicksPerSecond !==
    input.bundle.presentation.logicalTicksPerSecond
  ) {
    compatibilityIssue(
      issues,
      "logical-tick-rate-mismatch",
      "camera.tick",
      "Saved camera profile and runtime logical tick rates differ.",
    );
  }
  if (state.sceneId !== input.world.story.currentSceneId) {
    compatibilityIssue(
      issues,
      "scene-mismatch",
      "sceneId",
      "Saved camera scene does not match the current runtime scene.",
    );
  }
  const scene = input.bundle.scenes.find(
    (candidate) => candidate.id === state.sceneId,
  );
  if (!scene) {
    compatibilityIssue(
      issues,
      "missing-scene",
      "sceneId",
      `Saved camera scene '${state.sceneId}' does not exist.`,
    );
    return issues;
  }
  if (state.camera.tick !== input.world.story.tick) {
    compatibilityIssue(
      issues,
      "camera-tick-mismatch",
      "camera.tick",
      "Saved camera tick does not match the runtime story tick.",
    );
  }
  const maximum = profiledCameraMaximum(input.bundle, scene);
  for (const [path, point] of [
    ["camera.position", state.camera.position],
    ["camera.unquantizedPosition", state.camera.unquantizedPosition],
  ] as const) {
    if (!pointInsideCameraBounds(point, maximum)) {
      compatibilityIssue(
        issues,
        "camera-out-of-bounds",
        path,
        "Saved camera position is outside the current scene bounds.",
      );
    }
  }
  if (
    profile.camera.quantization === "native-pixel" &&
    (!Number.isInteger(state.camera.position.x) ||
      !Number.isInteger(state.camera.position.y))
  ) {
    compatibilityIssue(
      issues,
      "camera-quantization-mismatch",
      "camera.position",
      "Saved display camera position is fractional under native-pixel policy.",
    );
  }

  const shot = state.activeShot;
  if (shot) {
    const sequence = input.bundle.sequences.find(
      (candidate) => candidate.id === shot.sequenceId,
    );
    if (!sequence) {
      compatibilityIssue(
        issues,
        "missing-shot-sequence",
        "activeShot.sequenceId",
        `Saved camera sequence '${shot.sequenceId}' does not exist.`,
      );
    } else {
      const active = input.world.story.activeSequences.some(
        (candidate) => candidate.sequenceId === shot.sequenceId,
      );
      if (!active) {
        compatibilityIssue(
          issues,
          "inactive-shot-sequence",
          "activeShot.sequenceId",
          "Saved camera shot belongs to a sequence that is no longer active.",
        );
      }
      const track = sequence.tracks.find(
        (candidate) => candidate.id === shot.trackId,
      );
      if (!track) {
        compatibilityIssue(
          issues,
          "missing-shot-track",
          "activeShot.trackId",
          `Saved camera track '${shot.trackId}' does not exist.`,
        );
      } else {
        const cue = track.cues[shot.cueIndex];
        if (!cue || cue.kind !== "camera-shot") {
          compatibilityIssue(
            issues,
            "missing-shot-cue",
            "activeShot.cueIndex",
            "Saved camera cue is missing or is not a camera-shot cue.",
          );
        } else {
          const expectedTo = clampProfiledCameraPoint(
            cue.position,
            input.bundle,
            scene,
          );
          if (
            cue.durationTicks !== shot.durationTicks ||
            cue.easing !== shot.easing ||
            !sameProfiledCameraPoint(expectedTo, shot.to)
          ) {
            compatibilityIssue(
              issues,
              "shot-cue-mismatch",
              "activeShot",
              "Saved camera shot no longer matches its authored sequence cue.",
            );
          }
        }
      }
    }
    if (shot.startedAtStoryTick > input.world.story.tick) {
      compatibilityIssue(
        issues,
        "shot-start-in-future",
        "activeShot.startedAtStoryTick",
        "Saved camera shot starts after the current runtime tick.",
      );
    }
    for (const [path, point] of [
      ["activeShot.from", shot.from],
      ["activeShot.to", shot.to],
    ] as const) {
      if (!pointInsideCameraBounds(point, maximum)) {
        compatibilityIssue(
          issues,
          "shot-out-of-bounds",
          path,
          "Saved camera shot position is outside the current scene bounds.",
        );
      }
    }
  }

  return issues.sort(
    (left, right) =>
      left.path.localeCompare(right.path) || left.code.localeCompare(right.code),
  );
};

export class ProfiledRuntimeCameraCompatibilityError extends Error {
  readonly issues: readonly ProfiledRuntimeCameraCompatibilityIssue[];

  constructor(issues: readonly ProfiledRuntimeCameraCompatibilityIssue[]) {
    super(`Profiled runtime camera is incompatible (${issues.length} issue(s)).`);
    this.name = "ProfiledRuntimeCameraCompatibilityError";
    this.issues = issues;
  }
}

export const assertProfiledRuntimeCameraCompatibility = (
  input: ProfiledRuntimeCameraCompatibilityInput,
): void => {
  const issues = validateProfiledRuntimeCameraCompatibility(input);
  if (issues.length > 0) {
    throw new ProfiledRuntimeCameraCompatibilityError(issues);
  }
};

export const restoreProfiledRuntimeCamera = (
  input: RestoreProfiledRuntimeCameraInput,
): ProfiledRuntimeCameraState | null => {
  if (input.savedState === null) return createProfiledRuntimeCamera(input);
  const state = parseProfiledRuntimeCameraState(input.savedState);
  assertProfiledRuntimeCameraCompatibility({
    bundle: input.bundle,
    world: input.world,
    state,
  });
  return state;
};
