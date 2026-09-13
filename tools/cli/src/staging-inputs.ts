import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import type { SceneInstanceManifest } from "@evavo/adventure-scene-instances";
import {
  sceneStagingManifestSchema,
  type SceneStagingManifest,
} from "@evavo/adventure-scene-instances/staging";
import { validateSceneStagingManifest } from "@evavo/adventure-scene-instances/staging-validation";
import { CliDataError, type CliDiagnostic, errorCode, sortDiagnostics } from "./diagnostics.js";

export interface LoadedSceneStaging {
  readonly path: string | null;
  readonly manifest: SceneStagingManifest | null;
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
        source: "scene-staging-schema" as const,
        code: String(candidate.code ?? "schema-invalid"),
        path: schemaPath(candidate.path ?? []),
        message: String(candidate.message ?? "Schema validation failed."),
      };
    });
  }
  return [
    {
      severity: "error",
      source: "scene-staging-schema",
      code: "schema-invalid",
      path: "$",
      message: error instanceof Error ? error.message : "Schema validation failed.",
    },
  ];
};

const loadManifestFile = async (path: string): Promise<SceneStagingManifest> => {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new CliDataError([
      {
        severity: "error",
        source: "scene-staging-file",
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
        source: "scene-staging-file",
        code: "invalid-json",
        path,
        message: `Invalid JSON in '${path}': ${error instanceof Error ? error.message : String(error)}`,
      },
    ]);
  }

  try {
    return sceneStagingManifestSchema.parse(input);
  } catch (error) {
    throw new CliDataError(schemaDiagnostics(error));
  }
};

export const loadSceneStaging = async (
  inputPath: string | null,
  project: AdventureProject,
  sceneInstances: SceneInstanceManifest,
): Promise<LoadedSceneStaging> => {
  if (!inputPath) return { path: null, manifest: null, diagnostics: [] };

  const path = resolve(inputPath);
  const manifest = await loadManifestFile(path);
  const diagnostics = validateSceneStagingManifest(
    {
      projectId: project.id,
      scenes: project.scenes,
      actors: project.actors,
      assets: project.assets,
      sequences: project.sequences,
      sceneInstances,
    },
    manifest,
  ).map((issue) => ({
    ...issue,
    source: "scene-staging-semantics" as const,
  }));

  return { path, manifest, diagnostics: sortDiagnostics(diagnostics) };
};
