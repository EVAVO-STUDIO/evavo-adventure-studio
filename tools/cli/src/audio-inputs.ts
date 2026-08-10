import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  type AudioMixManifest,
  parseAudioMixManifest,
  validateAudioMixManifest,
} from "@evavo/adventure-audio";
import { validateCompiledAudioMappings } from "@evavo/adventure-audio/compiled-mapping";
import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  CliDataError,
  type CliDiagnostic,
  errorCode,
  sortDiagnostics,
} from "./diagnostics.js";

export interface LoadedAudioMix {
  readonly path: string | null;
  readonly manifest: AudioMixManifest | null;
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
          source: "audio-mix-schema" as const,
          code: String(candidate.code ?? "schema-invalid"),
          path: schemaPath(candidate.path ?? []),
          message: String(
            candidate.message ?? "Audio mix schema validation failed.",
          ),
        };
      },
    );
  }
  return [
    {
      severity: "error",
      source: "audio-mix-schema",
      code: "schema-invalid",
      path: "$",
      message:
        error instanceof Error
          ? error.message
          : "Audio mix schema validation failed.",
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
        source: "audio-mix-file",
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
        source: "audio-mix-file",
        code: "invalid-json",
        path,
        message: `Invalid JSON in '${path}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    ]);
  }
};

export const loadAudioMix = async (
  inputPath: string | null,
  project: AdventureProject,
  assetManifest: AssetBuildManifest | null,
): Promise<LoadedAudioMix> => {
  if (!inputPath) {
    return { path: null, manifest: null, diagnostics: [] };
  }

  const path = resolve(inputPath);
  const input = await readJson(path);
  let manifest: AudioMixManifest;
  try {
    manifest = parseAudioMixManifest(input);
  } catch (error) {
    throw new CliDataError(schemaDiagnostics(error));
  }

  const diagnostics: CliDiagnostic[] = validateAudioMixManifest(
    project,
    manifest,
  ).map((issue) => ({
    severity: issue.severity,
    source: "audio-mix-semantics",
    code: issue.code,
    path: issue.path,
    message: issue.message,
  }));

  if (assetManifest) {
    diagnostics.push(
      ...validateCompiledAudioMappings(project, manifest, assetManifest).map(
        (issue): CliDiagnostic => ({
          severity: issue.severity,
          source: "audio-mix-semantics",
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

export const audioMixInputPaths = (
  loaded: LoadedAudioMix,
): readonly string[] => (loaded.path ? [loaded.path] : []);
