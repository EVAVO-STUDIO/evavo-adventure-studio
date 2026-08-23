import type { AdventureProject } from "@evavo/adventure-project-schema";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { PaletteMapManifest } from "@evavo/adventure-scene-instances/palette-maps";
import { canonicalStringify, type CompiledProject } from "./index.js";

const canonicalPaletteMaps = (manifest: PaletteMapManifest): PaletteMapManifest => ({
  ...manifest,
  maps: [...manifest.maps].sort((left, right) => left.id.localeCompare(right.id)),
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

export const attachPaletteMaps = (
  project: Pick<AdventureProject, "id">,
  compiled: CompiledProject,
  paletteMaps: PaletteMapManifest,
): CompiledProject => {
  if (paletteMaps.projectId !== project.id) {
    throw new Error(
      `Palette-map project '${paletteMaps.projectId}' does not match '${project.id}'.`,
    );
  }
  const bundle = parseRuntimeBundle({
    ...compiled.bundle,
    paletteMaps: canonicalPaletteMaps(paletteMaps),
  });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: compiled.warnings,
  };
};
