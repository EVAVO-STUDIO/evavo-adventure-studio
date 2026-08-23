import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import {
  type IndexedAssetManifest,
  indexedAssetManifestSchema,
  validateIndexedAssetManifest,
} from "@evavo/adventure-asset-contract/indexed-assets";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import { CliDataError, type CliDiagnostic, errorCode, sortDiagnostics } from "./diagnostics.js";
import { sha256 } from "./hashing.js";

export interface LoadedIndexedAssets {
  readonly path: string | null;
  readonly manifest: IndexedAssetManifest | null;
  readonly diagnostics: readonly CliDiagnostic[];
  readonly evidencePaths: readonly string[];
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
        source: "indexed-assets-schema" as const,
        code: String(candidate.code ?? "schema-invalid"),
        path: schemaPath(candidate.path ?? []),
        message: String(candidate.message ?? "Schema validation failed."),
      };
    });
  }
  return [
    {
      severity: "error",
      source: "indexed-assets-schema",
      code: "schema-invalid",
      path: "$",
      message: error instanceof Error ? error.message : "Schema validation failed.",
    },
  ];
};

const loadManifestFile = async (path: string): Promise<IndexedAssetManifest> => {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new CliDataError([
      {
        severity: "error",
        source: "indexed-assets-file",
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
        source: "indexed-assets-file",
        code: "invalid-json",
        path,
        message: `Invalid JSON in '${path}': ${error instanceof Error ? error.message : String(error)}`,
      },
    ]);
  }

  try {
    return indexedAssetManifestSchema.parse(input);
  } catch (error) {
    throw new CliDataError(schemaDiagnostics(error));
  }
};

export const loadIndexedAssets = async (
  inputPath: string | null,
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
): Promise<LoadedIndexedAssets> => {
  if (!inputPath) return { path: null, manifest: null, diagnostics: [], evidencePaths: [] };
  const path = resolve(inputPath);
  const manifest = await loadManifestFile(path);
  const diagnostics: CliDiagnostic[] = validateIndexedAssetManifest(project, assetManifest, manifest).map(
    (issue) => ({ ...issue, source: "indexed-assets-semantics" as const }),
  );
  const baseDirectory = dirname(path);
  const evidencePaths: string[] = [];

  for (let index = 0; index < manifest.assets.length; index += 1) {
    const record = manifest.assets[index];
    if (!record) continue;
    const filePath = resolve(baseDirectory, record.indexRuntimePath);
    evidencePaths.push(filePath);
    let data: Uint8Array;
    try {
      data = new Uint8Array(await readFile(filePath));
    } catch (error) {
      diagnostics.push({
        severity: "error",
        source: "indexed-assets-evidence",
        code: errorCode(error) ?? "read-failed",
        path: `assets[${index}].indexRuntimePath`,
        message: `Unable to read index map '${filePath}': ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }
    if (data.byteLength !== record.indexByteLength) {
      diagnostics.push({
        severity: "error",
        source: "indexed-assets-evidence",
        code: "byte-length-mismatch",
        path: `assets[${index}].indexByteLength`,
        message: `Index map '${filePath}' has ${data.byteLength} bytes; expected ${record.indexByteLength}.`,
      });
    }
    const digest = sha256(data);
    if (digest !== record.indexSha256) {
      diagnostics.push({
        severity: "error",
        source: "indexed-assets-evidence",
        code: "sha256-mismatch",
        path: `assets[${index}].indexSha256`,
        message: `Index map '${filePath}' has SHA-256 '${digest}'; expected '${record.indexSha256}'.`,
      });
    }
  }

  return {
    path,
    manifest,
    diagnostics: sortDiagnostics(diagnostics),
    evidencePaths: [...evidencePaths].sort((left, right) => left.localeCompare(right)),
  };
};
