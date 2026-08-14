import type { AudioMixManifest } from "@evavo/adventure-audio";
import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { BitmapFontManifest } from "@evavo/adventure-bitmap-font";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import type { LocalisationManifest } from "@evavo/adventure-project-schema/localisation";
import {
  createRuntimeLocalisationPack,
  parseRuntimeBundle,
} from "@evavo/adventure-runtime-bundle";
import type { UiSkinManifest } from "@evavo/adventure-ui-skin";
import {
  canonicalStringify,
  compileProject,
  type CompiledProject,
} from "./index.js";

export interface LocalisedCompilationSidecars {
  readonly bitmapFonts?: BitmapFontManifest;
  readonly uiSkins?: UiSkinManifest;
  readonly audioMix?: AudioMixManifest;
  readonly defaultLocale?: string;
}

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

export const attachRuntimeLocalisation = (
  compiled: CompiledProject,
  project: AdventureProject,
  localisation: LocalisationManifest,
  defaultLocale = localisation.sourceLocale,
): CompiledProject => {
  if (compiled.bundle.projectId !== project.id) {
    throw new Error(
      `Compiled project '${compiled.bundle.projectId}' does not match localisation source '${project.id}'.`,
    );
  }
  const bundle = parseRuntimeBundle({
    ...compiled.bundle,
    localisation: createRuntimeLocalisationPack(project, localisation, defaultLocale),
  });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: compiled.warnings,
  };
};

export const compileProjectWithLocalisation = (
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
  localisation: LocalisationManifest,
  sidecars: LocalisedCompilationSidecars = {},
): CompiledProject =>
  attachRuntimeLocalisation(
    compileProject(
      project,
      assetManifest,
      sidecars.bitmapFonts,
      sidecars.uiSkins,
      sidecars.audioMix,
    ),
    project,
    localisation,
    sidecars.defaultLocale ?? localisation.sourceLocale,
  );
