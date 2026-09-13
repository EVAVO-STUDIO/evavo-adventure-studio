import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  parseRuntimeBundle,
  runtimeMultiProtagonistBindingManifestSchema,
  type RuntimeMultiProtagonistBindingManifest,
  type RuntimeMultiProtagonistManifest,
} from "@evavo/adventure-runtime-bundle";
import { canonicalStringify, compileProject, type CompiledProject } from "./index.js";
import { attachRuntimeMultiProtagonist } from "./with-multi-protagonist.js";

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

export const canonicaliseRuntimeMultiProtagonistBindingManifest = (
  manifest: RuntimeMultiProtagonistBindingManifest,
): RuntimeMultiProtagonistBindingManifest => ({
  ...manifest,
  bindings: [...manifest.bindings]
    .map((binding) => ({ ...binding, effects: [...binding.effects] }))
    .sort((left, right) => left.id.localeCompare(right.id)),
});

export const attachRuntimeMultiProtagonistBindings = (
  compiled: CompiledProject,
  input: RuntimeMultiProtagonistBindingManifest,
): CompiledProject => {
  const manifest = canonicaliseRuntimeMultiProtagonistBindingManifest(
    runtimeMultiProtagonistBindingManifestSchema.parse(input),
  );
  if (compiled.bundle.projectId !== manifest.projectId) {
    throw new Error(
      `Compiled project '${compiled.bundle.projectId}' does not match multi-protagonist-binding project '${manifest.projectId}'.`,
    );
  }
  const bundle = parseRuntimeBundle({ ...compiled.bundle, multiProtagonistBindings: manifest });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: compiled.warnings,
  };
};

export const compileProjectWithMultiProtagonistBindings = (
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
  multiProtagonist: RuntimeMultiProtagonistManifest,
  bindings: RuntimeMultiProtagonistBindingManifest,
): CompiledProject =>
  attachRuntimeMultiProtagonistBindings(
    attachRuntimeMultiProtagonist(compileProject(project, assetManifest), multiProtagonist),
    bindings,
  );
