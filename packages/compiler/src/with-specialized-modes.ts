import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  parseRuntimeBundle,
  runtimeSpecializedAdventureModeManifestSchema,
  type RuntimeSpecializedAdventureModeManifest,
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
  manifest: RuntimeSpecializedAdventureModeManifest,
): RuntimeSpecializedAdventureModeManifest => ({
  ...manifest,
  modes: [...manifest.modes]
    .map((mode) => ({
      ...mode,
      states: [...mode.states]
        .map((state) => ({
          ...state,
          ...(state.inputRegions
            ? {
                inputRegions: [...state.inputRegions].sort((left, right) => left.id.localeCompare(right.id)),
              }
            : {}),
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    }))
    .sort((left, right) => left.id.localeCompare(right.id)),
});

export const attachRuntimeSpecializedModes = (
  compiled: CompiledProject,
  input: RuntimeSpecializedAdventureModeManifest,
): CompiledProject => {
  const manifest = canonicalManifest(runtimeSpecializedAdventureModeManifestSchema.parse(input));
  if (compiled.bundle.projectId !== manifest.projectId) {
    throw new Error(
      `Compiled project '${compiled.bundle.projectId}' does not match specialized-mode project '${manifest.projectId}'.`,
    );
  }
  const bundle = parseRuntimeBundle({
    ...compiled.bundle,
    specializedModes: manifest,
  });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: compiled.warnings,
  };
};

export const compileProjectWithSpecializedModes = (
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
  manifest: RuntimeSpecializedAdventureModeManifest,
): CompiledProject => attachRuntimeSpecializedModes(compileProject(project, assetManifest), manifest);
