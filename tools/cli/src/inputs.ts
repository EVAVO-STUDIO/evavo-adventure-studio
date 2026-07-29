import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  parseAssetBuildManifest,
  validateAssetBuildManifest,
  type AssetBuildManifest,
  type CompiledOutputFile,
} from "@evavo/adventure-asset-contract";
import { validateCompiledFrameMappings } from "@evavo/adventure-asset-contract/frame-mapping";
import { validatePortableRuntimePaths } from "@evavo/adventure-asset-contract/portable-path";
import {
  parseAdventureProject,
  type AdventureProject,
} from "@evavo/adventure-project-schema";
import {
  validateProjectSemantics,
  type ValidationIssue,
} from "@evavo/adventure-validation";
import {
  CliDataError,
  errorCode,
  sortDiagnostics,
  type CliDiagnostic,
} from "./diagnostics.js";
import { canonicalStringify, sha256 } from "./hashing.js";

export interface LoadedInputs {
  readonly projectPath: string;
  readonly manifestPath: string | null;
  readonly project: AdventureProject;
  readonly assetManifest: AssetBuildManifest | null;
  readonly diagnostics: readonly CliDiagnostic[];
}

export interface EvidenceFile {
  readonly logicalPath: string;
  readonly filePath: string;
  readonly expectedLength: number;
  readonly expectedSha256: string;
}

export interface RuntimeOutputArtifact {
  readonly assetId: string;
  readonly output: CompiledOutputFile;
  readonly data: Uint8Array;
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

const schemaDiagnostics = (
  error: unknown,
  source: "project-schema" | "asset-manifest-schema",
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
      message:
        error instanceof Error ? error.message : "Schema validation failed.",
    },
  ];
};

const readJsonFile = async (
  path: string,
  source: "project-file" | "asset-manifest-file",
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

const loadProject = async (path: string): Promise<AdventureProject> => {
  const input = await readJsonFile(path, "project-file");
  try {
    return parseAdventureProject(input);
  } catch (error) {
    throw new CliDataError(schemaDiagnostics(error, "project-schema"));
  }
};

const loadAssetManifest = async (
  path: string,
): Promise<AssetBuildManifest> => {
  const input = await readJsonFile(path, "asset-manifest-file");
  try {
    return parseAssetBuildManifest(input);
  } catch (error) {
    throw new CliDataError(schemaDiagnostics(error, "asset-manifest-schema"));
  }
};

const manifestFingerprintDiagnostic = (
  manifest: AssetBuildManifest,
): CliDiagnostic | null => {
  const { fingerprint: _fingerprint, ...payload } = manifest;
  const actual = sha256(canonicalStringify(payload));
  return actual === manifest.fingerprint
    ? null
    : {
        severity: "error",
        source: "asset-evidence",
        code: "manifest-fingerprint-mismatch",
        path: "fingerprint",
        message: `Asset manifest fingerprint '${manifest.fingerprint}' does not match '${actual}'.`,
      };
};

export const evidenceFiles = (
  projectPath: string,
  manifestPath: string,
  manifest: AssetBuildManifest,
): readonly EvidenceFile[] => {
  const files: EvidenceFile[] = [];
  const projectDirectory = dirname(projectPath);
  const manifestDirectory = dirname(manifestPath);

  for (const asset of manifest.assets) {
    for (const source of asset.sourceFiles) {
      files.push({
        logicalPath: `${asset.assetId}.source:${source.path}`,
        filePath: resolve(projectDirectory, source.path),
        expectedLength: source.byteLength,
        expectedSha256: source.sha256,
      });
    }
    for (const output of asset.outputFiles) {
      files.push({
        logicalPath: `${asset.assetId}.output:${output.runtimePath}`,
        filePath: resolve(manifestDirectory, output.runtimePath),
        expectedLength: output.byteLength,
        expectedSha256: output.sha256,
      });
    }
  }

  return files.sort((left, right) =>
    left.logicalPath.localeCompare(right.logicalPath),
  );
};

const verifyEvidenceFile = async (
  file: EvidenceFile,
): Promise<readonly CliDiagnostic[]> => {
  let data: Uint8Array;
  try {
    data = new Uint8Array(await readFile(file.filePath));
  } catch (error) {
    return [
      {
        severity: "error",
        source: "asset-evidence",
        code: errorCode(error) ?? "read-failed",
        path: file.logicalPath,
        message: `Unable to read evidence file '${file.filePath}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    ];
  }

  const diagnostics: CliDiagnostic[] = [];
  if (data.byteLength !== file.expectedLength) {
    diagnostics.push({
      severity: "error",
      source: "asset-evidence",
      code: "byte-length-mismatch",
      path: file.logicalPath,
      message: `Evidence file '${file.filePath}' has ${data.byteLength} bytes; expected ${file.expectedLength}.`,
    });
  }

  const digest = sha256(data);
  if (digest !== file.expectedSha256) {
    diagnostics.push({
      severity: "error",
      source: "asset-evidence",
      code: "sha256-mismatch",
      path: file.logicalPath,
      message: `Evidence file '${file.filePath}' has SHA-256 '${digest}'; expected '${file.expectedSha256}'.`,
    });
  }
  return diagnostics;
};

const evidenceDiagnostics = async (
  projectPath: string,
  manifestPath: string,
  manifest: AssetBuildManifest,
): Promise<readonly CliDiagnostic[]> => {
  const diagnostics: CliDiagnostic[] = [];
  for (const file of evidenceFiles(projectPath, manifestPath, manifest)) {
    diagnostics.push(...(await verifyEvidenceFile(file)));
  }
  return diagnostics;
};

const projectDiagnostic = (issue: ValidationIssue): CliDiagnostic => ({
  severity: issue.severity,
  source: "project-semantics",
  code: issue.code,
  path: issue.path,
  message: issue.message,
});

export const loadInputs = async (
  projectInputPath: string,
  manifestInputPath: string | null,
): Promise<LoadedInputs> => {
  const projectPath = resolve(projectInputPath);
  const project = await loadProject(projectPath);
  const diagnostics: CliDiagnostic[] = validateProjectSemantics(project).map(
    projectDiagnostic,
  );

  if (!manifestInputPath) {
    return {
      projectPath,
      manifestPath: null,
      project,
      assetManifest: null,
      diagnostics: sortDiagnostics(diagnostics),
    };
  }

  const manifestPath = resolve(manifestInputPath);
  const assetManifest = await loadAssetManifest(manifestPath);
  diagnostics.push(
    ...validateAssetBuildManifest(project, assetManifest).map((issue) => ({
      ...issue,
      source: "asset-manifest-semantics" as const,
    })),
    ...validatePortableRuntimePaths(assetManifest).map((issue) => ({
      ...issue,
      source: "asset-manifest-semantics" as const,
    })),
    ...validateCompiledFrameMappings(project, assetManifest).map((issue) => ({
      ...issue,
      source: "asset-manifest-semantics" as const,
    })),
  );
  const fingerprintDiagnostic = manifestFingerprintDiagnostic(assetManifest);
  if (fingerprintDiagnostic) {
    diagnostics.push(fingerprintDiagnostic);
  }
  diagnostics.push(
    ...(await evidenceDiagnostics(projectPath, manifestPath, assetManifest)),
  );

  return {
    projectPath,
    manifestPath,
    project,
    assetManifest,
    diagnostics: sortDiagnostics(diagnostics),
  };
};

export const inputPaths = (loaded: LoadedInputs): readonly string[] => {
  const paths = [loaded.projectPath];
  if (!loaded.manifestPath || !loaded.assetManifest) {
    return paths;
  }
  paths.push(loaded.manifestPath);
  paths.push(
    ...evidenceFiles(
      loaded.projectPath,
      loaded.manifestPath,
      loaded.assetManifest,
    ).map((file) => file.filePath),
  );
  return paths;
};

export const readVerifiedRuntimeOutputs = async (
  manifestPath: string,
  manifest: AssetBuildManifest,
): Promise<readonly RuntimeOutputArtifact[]> => {
  const manifestDirectory = dirname(manifestPath);
  const artifacts: RuntimeOutputArtifact[] = [];
  const diagnostics: CliDiagnostic[] = [];

  for (const asset of [...manifest.assets].sort((left, right) =>
    left.assetId.localeCompare(right.assetId),
  )) {
    for (const output of [...asset.outputFiles].sort((left, right) => {
      const roleDifference = left.role.localeCompare(right.role);
      return roleDifference !== 0
        ? roleDifference
        : left.runtimePath.localeCompare(right.runtimePath);
    })) {
      const filePath = resolve(manifestDirectory, output.runtimePath);
      let data: Uint8Array;
      try {
        data = new Uint8Array(await readFile(filePath));
      } catch (error) {
        diagnostics.push({
          severity: "error",
          source: "asset-evidence",
          code: errorCode(error) ?? "read-failed",
          path: `${asset.assetId}.output:${output.runtimePath}`,
          message: `Unable to read runtime output '${filePath}': ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
        continue;
      }

      const digest = sha256(data);
      if (data.byteLength !== output.byteLength) {
        diagnostics.push({
          severity: "error",
          source: "asset-evidence",
          code: "byte-length-mismatch",
          path: `${asset.assetId}.output:${output.runtimePath}`,
          message: `Runtime output '${filePath}' has ${data.byteLength} bytes; expected ${output.byteLength}.`,
        });
      }
      if (digest !== output.sha256) {
        diagnostics.push({
          severity: "error",
          source: "asset-evidence",
          code: "sha256-mismatch",
          path: `${asset.assetId}.output:${output.runtimePath}`,
          message: `Runtime output '${filePath}' has SHA-256 '${digest}'; expected '${output.sha256}'.`,
        });
      }

      artifacts.push({ assetId: asset.assetId, output, data });
    }
  }

  if (diagnostics.length > 0) {
    throw new CliDataError(sortDiagnostics(diagnostics));
  }
  return artifacts;
};
