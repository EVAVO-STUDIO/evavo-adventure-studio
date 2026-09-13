import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  type GameOpeningIssue,
  type GameOpeningManifest,
  parseGameOpeningManifest,
  validateGameOpeningManifest,
} from "@evavo/adventure-project-schema/opening";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
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

export class GameOpeningCompilationError extends Error {
  readonly issues: readonly GameOpeningIssue[];

  constructor(issues: readonly GameOpeningIssue[]) {
    super(`Game opening compilation failed with ${issues.length} issue(s).`);
    this.name = "GameOpeningCompilationError";
    this.issues = issues;
  }
}

export const attachRuntimeOpening = (
  compiled: CompiledProject,
  opening: GameOpeningManifest,
): CompiledProject => {
  const manifest = parseGameOpeningManifest(opening);
  const issues = validateGameOpeningManifest(
    { id: compiled.bundle.projectId, sequences: compiled.bundle.sequences },
    manifest,
  );
  if (issues.length > 0) throw new GameOpeningCompilationError(issues);

  const bundle = parseRuntimeBundle({
    ...compiled.bundle,
    opening: manifest,
  });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: compiled.warnings,
  };
};

export const compileProjectWithOpening = (
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
  opening: GameOpeningManifest,
): CompiledProject => attachRuntimeOpening(compileProject(project, assetManifest), opening);
