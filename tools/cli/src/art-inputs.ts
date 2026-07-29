import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import {
  evaluateCompiledArtDirection,
  parseArtDirectionManifest,
  validateArtDirectionManifest,
  type ArtDirectionManifest,
} from "@evavo/adventure-art-direction";
import {
  evaluateArtDirectionWithVisualEvidence,
  parseArtVisualEvidenceManifest,
  type ArtVisualEvidenceManifest,
} from "@evavo/adventure-art-direction/evidence";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  CliDataError,
  errorCode,
  sortDiagnostics,
  type CliDiagnostic,
} from "./diagnostics.js";

export interface LoadedArtInputs {
  readonly artDirectionPath: string | null;
  readonly artEvidencePath: string | null;
  readonly manifest: ArtDirectionManifest | null;
  readonly visualEvidence: ArtVisualEvidenceManifest | null;
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

const schemaDiagnostics = (
  error: unknown,
  source: "art-direction-schema" | "art-evidence-schema",
): readonly CliDiagnostic[] => {
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
          source,
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
      source,
      code: "schema-invalid",
      path: "$",
      message: error instanceof Error ? error.message : "Schema validation failed.",
    },
  ];
};

const readJson = async (
  path: string,
  source: "art-direction-file" | "art-evidence-file",
): Promise<unknown> => {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new CliDataError([
      {
        severity: "error",
        source,
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
        source,
        code: "invalid-json",
        path,
        message: `Invalid JSON in '${path}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    ]);
  }
};

const loadArtManifest = async (path: string): Promise<ArtDirectionManifest> => {
  const input = await readJson(path, "art-direction-file");
  try {
    return parseArtDirectionManifest(input);
  } catch (error) {
    throw new CliDataError(schemaDiagnostics(error, "art-direction-schema"));
  }
};

const loadVisualEvidence = async (
  path: string,
): Promise<ArtVisualEvidenceManifest> => {
  const input = await readJson(path, "art-evidence-file");
  try {
    return parseArtVisualEvidenceManifest(input);
  } catch (error) {
    throw new CliDataError(schemaDiagnostics(error, "art-evidence-schema"));
  }
};

export const loadArtInputs = async (
  artDirectionInputPath: string | null,
  artEvidenceInputPath: string | null,
  project: AdventureProject,
  assetManifest: AssetBuildManifest | null,
): Promise<LoadedArtInputs> => {
  if (!artDirectionInputPath) {
    return {
      artDirectionPath: null,
      artEvidencePath: null,
      manifest: null,
      visualEvidence: null,
      diagnostics: [],
    };
  }

  const artDirectionPath = resolve(artDirectionInputPath);
  const manifest = await loadArtManifest(artDirectionPath);
  const artEvidencePath = artEvidenceInputPath
    ? resolve(artEvidenceInputPath)
    : null;
  const visualEvidence = artEvidencePath
    ? await loadVisualEvidence(artEvidencePath)
    : null;

  const rawIssues = assetManifest
    ? visualEvidence
      ? evaluateArtDirectionWithVisualEvidence(
          project,
          manifest,
          assetManifest,
          visualEvidence,
        )
      : evaluateCompiledArtDirection(project, manifest, assetManifest)
    : validateArtDirectionManifest(project, manifest);
  const diagnostics = rawIssues.map(
    (issue): CliDiagnostic => ({
      severity: issue.severity,
      source:
        issue.code.startsWith("visual-evidence-")
          ? "art-evidence-semantics"
          : "art-direction-semantics",
      code: issue.code,
      path: issue.path,
      message: issue.message,
    }),
  );

  if (visualEvidence && !assetManifest) {
    diagnostics.push({
      severity: "error",
      source: "art-evidence-semantics",
      code: "art-evidence-requires-asset-manifest",
      path: artEvidencePath ?? "$",
      message: "Compiled visual evidence requires an asset build manifest.",
    });
  }

  return {
    artDirectionPath,
    artEvidencePath,
    manifest,
    visualEvidence,
    diagnostics: sortDiagnostics(diagnostics),
  };
};

export const artInputPaths = (
  loaded: LoadedArtInputs,
): readonly string[] => [
  ...(loaded.artDirectionPath ? [loaded.artDirectionPath] : []),
  ...(loaded.artEvidencePath ? [loaded.artEvidencePath] : []),
];
