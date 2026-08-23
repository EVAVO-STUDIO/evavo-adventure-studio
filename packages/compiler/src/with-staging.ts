import type { AdventureProject } from "@evavo/adventure-project-schema";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SceneInstanceManifest } from "@evavo/adventure-scene-instances";
import type { SceneStagingManifest } from "@evavo/adventure-scene-instances/staging";
import {
  type SceneStagingIssue,
  validateSceneStagingManifest,
} from "@evavo/adventure-scene-instances/staging-validation";
import { canonicalStringify, type CompiledProject } from "./index.js";

export class SceneStagingCompilationError extends Error {
  readonly issues: readonly SceneStagingIssue[];

  constructor(issues: readonly SceneStagingIssue[]) {
    super(`Scene staging compilation failed with ${issues.length} issue(s).`);
    this.name = "SceneStagingCompilationError";
    this.issues = issues;
  }
}

const canonicalSceneStaging = (manifest: SceneStagingManifest): SceneStagingManifest => ({
  ...manifest,
  scenes: [...manifest.scenes]
    .sort((left, right) => left.sceneId.localeCompare(right.sceneId))
    .map((scene) => ({
      ...scene,
      preferredWalkLanes: [...scene.preferredWalkLanes].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
      surfaceZones: [...scene.surfaceZones].sort((left, right) => left.id.localeCompare(right.id)),
      depthScaleCurves: [...scene.depthScaleCurves].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
      navigationScaleOverrides: [...scene.navigationScaleOverrides].sort((left, right) =>
        left.areaId.localeCompare(right.areaId),
      ),
      navigationStateModifiers: [...scene.navigationStateModifiers].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
      approachSlotsByObject: Object.fromEntries(
        Object.entries(scene.approachSlotsByObject)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([objectId, slots]) => [
            objectId,
            [...slots].sort((left, right) => left.id.localeCompare(right.id)),
          ]),
      ),
      interactionComfortRegionsByObject: Object.fromEntries(
        Object.entries(scene.interactionComfortRegionsByObject)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([objectId, regions]) => [
            objectId,
            [...regions].sort((left, right) => left.id.localeCompare(right.id)),
          ]),
      ),
      interactionChoreographies: [...scene.interactionChoreographies].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
      entryChoreographies: [...scene.entryChoreographies].sort((left, right) =>
        left.entranceId.localeCompare(right.entranceId),
      ),
      occlusionPlanes: [...scene.occlusionPlanes].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
      paletteLightZones: [...scene.paletteLightZones].sort((left, right) =>
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

export const attachSceneStaging = (
  project: AdventureProject,
  compiled: CompiledProject,
  staging: SceneStagingManifest,
  sceneInstances?: SceneInstanceManifest,
): CompiledProject => {
  const issues = validateSceneStagingManifest(
    {
      projectId: project.id,
      scenes: project.scenes,
      actors: project.actors,
      sequences: project.sequences,
      sceneInstances: sceneInstances ?? compiled.bundle.sceneInstances,
    },
    staging,
  );
  if (issues.length > 0) throw new SceneStagingCompilationError(issues);

  const bundle = parseRuntimeBundle({
    ...compiled.bundle,
    sceneStaging: canonicalSceneStaging(staging),
  });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: compiled.warnings,
  };
};

export type SceneStagingCompilationResult =
  | { readonly kind: "compiled"; readonly project: CompiledProject }
  | { readonly kind: "invalid"; readonly issues: readonly SceneStagingIssue[] };

export const tryAttachSceneStaging = (
  project: AdventureProject,
  compiled: CompiledProject,
  staging: SceneStagingManifest,
  sceneInstances?: SceneInstanceManifest,
): SceneStagingCompilationResult => {
  try {
    return { kind: "compiled", project: attachSceneStaging(project, compiled, staging, sceneInstances) };
  } catch (error) {
    if (error instanceof SceneStagingCompilationError) {
      return { kind: "invalid", issues: error.issues };
    }
    throw error;
  }
};
