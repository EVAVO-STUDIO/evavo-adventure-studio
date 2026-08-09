import { advanceAdventureMotion, createAdventureMotionState } from "./kinematics.js";
import { adventurePlayFeelProfileById } from "./presets.js";
import type {
  AdventureKinematicRoute,
  AdventureMotionAdvance,
  AdventureMotionRuntimeExtension,
  AdventureMotionRuntimeTuning,
  AdventurePlayFeelProfile,
} from "./types.js";

const canonicalNumber = (value: number): string => {
  if (!Number.isFinite(value)) throw new RangeError("Route fingerprint values must be finite.");
  return Object.is(value, -0) ? "0" : value.toString();
};

const fnv1a64 = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
};

export const adventureKinematicRouteFingerprint = (route: AdventureKinematicRoute): string =>
  fnv1a64(route.points.map((point) => `${canonicalNumber(point.x)},${canonicalNumber(point.y)}`).join(";"));

export class AdventureMotionRuntimeExtensionError extends Error {
  readonly code: "unsupported-extension-version" | "route-fingerprint-mismatch" | "profile-mismatch";

  constructor(code: AdventureMotionRuntimeExtensionError["code"], message: string) {
    super(message);
    this.name = "AdventureMotionRuntimeExtensionError";
    this.code = code;
  }
}

export const createAdventureMotionRuntimeExtension = (
  route: AdventureKinematicRoute,
  profile: AdventurePlayFeelProfile,
): AdventureMotionRuntimeExtension => ({
  extensionVersion: 1,
  profileId: profile.id,
  routeFingerprint: adventureKinematicRouteFingerprint(route),
  motion: createAdventureMotionState(route, profile),
});

const assertExtensionCompatible = (
  extension: AdventureMotionRuntimeExtension,
  route: AdventureKinematicRoute,
  profile: AdventurePlayFeelProfile,
): void => {
  if (extension.extensionVersion !== 1) {
    throw new AdventureMotionRuntimeExtensionError(
      "unsupported-extension-version",
      `Unsupported motion extension version '${String(extension.extensionVersion)}'.`,
    );
  }
  if (extension.profileId !== profile.id) {
    throw new AdventureMotionRuntimeExtensionError(
      "profile-mismatch",
      `Motion extension profile '${extension.profileId}' does not match '${profile.id}'.`,
    );
  }
  const fingerprint = adventureKinematicRouteFingerprint(route);
  if (extension.routeFingerprint !== fingerprint) {
    throw new AdventureMotionRuntimeExtensionError(
      "route-fingerprint-mismatch",
      `Motion route fingerprint '${extension.routeFingerprint}' does not match '${fingerprint}'.`,
    );
  }
};

export const advanceAdventureMotionRuntimeExtension = (
  extension: AdventureMotionRuntimeExtension,
  route: AdventureKinematicRoute,
  ticks = 1,
  tuning: AdventureMotionRuntimeTuning = {},
): AdventureMotionAdvance & {
  readonly extension: AdventureMotionRuntimeExtension;
} => {
  const profile = adventurePlayFeelProfileById(extension.profileId);
  assertExtensionCompatible(extension, route, profile);
  const advanced = advanceAdventureMotion(extension.motion, route, profile, ticks, tuning);
  return {
    ...advanced,
    extension: { ...extension, motion: advanced.state },
  };
};
