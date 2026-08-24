import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  parseRuntimeBundle,
  runtimeAdventureRpgManifestSchema,
  type RuntimeAdventureRpgManifest,
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

const sortRecord = (input: Readonly<Record<string, number>> | undefined) =>
  input
    ? Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right)))
    : undefined;

export const canonicaliseRuntimeAdventureRpgManifest = (
  input: RuntimeAdventureRpgManifest,
): RuntimeAdventureRpgManifest => {
  const manifest = runtimeAdventureRpgManifestSchema.parse(input);
  return {
    ...manifest,
    classes: [...manifest.classes]
      .map((entry) => ({
        ...entry,
        ...(entry.startingStatBonuses ? { startingStatBonuses: sortRecord(entry.startingStatBonuses) } : {}),
        ...(entry.startingSkillBonuses ? { startingSkillBonuses: sortRecord(entry.startingSkillBonuses) } : {}),
        ...(entry.startingResourceBonuses ? { startingResourceBonuses: sortRecord(entry.startingResourceBonuses) } : {}),
        ...(entry.tags ? { tags: [...new Set(entry.tags)].sort((a, b) => a.localeCompare(b)) } : {}),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    stats: [...manifest.stats].sort((left, right) => left.id.localeCompare(right.id)),
    skills: [...manifest.skills].sort((left, right) => left.id.localeCompare(right.id)),
    resources: [...manifest.resources].sort((left, right) => left.id.localeCompare(right.id)),
  };
};

export const attachRuntimeAdventureRpg = (
  compiled: CompiledProject,
  input: RuntimeAdventureRpgManifest,
): CompiledProject => {
  const manifest = canonicaliseRuntimeAdventureRpgManifest(input);
  if (compiled.bundle.projectId !== manifest.projectId) {
    throw new Error(
      `Compiled project '${compiled.bundle.projectId}' does not match RPG project '${manifest.projectId}'.`,
    );
  }
  const bundle = parseRuntimeBundle({ ...compiled.bundle, rpg: manifest });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: compiled.warnings,
  };
};

export const compileProjectWithAdventureRpg = (
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
  manifest: RuntimeAdventureRpgManifest,
): CompiledProject => attachRuntimeAdventureRpg(compileProject(project, assetManifest), manifest);
