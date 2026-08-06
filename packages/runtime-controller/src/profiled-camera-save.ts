import { adventurePlayFeelProfileById } from "@evavo/adventure-play-feel";
import type {
  AdventureCameraState,
  AdventurePlayFeelProfileId,
} from "@evavo/adventure-play-feel";
import type { Id, Point } from "@evavo/adventure-project-schema";
import type {
  ProfiledRuntimeCameraEasing,
  ProfiledRuntimeCameraShotState,
  ProfiledRuntimeCameraState,
} from "./profiled-camera-types.js";

const easingValues = new Set<ProfiledRuntimeCameraEasing>([
  "step",
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
]);

export class ProfiledRuntimeCameraParseError extends TypeError {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "ProfiledRuntimeCameraParseError";
    this.path = path;
  }
}

const record = (value: unknown, path: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProfiledRuntimeCameraParseError(path, "Expected an object.");
  }
  return value as Record<string, unknown>;
};

const exactKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
): void => {
  const allowed = new Set(allowedKeys);
  const extra = Object.keys(value)
    .filter((key) => !allowed.has(key))
    .sort((left, right) => left.localeCompare(right))[0];
  if (extra) {
    throw new ProfiledRuntimeCameraParseError(
      path,
      `Unsupported field '${extra}'.`,
    );
  }
};

const stringValue = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new ProfiledRuntimeCameraParseError(
      path,
      "Expected a non-empty string.",
    );
  }
  return value;
};

const finite = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ProfiledRuntimeCameraParseError(path, "Expected a finite number.");
  }
  return value;
};

const safeNonnegativeInteger = (value: unknown, path: string): number => {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new ProfiledRuntimeCameraParseError(
      path,
      "Expected a non-negative safe integer.",
    );
  }
  return value;
};

const point = (value: unknown, path: string): Point => {
  const input = record(value, path);
  exactKeys(input, ["x", "y"], path);
  return {
    x: finite(input["x"], `${path}.x`),
    y: finite(input["y"], `${path}.y`),
  };
};

const profileId = (
  value: unknown,
  path: string,
): AdventurePlayFeelProfileId => {
  const id = stringValue(value, path) as AdventurePlayFeelProfileId;
  try {
    adventurePlayFeelProfileById(id);
  } catch {
    throw new ProfiledRuntimeCameraParseError(
      path,
      `Unknown play-feel profile '${id}'.`,
    );
  }
  return id;
};

const easing = (
  value: unknown,
  path: string,
): ProfiledRuntimeCameraEasing => {
  if (
    typeof value !== "string" ||
    !easingValues.has(value as ProfiledRuntimeCameraEasing)
  ) {
    throw new ProfiledRuntimeCameraParseError(
      path,
      "Expected a supported camera easing.",
    );
  }
  return value as ProfiledRuntimeCameraEasing;
};

const cameraState = (value: unknown, path: string): AdventureCameraState => {
  const input = record(value, path);
  exactKeys(
    input,
    [
      "stateVersion",
      "tick",
      "position",
      "unquantizedPosition",
      "velocityPixelsPerSecond",
      "settledTicks",
    ],
    path,
  );
  if (input["stateVersion"] !== 1) {
    throw new ProfiledRuntimeCameraParseError(
      `${path}.stateVersion`,
      "Expected version 1.",
    );
  }
  return {
    stateVersion: 1,
    tick: safeNonnegativeInteger(input["tick"], `${path}.tick`),
    position: point(input["position"], `${path}.position`),
    unquantizedPosition: point(
      input["unquantizedPosition"],
      `${path}.unquantizedPosition`,
    ),
    velocityPixelsPerSecond: point(
      input["velocityPixelsPerSecond"],
      `${path}.velocityPixelsPerSecond`,
    ),
    settledTicks: safeNonnegativeInteger(
      input["settledTicks"],
      `${path}.settledTicks`,
    ),
  };
};

const shotState = (
  value: unknown,
  path: string,
): ProfiledRuntimeCameraShotState => {
  const input = record(value, path);
  exactKeys(
    input,
    [
      "sequenceId",
      "trackId",
      "cueIndex",
      "startedAtStoryTick",
      "durationTicks",
      "from",
      "to",
      "easing",
    ],
    path,
  );
  return {
    sequenceId: stringValue(
      input["sequenceId"],
      `${path}.sequenceId`,
    ) as Id<"sequence">,
    trackId: stringValue(
      input["trackId"],
      `${path}.trackId`,
    ) as Id<"sequence-track">,
    cueIndex: safeNonnegativeInteger(
      input["cueIndex"],
      `${path}.cueIndex`,
    ),
    startedAtStoryTick: safeNonnegativeInteger(
      input["startedAtStoryTick"],
      `${path}.startedAtStoryTick`,
    ),
    durationTicks: safeNonnegativeInteger(
      input["durationTicks"],
      `${path}.durationTicks`,
    ),
    from: point(input["from"], `${path}.from`),
    to: point(input["to"], `${path}.to`),
    easing: easing(input["easing"], `${path}.easing`),
  };
};

export const parseProfiledRuntimeCameraState = (
  value: unknown,
): ProfiledRuntimeCameraState => {
  const input = record(value, "camera");
  exactKeys(
    input,
    ["stateVersion", "profileId", "sceneId", "camera", "activeShot"],
    "camera",
  );
  if (input["stateVersion"] !== 1) {
    throw new ProfiledRuntimeCameraParseError(
      "camera.stateVersion",
      "Expected version 1.",
    );
  }
  return {
    stateVersion: 1,
    profileId: profileId(input["profileId"], "camera.profileId"),
    sceneId: stringValue(
      input["sceneId"],
      "camera.sceneId",
    ) as Id<"scene">,
    camera: cameraState(input["camera"], "camera.camera"),
    activeShot:
      input["activeShot"] === null
        ? null
        : shotState(input["activeShot"], "camera.activeShot"),
  };
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const input = value as Readonly<Record<string, unknown>>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort((left, right) =>
      left.localeCompare(right),
    )) {
      const child = input[key];
      if (child !== undefined) output[key] = canonicalize(child);
    }
    return output;
  }
  return value;
};

export const canonicalProfiledRuntimeCameraJson = (
  value: ProfiledRuntimeCameraState,
): string => JSON.stringify(canonicalize(parseProfiledRuntimeCameraState(value)));

export const parseProfiledRuntimeCameraJson = (
  value: string,
): ProfiledRuntimeCameraState => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch (error) {
    throw new ProfiledRuntimeCameraParseError(
      "camera",
      error instanceof Error ? error.message : "Invalid JSON.",
    );
  }
  return parseProfiledRuntimeCameraState(parsed);
};
