import { adventurePlayFeelProfileById } from "@evavo/adventure-play-feel";
import {
  idSchema,
  pointSchema,
  type Point,
} from "@evavo/adventure-project-schema";
import {
  runtimePlayFeelProfileIdSchema,
  type RuntimeBundle,
  type RuntimePlayFeelProfileId,
} from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import { z } from "zod";

export const saveGameProfiledCameraEasingSchema = z.enum([
  "step",
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
]);
export type SaveGameProfiledCameraEasing = z.infer<
  typeof saveGameProfiledCameraEasingSchema
>;

export const saveGameProfiledCameraShotSchema = z
  .object({
    sequenceId: idSchema("sequence"),
    trackId: idSchema("sequence-track"),
    cueIndex: z.number().int().nonnegative(),
    startedAtStoryTick: z.number().int().nonnegative(),
    durationTicks: z.number().int().nonnegative(),
    from: pointSchema,
    to: pointSchema,
    easing: saveGameProfiledCameraEasingSchema,
  })
  .strict();
export type SaveGameProfiledCameraShot = z.infer<
  typeof saveGameProfiledCameraShotSchema
>;

export const saveGameProfiledRuntimeCameraStateSchema = z
  .object({
    stateVersion: z.literal(1),
    profileId: runtimePlayFeelProfileIdSchema,
    sceneId: idSchema("scene"),
    camera: z
      .object({
        stateVersion: z.literal(1),
        tick: z.number().int().nonnegative(),
        position: pointSchema,
        unquantizedPosition: pointSchema,
        velocityPixelsPerSecond: pointSchema,
        settledTicks: z.number().int().nonnegative(),
      })
      .strict(),
    activeShot: saveGameProfiledCameraShotSchema.nullable(),
  })
  .strict();
export type SaveGameProfiledRuntimeCameraState = z.infer<
  typeof saveGameProfiledRuntimeCameraStateSchema
>;

export type SaveGameProfiledCameraIssueCode =
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

export interface SaveGameProfiledCameraIssue {
  readonly severity: "error";
  readonly code: SaveGameProfiledCameraIssueCode;
  readonly path: string;
  readonly message: string;
}

const EPSILON = 1e-7;

const addIssue = (
  issues: SaveGameProfiledCameraIssue[],
  code: SaveGameProfiledCameraIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

const cameraMaximum = (
  bundle: Pick<RuntimeBundle, "presentation">,
  scene: Pick<RuntimeBundle["scenes"][number], "width" | "height">,
): Point => ({
  x: Math.max(0, scene.width - bundle.presentation.nativeWidth),
  y: Math.max(0, scene.height - bundle.presentation.nativeHeight),
});

const pointInsideBounds = (point: Point, maximum: Point): boolean =>
  point.x >= -EPSILON &&
  point.y >= -EPSILON &&
  point.x <= maximum.x + EPSILON &&
  point.y <= maximum.y + EPSILON;

const clampPoint = (point: Point, maximum: Point): Point => ({
  x: Math.min(maximum.x, Math.max(0, point.x)),
  y: Math.min(maximum.y, Math.max(0, point.y)),
});

const samePoint = (left: Point, right: Point): boolean =>
  Math.abs(left.x - right.x) <= EPSILON &&
  Math.abs(left.y - right.y) <= EPSILON;

const validateShot = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  state: SaveGameProfiledRuntimeCameraState,
  maximum: Point,
  issues: SaveGameProfiledCameraIssue[],
): void => {
  const shot = state.activeShot;
  if (!shot) return;

  const sequence = bundle.sequences.find(
    (candidate) => candidate.id === shot.sequenceId,
  );
  if (!sequence) {
    addIssue(
      issues,
      "missing-shot-sequence",
      "interface.profiledCamera.activeShot.sequenceId",
      `Saved camera sequence '${shot.sequenceId}' does not exist.`,
    );
  } else {
    if (
      !world.story.activeSequences.some(
        (candidate) => candidate.sequenceId === shot.sequenceId,
      )
    ) {
      addIssue(
        issues,
        "inactive-shot-sequence",
        "interface.profiledCamera.activeShot.sequenceId",
        "Saved camera shot belongs to a sequence that is no longer active.",
      );
    }
    const track = sequence.tracks.find(
      (candidate) => candidate.id === shot.trackId,
    );
    if (!track) {
      addIssue(
        issues,
        "missing-shot-track",
        "interface.profiledCamera.activeShot.trackId",
        `Saved camera track '${shot.trackId}' does not exist.`,
      );
    } else {
      const cue = track.cues[shot.cueIndex];
      if (!cue || cue.kind !== "camera-shot") {
        addIssue(
          issues,
          "missing-shot-cue",
          "interface.profiledCamera.activeShot.cueIndex",
          "Saved camera cue is missing or is not a camera-shot cue.",
        );
      } else {
        const expectedTo = clampPoint(cue.position, maximum);
        if (
          cue.durationTicks !== shot.durationTicks ||
          cue.easing !== shot.easing ||
          !samePoint(expectedTo, shot.to)
        ) {
          addIssue(
            issues,
            "shot-cue-mismatch",
            "interface.profiledCamera.activeShot",
            "Saved camera shot no longer matches its authored sequence cue.",
          );
        }
      }
    }
  }

  if (shot.startedAtStoryTick > world.story.tick) {
    addIssue(
      issues,
      "shot-start-in-future",
      "interface.profiledCamera.activeShot.startedAtStoryTick",
      "Saved camera shot starts after the current runtime tick.",
    );
  }
  for (const [path, point] of [
    ["interface.profiledCamera.activeShot.from", shot.from],
    ["interface.profiledCamera.activeShot.to", shot.to],
  ] as const) {
    if (!pointInsideBounds(point, maximum)) {
      addIssue(
        issues,
        "shot-out-of-bounds",
        path,
        "Saved camera shot position is outside the current scene bounds.",
      );
    }
  }
};

export interface ValidateSaveGameProfiledCameraInput {
  readonly bundle: RuntimeBundle;
  readonly world: InteractiveRuntimeWorldState;
  readonly state: SaveGameProfiledRuntimeCameraState;
}

export const validateSaveGameProfiledCamera = (
  input: ValidateSaveGameProfiledCameraInput,
): readonly SaveGameProfiledCameraIssue[] => {
  const issues: SaveGameProfiledCameraIssue[] = [];
  const state = saveGameProfiledRuntimeCameraStateSchema.parse(input.state);
  const selectedProfileId: RuntimePlayFeelProfileId | undefined =
    input.bundle.playFeelProfileId;
  if (!selectedProfileId) {
    addIssue(
      issues,
      "camera-not-supported",
      "interface.profiledCamera.profileId",
      "The runtime bundle does not select a play-feel camera profile.",
    );
    return issues;
  }
  if (state.profileId !== selectedProfileId) {
    addIssue(
      issues,
      "profile-mismatch",
      "interface.profiledCamera.profileId",
      "Saved camera profile does not match the runtime bundle profile.",
    );
  }

  const profile = adventurePlayFeelProfileById(state.profileId);
  if (
    profile.logicalTicksPerSecond !==
    input.bundle.presentation.logicalTicksPerSecond
  ) {
    addIssue(
      issues,
      "logical-tick-rate-mismatch",
      "interface.profiledCamera.camera.tick",
      "Saved camera profile and runtime logical tick rates differ.",
    );
  }
  if (state.sceneId !== input.world.story.currentSceneId) {
    addIssue(
      issues,
      "scene-mismatch",
      "interface.profiledCamera.sceneId",
      "Saved camera scene does not match the current runtime scene.",
    );
  }

  const scene = input.bundle.scenes.find(
    (candidate) => candidate.id === state.sceneId,
  );
  if (!scene) {
    addIssue(
      issues,
      "missing-scene",
      "interface.profiledCamera.sceneId",
      `Saved camera scene '${state.sceneId}' does not exist.`,
    );
    return issues;
  }
  if (state.camera.tick !== input.world.story.tick) {
    addIssue(
      issues,
      "camera-tick-mismatch",
      "interface.profiledCamera.camera.tick",
      "Saved camera tick does not match the runtime story tick.",
    );
  }

  const maximum = cameraMaximum(input.bundle, scene);
  for (const [path, point] of [
    ["interface.profiledCamera.camera.position", state.camera.position],
    [
      "interface.profiledCamera.camera.unquantizedPosition",
      state.camera.unquantizedPosition,
    ],
  ] as const) {
    if (!pointInsideBounds(point, maximum)) {
      addIssue(
        issues,
        "camera-out-of-bounds",
        path,
        "Saved camera position is outside the current scene bounds.",
      );
    }
  }
  if (profile.camera.quantization === "native-pixel") {
    const expected = {
      x: Math.round(state.camera.unquantizedPosition.x),
      y: Math.round(state.camera.unquantizedPosition.y),
    };
    if (
      !Number.isInteger(state.camera.position.x) ||
      !Number.isInteger(state.camera.position.y) ||
      !samePoint(state.camera.position, expected)
    ) {
      addIssue(
        issues,
        "camera-quantization-mismatch",
        "interface.profiledCamera.camera.position",
        "Saved display camera position violates the native-pixel policy.",
      );
    }
  } else if (!samePoint(state.camera.position, state.camera.unquantizedPosition)) {
    addIssue(
      issues,
      "camera-quantization-mismatch",
      "interface.profiledCamera.camera.position",
      "Saved subpixel camera position differs from its canonical position.",
    );
  }

  validateShot(input.bundle, input.world, state, maximum, issues);
  return issues.sort(
    (left, right) =>
      left.path.localeCompare(right.path) || left.code.localeCompare(right.code),
  );
};

