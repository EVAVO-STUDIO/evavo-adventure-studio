import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  canonicaliseGameLifecycleManifest,
  type GameLifecycleManifest,
  parseGameLifecycleManifest,
} from "@evavo/adventure-project-schema/lifecycle";
import { extractLifecycleLocalisableText } from "@evavo/adventure-project-schema/localisation";
import {
  extendRuntimeLocalisationPack,
  parseRuntimeBundle,
} from "@evavo/adventure-runtime-bundle";
import {
  canonicalStringify,
  compileProject,
  type CompiledProject,
} from "./index.js";

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

export const attachRuntimeLifecycle = (
  compiled: CompiledProject,
  lifecycle: GameLifecycleManifest,
): CompiledProject => {
  const manifest = canonicaliseGameLifecycleManifest(parseGameLifecycleManifest(lifecycle));
  if (compiled.bundle.projectId !== manifest.projectId) {
    throw new Error(
      `Compiled project '${compiled.bundle.projectId}' does not match lifecycle project '${manifest.projectId}'.`,
    );
  }
  const localisation = compiled.bundle.localisation
    ? extendRuntimeLocalisationPack(
        compiled.bundle.localisation,
        extractLifecycleLocalisableText(manifest),
      )
    : null;
  const bundle = parseRuntimeBundle({
    ...compiled.bundle,
    lifecycle: manifest,
    ...(localisation ? { localisation } : {}),
  });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: compiled.warnings,
  };
};

export const compileProjectWithLifecycle = (
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
  lifecycle: GameLifecycleManifest,
): CompiledProject => attachRuntimeLifecycle(compileProject(project, assetManifest), lifecycle);
