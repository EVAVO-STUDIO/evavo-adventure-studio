import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  parseRuntimeBundle,
  RuntimeInvestigationValidationError,
  runtimeInvestigationManifestSchema,
  validateRuntimeInvestigation,
  type RuntimeInvestigationManifest,
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

const byId = <T extends { readonly id: string }>(items: readonly T[]): T[] =>
  [...items].sort((left, right) => left.id.localeCompare(right.id));

export const canonicaliseRuntimeInvestigationManifest = (
  input: RuntimeInvestigationManifest,
): RuntimeInvestigationManifest => {
  const manifest = runtimeInvestigationManifestSchema.parse(input);
  return runtimeInvestigationManifestSchema.parse({
    ...manifest,
    facts: byId(manifest.facts).map((fact) => ({
      ...fact,
      ...(fact.unlockTopicIds
        ? { unlockTopicIds: [...fact.unlockTopicIds].sort((left, right) => left.localeCompare(right)) }
        : {}),
    })),
    topics: byId(manifest.topics).map((topic) => ({
      ...topic,
      ...(topic.requiresFactIds
        ? { requiresFactIds: [...topic.requiresFactIds].sort((left, right) => left.localeCompare(right)) }
        : {}),
      ...(topic.revealFactIds
        ? { revealFactIds: [...topic.revealFactIds].sort((left, right) => left.localeCompare(right)) }
        : {}),
    })),
    researchSources: byId(manifest.researchSources).map((source) => ({
      ...source,
      availableChapterIds: [...source.availableChapterIds].sort((left, right) => left.localeCompare(right)),
      ...(source.requiresFactIds
        ? { requiresFactIds: [...source.requiresFactIds].sort((left, right) => left.localeCompare(right)) }
        : {}),
      ...(source.revealFactIds
        ? { revealFactIds: [...source.revealFactIds].sort((left, right) => left.localeCompare(right)) }
        : {}),
      ...(source.revealTopicIds
        ? { revealTopicIds: [...source.revealTopicIds].sort((left, right) => left.localeCompare(right)) }
        : {}),
    })),
    chapters: [...manifest.chapters]
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
      .map((chapter) => ({
        ...chapter,
        objectives: byId(chapter.objectives).map((objective) => ({
          ...objective,
          requirements: [...objective.requirements].sort((left, right) =>
            canonicalStringify(left).localeCompare(canonicalStringify(right)),
          ),
        })),
      })),
    ...(manifest.presenceVariants
      ? {
          presenceVariants: byId(manifest.presenceVariants).map((variant) => ({
            ...variant,
            chapterIds: [...variant.chapterIds].sort((left, right) => left.localeCompare(right)),
          })),
        }
      : {}),
  });
};

export const attachRuntimeInvestigation = (
  compiled: CompiledProject,
  investigation: RuntimeInvestigationManifest,
): CompiledProject => {
  const manifest = canonicaliseRuntimeInvestigationManifest(investigation);
  if (compiled.bundle.projectId !== manifest.projectId) {
    throw new Error(
      `Compiled project '${compiled.bundle.projectId}' does not match investigation project '${manifest.projectId}'.`,
    );
  }
  const issues = validateRuntimeInvestigation(manifest);
  if (issues.length > 0) throw new RuntimeInvestigationValidationError(issues);
  const bundle = parseRuntimeBundle({ ...compiled.bundle, investigation: manifest });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: compiled.warnings,
  };
};

export const compileProjectWithInvestigation = (
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
  investigation: RuntimeInvestigationManifest,
): CompiledProject => attachRuntimeInvestigation(compileProject(project, assetManifest), investigation);
