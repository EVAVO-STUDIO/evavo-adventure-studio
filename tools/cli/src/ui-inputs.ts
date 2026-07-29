import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { BitmapFontManifest } from "@evavo/adventure-bitmap-font";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  parseUiSkinManifest,
  validateUiSkinManifest,
  type UiSkinManifest,
} from "@evavo/adventure-ui-skin";
import {
  CliDataError,
  errorCode,
  sortDiagnostics,
  type CliDiagnostic,
} from "./diagnostics.js";

export interface LoadedUiSkins {
  readonly path: string | null;
  readonly manifest: UiSkinManifest | null;
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
          source: "ui-skins-schema" as const,
          code: String(candidate.code ?? "schema-invalid"),
          path: schemaPath(candidate.path ?? []),
          message: String(candidate.message ?? "Interface skin schema validation failed."),
        };
      },
    );
  }
  return [
    {
      severity: "error",
      source: "ui-skins-schema",
      code: "schema-invalid",
      path: "$",
      message:
        error instanceof Error
          ? error.message
          : "Interface skin schema validation failed.",
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
        source: "ui-skins-file",
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
        source: "ui-skins-file",
        code: "invalid-json",
        path,
        message: `Invalid JSON in '${path}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    ]);
  }
};

export const loadUiSkins = async (
  inputPath: string | null,
  project: AdventureProject,
  bitmapFonts: BitmapFontManifest | null,
): Promise<LoadedUiSkins> => {
  if (!inputPath) {
    return { path: null, manifest: null, diagnostics: [] };
  }

  const path = resolve(inputPath);
  const input = await readJson(path);
  let manifest: UiSkinManifest;
  try {
    manifest = parseUiSkinManifest(input);
  } catch (error) {
    throw new CliDataError(schemaDiagnostics(error));
  }

  return {
    path,
    manifest,
    diagnostics: sortDiagnostics(
      validateUiSkinManifest(project, bitmapFonts, manifest).map(
        (issue): CliDiagnostic => ({
          severity: issue.severity,
          source: "ui-skins-semantics",
          code: issue.code,
          path: issue.path,
          message: issue.message,
        }),
      ),
    ),
  };
};

export const uiSkinInputPaths = (
  loaded: LoadedUiSkins,
): readonly string[] => (loaded.path ? [loaded.path] : []);
