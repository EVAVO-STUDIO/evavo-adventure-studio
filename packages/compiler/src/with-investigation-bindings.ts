import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  parseRuntimeBundle,
  runtimeInvestigationBindingManifestSchema,
  type RuntimeInvestigationBindingManifest,
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

const canonicalBindings = (
  input: RuntimeInvestigationBindingManifest,
): RuntimeInvestigationBindingManifest => ({
  ...input,
  interactions: [...input.interactions]
    .map((binding) => ({ ...binding, effects: [...binding.effects] }))
    .sort((left, right) => left.interactionId.localeCompare(right.interactionId)),
  dialogueChoices: [...input.dialogueChoices]
    .map((binding) => ({ ...binding, effects: [...binding.effects] }))
    .sort((left, right) => left.choiceId.localeCompare(right.choiceId)),
});

export const attachRuntimeInvestigationBindings = (
  compiled: CompiledProject,
  bindings: RuntimeInvestigationBindingManifest,
): CompiledProject => {
  const manifest = canonicalBindings(runtimeInvestigationBindingManifestSchema.parse(bindings));
  if (compiled.bundle.projectId !== manifest.projectId) {
    throw new Error(
      `Compiled project '${compiled.bundle.projectId}' does not match investigation-binding project '${manifest.projectId}'.`,
    );
  }
  const bundle = parseRuntimeBundle({
    ...compiled.bundle,
    investigationBindings: manifest,
  });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: compiled.warnings,
  };
};

export const compileProjectWithInvestigationBindings = (
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
  bindings: RuntimeInvestigationBindingManifest,
): CompiledProject => attachRuntimeInvestigationBindings(compileProject(project, assetManifest), bindings);
