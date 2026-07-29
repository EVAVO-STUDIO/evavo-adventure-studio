import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  emptySceneInstanceManifest,
  parseSceneInstanceManifest,
  validateSceneInstanceManifest,
  type SceneInstanceManifest,
} from "@evavo/adventure-scene-instances";
import { validateCompiledObjectVisualMappings } from "@evavo/adventure-scene-instances/compiled-mapping";
import {
  CliDataError,
  errorCode,
  sortDiagnostics,
  type CliDiagnostic,
} from "./diagnostics.js";

export interface LoadedSceneInstances {
  readonly path: string | null;
  readonly manifest: SceneInstanceManifest;
  readonly diagnostics: readonly CliDiagnostic[];
}

const schemaPath = (path: readonly PropertyKey[]): string => {
  let output = "";
  for (const segment of path) {
    if (typeof segment === "number") {
      output += `[${segment}]`;
    } else {
      output += output ? `.${String(segment)}` : String(segment);
    }
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
          source: "scene-instances-schema" as const,
          code: String(candidate.code ?? "schema-invalid"),
          path: schemaPath(candidate.path ?? []),
          message: String(candidate.message ?? "Schema validation failed."),
        };
      },
    );
  }

  return [
    {
      severity: "error",
      source: "scene-instances-schema",
      code: "schema-invalid",
      path: "$",
      message:
        error instanceof Error ? error.message : "Schema validation failed.",
    },
  ];
};

const loadManifestFile = async (path: string): Promise<SceneInstanceManifest> => {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new CliDataError([
      {
        severity: "error",
        source: "scene-instances-file",
        code: errorCode(error) ?? "read-failed",
        path,
        message: `Unable to read '${path}': ${
          error instanceof Error ? error.message : String(error)
        }`,
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
        source: "scene-instances-file",
        code: "invalid-json",
        path,
        message: `Invalid JSON in '${path}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    ]);
  }

  try {
    return parseSceneInstanceManifest(input);
  } catch (error) {
    throw new CliDataError(schemaDiagnostics(error));
  }
};

export const loadSceneInstances = async (
  inputPath: string | null,
  project: AdventureProject,
  assetManifest: AssetBuildManifest | null,
): Promise<LoadedSceneInstances> => {
  if (!inputPath) {
    return {
      path: null,
      manifest: emptySceneInstanceManifest(project.id),
      diagnostics: [],
    };
  }

  const path = resolve(inputPath);
  const manifest = await loadManifestFile(path);
  const diagnostics: CliDiagnostic[] = [
    ...validateSceneInstanceManifest(
      {
        projectId: project.id,
        scenes: project.scenes,
        actors: project.actors,
        assets: project.assets,
      },
      manifest,
    ).map((issue) => ({
      ...issue,
      source: "scene-instances-semantics" as const,
    })),
    ...(assetManifest
      ? validateCompiledObjectVisualMappings(manifest, assetManifest).map(
          (issue) => ({
            ...issue,
            source: "scene-instances-semantics" as const,
          }),
        )
      : []),
  ];

  return {
    path,
    manifest,
    diagnostics: sortDiagnostics(diagnostics),
  };
};
