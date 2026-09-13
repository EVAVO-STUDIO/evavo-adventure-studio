import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  paletteMapManifestSchema,
  type PaletteMapManifest,
} from "@evavo/adventure-scene-instances/palette-maps";
import { CliDataError, type CliDiagnostic, errorCode, sortDiagnostics } from "./diagnostics.js";

export interface LoadedPaletteMaps {
  readonly path: string | null;
  readonly manifest: PaletteMapManifest | null;
  readonly diagnostics: readonly CliDiagnostic[];
}

const schemaPath = (path: readonly PropertyKey[]): string => {
  let output = "";
  for (const segment of path) {
    if (typeof segment === "number") output += `[${segment}]`;
    else output += output ? `.${String(segment)}` : String(segment);
  }
  return output || "$";
};

const schemaDiagnostics = (error: unknown): readonly CliDiagnostic[] => {
  if (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as { readonly issues: unknown }).issues)
  ) {
    return (error as { readonly issues: readonly unknown[] }).issues.map((issue) => {
      const candidate = issue as {
        readonly code?: unknown;
        readonly path?: readonly PropertyKey[];
        readonly message?: unknown;
      };
      return {
        severity: "error" as const,
        source: "palette-maps-schema" as const,
        code: String(candidate.code ?? "schema-invalid"),
        path: schemaPath(candidate.path ?? []),
        message: String(candidate.message ?? "Schema validation failed."),
      };
    });
  }
  return [
    {
      severity: "error",
      source: "palette-maps-schema",
      code: "schema-invalid",
      path: "$",
      message: error instanceof Error ? error.message : "Schema validation failed.",
    },
  ];
};

const loadManifestFile = async (path: string): Promise<PaletteMapManifest> => {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new CliDataError([
      {
        severity: "error",
        source: "palette-maps-file",
        code: errorCode(error) ?? "read-failed",
        path,
        message: `Unable to read '${path}': ${error instanceof Error ? error.message : String(error)}`,
      },
    ]);
  }

  let input: unknown;
  try {
    input = JSON.parse(text) as unknown;
  } catch (error) {
    throw new CliDataError([
      {
        severity: "error",
        source: "palette-maps-file",
        code: "invalid-json",
        path,
        message: `Invalid JSON in '${path}': ${error instanceof Error ? error.message : String(error)}`,
      },
    ]);
  }

  try {
    return paletteMapManifestSchema.parse(input);
  } catch (error) {
    throw new CliDataError(schemaDiagnostics(error));
  }
};

export const loadPaletteMaps = async (
  inputPath: string | null,
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
): Promise<LoadedPaletteMaps> => {
  if (!inputPath) return { path: null, manifest: null, diagnostics: [] };
  const path = resolve(inputPath);
  const manifest = await loadManifestFile(path);
  const diagnostics: CliDiagnostic[] = [];

  if (manifest.projectId !== project.id || assetManifest.projectId !== project.id) {
    diagnostics.push({
      severity: "error",
      source: "palette-maps-semantics",
      code: "project-mismatch",
      path: "projectId",
      message: `Palette maps, asset manifest and project must all target '${project.id}'.`,
    });
  }

  const assetsById = new Map(assetManifest.assets.map((asset) => [asset.assetId as string, asset] as const));
  manifest.maps.forEach((map, index) => {
    const palette = assetsById.get(map.paletteAssetId);
    if (!palette) {
      diagnostics.push({
        severity: "error",
        source: "palette-maps-semantics",
        code: "palette-missing",
        path: `maps[${index}].paletteAssetId`,
        message: `Palette map '${map.id}' references missing asset '${map.paletteAssetId}'.`,
      });
      return;
    }
    if (palette.kind !== "palette") {
      diagnostics.push({
        severity: "error",
        source: "palette-maps-semantics",
        code: "palette-kind-mismatch",
        path: `maps[${index}].paletteAssetId`,
        message: `Palette map '${map.id}' references '${palette.kind}', expected a palette asset.`,
      });
      return;
    }
    if (!palette.outputFiles.some((output) => output.role === "primary")) {
      diagnostics.push({
        severity: "error",
        source: "palette-maps-semantics",
        code: "palette-primary-output-missing",
        path: `maps[${index}].paletteAssetId`,
        message: `Palette '${palette.assetId}' has no primary runtime output.`,
      });
    }
    if (map.paletteOffset + palette.metadata.entries > 256) {
      diagnostics.push({
        severity: "error",
        source: "palette-maps-semantics",
        code: "palette-offset-overflow",
        path: `maps[${index}].paletteOffset`,
        message: `Palette map '${map.id}' exceeds the 0–255 indexed palette space.`,
      });
    }
  });

  return { path, manifest, diagnostics: sortDiagnostics(diagnostics) };
};
