import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  runtimeAdventureRpgPuzzleManifestSchema,
  type RuntimeAdventureRpgPuzzleManifest,
} from "@evavo/adventure-runtime-bundle/rpg-puzzles";
import type { RuntimeAdventureRpgManifest } from "@evavo/adventure-runtime-bundle/rpg";
import { canonicalStringify, type CompiledProject } from "./index.js";
import { compileProjectWithAdventureRpg } from "./with-rpg.js";

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

export const canonicaliseRuntimeAdventureRpgPuzzleManifest = (
  input: RuntimeAdventureRpgPuzzleManifest,
): RuntimeAdventureRpgPuzzleManifest => {
  const manifest = runtimeAdventureRpgPuzzleManifestSchema.parse(input);
  return {
    ...manifest,
    puzzles: [...manifest.puzzles]
      .map((puzzle) => ({
        ...puzzle,
        solutions: [...puzzle.solutions]
          .map((solution) => ({
            ...solution,
            classTagsAll: [...new Set(solution.classTagsAll)].sort((a, b) => a.localeCompare(b)),
            classTagsAny: [...new Set(solution.classTagsAny)].sort((a, b) => a.localeCompare(b)),
            requiredItemIds: [...new Set(solution.requiredItemIds)].sort((a, b) => a.localeCompare(b)),
            actions: [...solution.actions],
          }))
          .sort((left, right) => left.id.localeCompare(right.id)),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
};

export const attachRuntimeAdventureRpgPuzzles = (
  compiled: CompiledProject,
  input: RuntimeAdventureRpgPuzzleManifest,
): CompiledProject => {
  const manifest = canonicaliseRuntimeAdventureRpgPuzzleManifest(input);
  if (compiled.bundle.projectId !== manifest.projectId) {
    throw new Error(
      `Compiled project '${compiled.bundle.projectId}' does not match RPG puzzle project '${manifest.projectId}'.`,
    );
  }
  if (!compiled.bundle.rpg) {
    throw new Error("RPG puzzles require an RPG manifest to be attached first.");
  }
  const bundle = parseRuntimeBundle({ ...compiled.bundle, rpgPuzzles: manifest });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: compiled.warnings,
  };
};

export const compileProjectWithAdventureRpgPuzzles = (
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
  rpg: RuntimeAdventureRpgManifest,
  puzzles: RuntimeAdventureRpgPuzzleManifest,
): CompiledProject =>
  attachRuntimeAdventureRpgPuzzles(
    compileProjectWithAdventureRpg(project, assetManifest, rpg),
    puzzles,
  );
