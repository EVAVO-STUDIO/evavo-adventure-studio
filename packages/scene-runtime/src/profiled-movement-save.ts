import {
  type AdventureMotionPhase,
  type AdventureMotionRuntimeExtension,
  type AdventureMotionState,
  type AdventurePlayFeelProfileId,
  adventurePlayFeelProfileById,
} from "@evavo/adventure-play-feel";
import type { Id } from "@evavo/adventure-project-schema";
import type { ProfiledNavigationMovementState } from "./profiled-movement-types.js";

const motionPhases = new Set<AdventureMotionPhase>([
  "starting",
  "moving",
  "cornering",
  "arriving",
  "arrived",
]);
const fingerprintPattern = /^fnv1a64:[0-9a-f]{16}$/u;

export class ProfiledNavigationMovementParseError extends TypeError {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "ProfiledNavigationMovementParseError";
    this.path = path;
  }
}

const record = (value: unknown, path: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProfiledNavigationMovementParseError(path, "Expected an object.");
  }
  return value as Record<string, unknown>;
};

const exactKeys = (value: Record<string, unknown>, keys: readonly string[], path: string): void => {
  const allowed = new Set(keys);
  const extras = Object.keys(value).filter((key) => !allowed.has(key));
  if (extras.length > 0) {
    throw new ProfiledNavigationMovementParseError(path, `Unsupported field '${extras.sort()[0]}'.`);
  }
};

const stringValue = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new ProfiledNavigationMovementParseError(path, "Expected a non-empty string.");
  }
  return value;
};

const finite = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ProfiledNavigationMovementParseError(path, "Expected a finite number.");
  }
  return value;
};

const safeNonnegativeInteger = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new ProfiledNavigationMovementParseError(path, "Expected a non-negative safe integer.");
  }
  return value;
};

const safePositiveInteger = (value: unknown, path: string): number => {
  const parsed = safeNonnegativeInteger(value, path);
  if (parsed === 0) {
    throw new ProfiledNavigationMovementParseError(path, "Expected a positive safe integer.");
  }
  return parsed;
};

const profileIdValue = (value: unknown, path: string): AdventurePlayFeelProfileId => {
  const id = stringValue(value, path) as AdventurePlayFeelProfileId;
  try {
    adventurePlayFeelProfileById(id);
  } catch {
    throw new ProfiledNavigationMovementParseError(path, `Unknown profile '${id}'.`);
  }
  return id;
};

const fingerprint = (value: unknown, path: string): string => {
  const parsed = stringValue(value, path);
  if (!fingerprintPattern.test(parsed)) {
    throw new ProfiledNavigationMovementParseError(path, "Expected an FNV-1a 64-bit fingerprint.");
  }
  return parsed;
};

const point = (value: unknown, path: string) => {
  const input = record(value, path);
  exactKeys(input, ["x", "y"], path);
  return {
    x: finite(input["x"], `${path}.x`),
    y: finite(input["y"], `${path}.y`),
  };
};

const phaseValue = (value: unknown, path: string): AdventureMotionPhase => {
  if (typeof value !== "string" || !motionPhases.has(value as AdventureMotionPhase)) {
    throw new ProfiledNavigationMovementParseError(path, "Expected a supported motion phase.");
  }
  return value as AdventureMotionPhase;
};

const parseMotion = (value: unknown, path: string): AdventureMotionState => {
  const input = record(value, path);
  exactKeys(
    input,
    [
      "stateVersion",
      "tick",
      "phase",
      "distanceMicropixels",
      "velocityMicropixelsPerSecond",
      "distanceRemainder",
      "segmentIndex",
      "distanceAlongSegmentMicropixels",
      "position",
      "unquantizedPosition",
      "walkCyclePhase",
    ],
    path,
  );
  if (input["stateVersion"] !== 1) {
    throw new ProfiledNavigationMovementParseError(`${path}.stateVersion`, "Expected version 1.");
  }
  const walkCyclePhase = finite(input["walkCyclePhase"], `${path}.walkCyclePhase`);
  if (walkCyclePhase < 0 || walkCyclePhase >= 1) {
    throw new ProfiledNavigationMovementParseError(
      `${path}.walkCyclePhase`,
      "Expected a phase from 0 inclusive to 1 exclusive.",
    );
  }
  return {
    stateVersion: 1,
    tick: safeNonnegativeInteger(input["tick"], `${path}.tick`),
    phase: phaseValue(input["phase"], `${path}.phase`),
    distanceMicropixels: safeNonnegativeInteger(input["distanceMicropixels"], `${path}.distanceMicropixels`),
    velocityMicropixelsPerSecond: safeNonnegativeInteger(
      input["velocityMicropixelsPerSecond"],
      `${path}.velocityMicropixelsPerSecond`,
    ),
    distanceRemainder: safeNonnegativeInteger(input["distanceRemainder"], `${path}.distanceRemainder`),
    segmentIndex: safeNonnegativeInteger(input["segmentIndex"], `${path}.segmentIndex`),
    distanceAlongSegmentMicropixels: safeNonnegativeInteger(
      input["distanceAlongSegmentMicropixels"],
      `${path}.distanceAlongSegmentMicropixels`,
    ),
    position: point(input["position"], `${path}.position`),
    unquantizedPosition: point(input["unquantizedPosition"], `${path}.unquantizedPosition`),
    walkCyclePhase,
  };
};

const parseExtension = (value: unknown, path: string): AdventureMotionRuntimeExtension => {
  const input = record(value, path);
  exactKeys(input, ["extensionVersion", "profileId", "routeFingerprint", "motion"], path);
  if (input["extensionVersion"] !== 1) {
    throw new ProfiledNavigationMovementParseError(`${path}.extensionVersion`, "Expected version 1.");
  }
  return {
    extensionVersion: 1,
    profileId: profileIdValue(input["profileId"], `${path}.profileId`),
    routeFingerprint: fingerprint(input["routeFingerprint"], `${path}.routeFingerprint`),
    motion: parseMotion(input["motion"], `${path}.motion`),
  };
};

export const parseProfiledNavigationMovementState = (value: unknown): ProfiledNavigationMovementState => {
  const input = record(value, "movement");
  exactKeys(
    input,
    [
      "stateVersion",
      "actorInstanceId",
      "profileId",
      "routeFingerprint",
      "routePointCount",
      "extension",
      "lastPhase",
      "completedSegmentCount",
    ],
    "movement",
  );
  if (input["stateVersion"] !== 1) {
    throw new ProfiledNavigationMovementParseError("movement.stateVersion", "Expected version 1.");
  }
  const profileId = profileIdValue(input["profileId"], "movement.profileId");
  const routeFingerprint = fingerprint(input["routeFingerprint"], "movement.routeFingerprint");
  const extension = parseExtension(input["extension"], "movement.extension");
  if (extension.profileId !== profileId) {
    throw new ProfiledNavigationMovementParseError(
      "movement.extension.profileId",
      "Extension and movement profile identities differ.",
    );
  }
  if (extension.routeFingerprint !== routeFingerprint) {
    throw new ProfiledNavigationMovementParseError(
      "movement.extension.routeFingerprint",
      "Extension and movement route fingerprints differ.",
    );
  }
  return {
    stateVersion: 1,
    actorInstanceId: stringValue(
      input["actorInstanceId"],
      "movement.actorInstanceId",
    ) as Id<"actor-instance">,
    profileId,
    routeFingerprint,
    routePointCount: safePositiveInteger(input["routePointCount"], "movement.routePointCount"),
    extension,
    lastPhase: phaseValue(input["lastPhase"], "movement.lastPhase"),
    completedSegmentCount: safeNonnegativeInteger(
      input["completedSegmentCount"],
      "movement.completedSegmentCount",
    ),
  };
};

export const canonicalProfiledNavigationMovementJson = (value: ProfiledNavigationMovementState): string =>
  JSON.stringify(parseProfiledNavigationMovementState(value));

export const parseProfiledNavigationMovementJson = (value: string): ProfiledNavigationMovementState => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch (error) {
    throw new ProfiledNavigationMovementParseError(
      "movement",
      error instanceof Error ? error.message : "Invalid JSON.",
    );
  }
  return parseProfiledNavigationMovementState(parsed);
};
