import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  parseRuntimeBundle,
  runtimeItemCombinationManifestSchema,
  type RuntimeItemCombinationManifest,
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
  manifest: RuntimeItemCombinationManifest,
): RuntimeItemCombinationManifest => ({
  ...manifest,
  recipes: [...manifest.recipes]
    .map((recipe) => ({ ...recipe, actions: [...recipe.actions] }))
    .sort((left, right) => left.id.localeCompare(right.id)),
});

export const attachRuntimeItemCombinations = (
  compiled: CompiledProject,
  itemCombinations: RuntimeItemCombinationManifest,
): CompiledProject => {
  const manifest = canonicalManifest(runtimeItemCombinationManifestSchema.parse(itemCombinations));
  if (compiled.bundle.projectId !== manifest.projectId) {
    throw new Error(
      `Compiled project '${compiled.bundle.projectId}' does not match item-combination project '${manifest.projectId}'.`,
    );
  }
  const bundle = parseRuntimeBundle({ ...compiled.bundle, itemCombinations: manifest });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: compiled.warnings,
  };
};

export const compileProjectWithItemCombinations = (
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
  itemCombinations: RuntimeItemCombinationManifest,
): CompiledProject => attachRuntimeItemCombinations(compileProject(project, assetManifest), itemCombinations);
