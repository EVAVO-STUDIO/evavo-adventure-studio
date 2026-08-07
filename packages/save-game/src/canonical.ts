import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { SaveGameIntegrityError } from "./errors.js";
import {
  saveGameSchema,
  type SaveGame,
  type SaveGamePayload,
} from "./schema.js";

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) =>
      left.localeCompare(right),
    )) {
      const child = source[key];
      if (child !== undefined) output[key] = canonicalize(child);
    }
    return output;
  }
  return value;
};

export const canonicalSaveGameJson = (value: unknown): string => {
  const serialized = JSON.stringify(canonicalize(value));
  if (serialized === undefined) {
    throw new TypeError("Save-game data cannot be represented as JSON.");
  }
  return serialized;
};

export const fnv1a64 = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
};

export const runtimeBundleFingerprint = (bundle: RuntimeBundle): string =>
  fnv1a64(canonicalSaveGameJson(bundle));

export const payloadFromSave = (save: SaveGame): SaveGamePayload => ({
  saveVersion: save.saveVersion,
  projectId: save.projectId,
  bundleFingerprint: save.bundleFingerprint,
  assetManifestFingerprint: save.assetManifestFingerprint,
  world: save.world,
  interface: save.interface,
});

export const parseSaveGame = (input: unknown): SaveGame => {
  const save = saveGameSchema.parse(input);
  if (
    fnv1a64(canonicalSaveGameJson(payloadFromSave(save))) !==
    save.saveFingerprint
  ) {
    throw new SaveGameIntegrityError();
  }
  return save;
};
