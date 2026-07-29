import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  emptySceneInstanceManifest,
  validateSceneInstanceManifest,
  type SceneInstanceIssue,
  type SceneInstanceManifest,
} from "@evavo/adventure-scene-instances";
import {
  validateCompiledObjectVisualMappings,
  type CompiledObjectVisualIssue,
} from "@evavo/adventure-scene-instances/compiled-mapping";
import {
  canonicalStringify,
  compileProject,
  type CompiledProject,
} from "./index.js";

export type SceneInstanceCompilationIssue =
  | SceneInstanceIssue
  | CompiledObjectVisualIssue;

export class SceneInstanceCompilationError extends Error {
  readonly issues: readonly SceneInstanceCompilationIssue[];

  constructor(issues: readonly SceneInstanceCompilationIssue[]) {
    super(`Scene composition compilation failed with ${issues.length} issue(s).`);
    this.name = "SceneInstanceCompilationError";
    this.issues = issues;
  }
}

const canonicalSceneInstances = (
  manifest: SceneInstanceManifest,
): SceneInstanceManifest => ({
  ...manifest,
  objectDefinitions: [...manifest.objectDefinitions]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((definition) => ({
      ...definition,
      states: [...definition.states].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    })),
  scenes: [...manifest.scenes]
    .sort((left, right) => left.sceneId.localeCompare(right.sceneId))
    .map((composition) => ({
      ...composition,
      actorInstances: [...composition.actorInstances].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
      objectInstances: [...composition.objectInstances].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
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

export const compileProjectWithInstances = (
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
  sceneInstances: SceneInstanceManifest = emptySceneInstanceManifest(project.id),
): CompiledProject => {
  const instanceIssues = validateSceneInstanceManifest(
    {
      projectId: project.id,
      scenes: project.scenes,
      actors: project.actors,
      assets: project.assets,
    },
    sceneInstances,
  );
  const visualIssues = validateCompiledObjectVisualMappings(
    sceneInstances,
    assetManifest,
  );
  const issues: SceneInstanceCompilationIssue[] = [
    ...instanceIssues,
    ...visualIssues,
  ];
  if (issues.length > 0) {
    throw new SceneInstanceCompilationError(issues);
  }

  const base = compileProject(project, assetManifest);
  const bundle = parseRuntimeBundle({
    ...base.bundle,
    sceneInstances: canonicalSceneInstances(sceneInstances),
  });
  const canonicalJson = canonicalStringify(bundle);

  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: base.warnings,
  };
};

export type SceneInstanceCompilationResult =
  | { readonly kind: "compiled"; readonly project: CompiledProject }
  | {
      readonly kind: "invalid";
      readonly issues: readonly SceneInstanceCompilationIssue[];
    };

export const tryCompileProjectWithInstances = (
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
  sceneInstances?: SceneInstanceManifest,
): SceneInstanceCompilationResult => {
  try {
    return {
      kind: "compiled",
      project: compileProjectWithInstances(project, assetManifest, sceneInstances),
    };
  } catch (error) {
    if (error instanceof SceneInstanceCompilationError) {
      return { kind: "invalid", issues: error.issues };
    }
    throw error;
  }
};
