import { adventurePlayFeelProfileById } from "@evavo/adventure-play-feel";
import {
  parseRuntimeBundle,
  type RuntimePlayFeelProfileId,
  runtimePlayFeelProfileIdSchema,
} from "@evavo/adventure-runtime-bundle";
import { type CompiledProject, canonicalStringify } from "./index.js";

const fnv1a64 = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
};

export const attachRuntimePlayFeelProfile = (
  compiled: CompiledProject,
  profileId: RuntimePlayFeelProfileId,
): CompiledProject => {
  const parsedProfileId = runtimePlayFeelProfileIdSchema.parse(profileId);
  const profile = adventurePlayFeelProfileById(parsedProfileId);
  if (profile.logicalTicksPerSecond !== compiled.bundle.presentation.logicalTicksPerSecond) {
    throw new RangeError(
      `Play-feel profile '${profile.id}' requires ` +
        `${profile.logicalTicksPerSecond} logical ticks per second, but the ` +
        `compiled bundle uses ${compiled.bundle.presentation.logicalTicksPerSecond}.`,
    );
  }
  const bundle = parseRuntimeBundle({
    ...compiled.bundle,
    playFeelProfileId: parsedProfileId,
  });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: compiled.warnings,
  };
};
