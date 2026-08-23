import type { IndexedAssetManifest } from "@evavo/adventure-asset-contract/indexed-assets";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { canonicalStringify, type CompiledProject } from "./index.js";

const canonicalIndexedAssets = (manifest: IndexedAssetManifest): IndexedAssetManifest => ({
  ...manifest,
  assets: [...manifest.assets]
    .sort((left, right) => left.assetId.localeCompare(right.assetId))
    .map((record) => ({
      ...record,
      frames: [...record.frames].sort((left, right) => left.frameId.localeCompare(right.frameId)),
    })),
});

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

export const attachIndexedAssets = (
  project: Pick<AdventureProject, "id">,
  compiled: CompiledProject,
  indexedAssets: IndexedAssetManifest,
): CompiledProject => {
  if (indexedAssets.projectId !== project.id) {
    throw new Error(
      `Indexed-asset project '${indexedAssets.projectId}' does not match '${project.id}'.`,
    );
  }
  const bundle = parseRuntimeBundle({
    ...compiled.bundle,
    indexedAssets: canonicalIndexedAssets(indexedAssets),
  });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: compiled.warnings,
  };
};
