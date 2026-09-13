import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  parseRuntimeBundle,
  type RuntimeBundle,
} from "@evavo/adventure-runtime-bundle";
import {
  runtimeAdventureRouteTopologyManifestSchema,
  type RuntimeAdventureRouteTopologyManifest,
} from "@evavo/adventure-runtime-bundle/route-topology";
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
  input: RuntimeAdventureRouteTopologyManifest,
): RuntimeAdventureRouteTopologyManifest => ({
  ...input,
  routes: [...input.routes].sort((left, right) => left.id.localeCompare(right.id)),
  nodes: [...input.nodes]
    .map((node) => ({ ...node, tags: [...node.tags].sort((left, right) => left.localeCompare(right)) }))
    .sort((left, right) => left.id.localeCompare(right.id)),
  edges: [...input.edges]
    .map((edge) => ({ ...edge, actions: [...edge.actions] }))
    .sort((left, right) => left.id.localeCompare(right.id)),
});

export const attachRuntimeAdventureRouteTopology = (
  compiled: CompiledProject,
  manifestInput: RuntimeAdventureRouteTopologyManifest,
): CompiledProject => {
  const manifest = canonicalManifest(runtimeAdventureRouteTopologyManifestSchema.parse(manifestInput));
  if (manifest.projectId !== compiled.bundle.projectId) {
    throw new Error(
      `Compiled project '${compiled.bundle.projectId}' does not match route topology project '${manifest.projectId}'.`,
    );
  }
  const bundle: RuntimeBundle = parseRuntimeBundle({
    ...compiled.bundle,
    routeTopology: manifest,
  });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: compiled.warnings,
  };
};

export const compileProjectWithAdventureRouteTopology = (
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
  routeTopology: RuntimeAdventureRouteTopologyManifest,
): CompiledProject => attachRuntimeAdventureRouteTopology(compileProject(project, assetManifest), routeTopology);
