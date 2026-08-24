import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  parseRuntimeBundle,
  runtimeMultiProtagonistManifestSchema,
  type RuntimeMultiProtagonistManifest,
} from "@evavo/adventure-runtime-bundle";
import { canonicalStringify, compileProject, type CompiledProject } from "./index.js";

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

const canonicalManifest = (
  manifest: RuntimeMultiProtagonistManifest,
): RuntimeMultiProtagonistManifest => ({
  ...manifest,
  protagonists: [...manifest.protagonists]
    .map((entry) => ({
      ...entry,
      startingInventory: [...entry.startingInventory].sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.protagonistId.localeCompare(right.protagonistId)),
});

export const attachRuntimeMultiProtagonist = (
  compiled: CompiledProject,
  input: RuntimeMultiProtagonistManifest,
): CompiledProject => {
  const manifest = canonicalManifest(runtimeMultiProtagonistManifestSchema.parse(input));
  if (compiled.bundle.projectId !== manifest.projectId) {
    throw new Error(
      `Compiled project '${compiled.bundle.projectId}' does not match multi-protagonist project '${manifest.projectId}'.`,
    );
  }
  const bundle = parseRuntimeBundle({
    ...compiled.bundle,
    multiProtagonist: manifest,
  });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: compiled.warnings,
  };
};

export const compileProjectWithMultiProtagonist = (
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
  manifest: RuntimeMultiProtagonistManifest,
): CompiledProject => attachRuntimeMultiProtagonist(compileProject(project, assetManifest), manifest);
