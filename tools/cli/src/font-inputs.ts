import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import {
  parseBitmapFontManifest,
  validateBitmapFontManifest,
  type BitmapFontManifest,
} from "@evavo/adventure-bitmap-font";
import { validateCompiledBitmapFontMappings } from "@evavo/adventure-bitmap-font/compiled-mapping";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  CliDataError,
  errorCode,
  sortDiagnostics,
  type CliDiagnostic,
} from "./diagnostics.js";

export interface LoadedBitmapFonts {
  readonly path: string | null;
  readonly manifest: BitmapFontManifest | null;
  readonly diagnostics: readonly CliDiagnostic[];
}

const schemaPath = (path: readonly PropertyKey[]): string => {
  let output = "";
  for (const segment of path) {
    output +=
      typeof segment === "number"
        ? `[${segment}]`
        : output
          ? `.${String(segment)}`
          : String(segment);
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
    return (error as { readonly issues: readonly unknown[] }).issues.map(
      (issue) => {
        const candidate = issue as {
          readonly code?: unknown;
          readonly path?: readonly PropertyKey[];
          readonly message?: unknown;
        };
        return {
          severity: "error" as const,
          source: "bitmap-fonts-schema" as const,
          code: String(candidate.code ?? "schema-invalid"),
          path: schemaPath(candidate.path ?? []),
          message: String(candidate.message ?? "Bitmap font schema validation failed."),
        };
      },
    );
  }
  return [
    {
      severity: "error",
      source: "bitmap-fonts-schema",
      code: "schema-invalid",
      path: "$",
      message:
        error instanceof Error
          ? error.message
          : "Bitmap font schema validation failed.",
    },
  ];
};

const readJson = async (path: string): Promise<unknown> => {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new CliDataError([
      {
        severity: "error",
        source: "bitmap-fonts-file",
        code: errorCode(error) ?? "read-failed",
        path,
        message: `Unable to read '${path}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    ]);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new CliDataError([
      {
        severity: "error",
        source: "bitmap-fonts-file",
        code: "invalid-json",
        path,
        message: `Invalid JSON in '${path}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    ]);
  }
};

export const loadBitmapFonts = async (
  inputPath: string | null,
  project: AdventureProject,
  assetManifest: AssetBuildManifest | null,
): Promise<LoadedBitmapFonts> => {
  if (!inputPath) {
    return { path: null, manifest: null, diagnostics: [] };
  }

  const path = resolve(inputPath);
  const input = await readJson(path);
  let manifest: BitmapFontManifest;
  try {
    manifest = parseBitmapFontManifest(input);
  } catch (error) {
    throw new CliDataError(schemaDiagnostics(error));
  }

  const diagnostics: CliDiagnostic[] = validateBitmapFontManifest(
    project,
    manifest,
  ).map((issue) => ({
    severity: issue.severity,
    source: "bitmap-fonts-semantics",
    code: issue.code,
    path: issue.path,
    message: issue.message,
  }));

  if (assetManifest) {
    diagnostics.push(
      ...validateCompiledBitmapFontMappings(manifest, assetManifest).map(
        (issue): CliDiagnostic => ({
          severity: issue.severity,
          source: "bitmap-fonts-semantics",
          code: issue.code,
          path: issue.path,
          message: issue.message,
        }),
      ),
    );
  }

  return {
    path,
    manifest,
    diagnostics: sortDiagnostics(diagnostics),
  };
};

export const bitmapFontInputPaths = (
  loaded: LoadedBitmapFonts,
): readonly string[] => (loaded.path ? [loaded.path] : []);
