import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  parseRuntimeBundle,
  runtimeRoomScriptManifestSchema,
  type RuntimeRoomScriptManifest,
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

export const canonicaliseRuntimeRoomScriptManifest = (
  manifest: RuntimeRoomScriptManifest,
): RuntimeRoomScriptManifest => ({
  ...manifest,
  scripts: [...manifest.scripts]
    .map((script) => ({ ...script, actions: [...script.actions] }))
    .sort((left, right) => left.id.localeCompare(right.id)),
});

export const attachRuntimeRoomScripts = (
  compiled: CompiledProject,
  input: RuntimeRoomScriptManifest,
): CompiledProject => {
  const manifest = canonicaliseRuntimeRoomScriptManifest(runtimeRoomScriptManifestSchema.parse(input));
  if (compiled.bundle.projectId !== manifest.projectId) {
    throw new Error(
      `Compiled project '${compiled.bundle.projectId}' does not match room-script project '${manifest.projectId}'.`,
    );
  }
  const bundle = parseRuntimeBundle({ ...compiled.bundle, roomScripts: manifest });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: compiled.warnings,
  };
};

export const compileProjectWithRoomScripts = (
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
  manifest: RuntimeRoomScriptManifest,
): CompiledProject => attachRuntimeRoomScripts(compileProject(project, assetManifest), manifest);
