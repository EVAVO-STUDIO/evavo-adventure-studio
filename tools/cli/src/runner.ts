import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  parseAssetBuildManifest,
  validateAssetBuildManifest,
  type AssetBuildManifest,
} from "@evavo/adventure-asset-contract";
import { compileProject } from "@evavo/adventure-compiler";
import {
  parseAdventureProject,
  type AdventureProject,
} from "@evavo/adventure-project-schema";
import {
  validateProjectSemantics,
  type ValidationIssue,
} from "@evavo/adventure-validation";
import {
  CLI_HELP,
  CliUsageError,
  parseCliArguments,
  type CliCommand,
  type OutputFormat,
} from "./arguments.js";
import { withTrailingNewline, writeFilesAtomically } from "./filesystem.js";

export const CLI_VERSION = "0.1.0";

export interface CliDiagnostic {
  readonly severity: "error" | "warning";
  readonly source:
    | "cli"
    | "project-file"
    | "project-schema"
    | "project-semantics"
    | "asset-manifest-file"
    | "asset-manifest-schema"
    | "asset-manifest-semantics"
    | "asset-evidence";
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface CliEnvironment {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export const defaultCliEnvironment: CliEnvironment = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

class CliDataError extends Error {
  readonly diagnostics: readonly CliDiagnostic[];

  constructor(diagnostics: readonly CliDiagnostic[]) {
    super(diagnostics[0]?.message ?? "Input validation failed.");
    this.name = "CliDataError";
    this.diagnostics = diagnostics;
  }
}

interface LoadedInputs {
  readonly project: AdventureProject;
  readonly assetManifest: AssetBuildManifest | null;
  readonly diagnostics: readonly CliDiagnostic[];
}

const errorCode = (error: unknown): string | null =>
  typeof error === "object" && error !== null && "code" in error
    ? String((error as { readonly code: unknown }).code)
    : null;

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
    return (error as { readonly issues: readonly unknown[] }).issues.map((issue) => {
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
    });
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
        message: `Unable to read '${path}': ${error instanceof Error ? error.message : String(error)}`,
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
        message: `Invalid JSON in '${path}': ${error instanceof Error ? error.message : String(error)}`,
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

const loadAssetManifest = async (path: string): Promise<AssetBuildManifest> => {
  const input = await readJsonFile(path, "asset-manifest-file");
  try {
    return parseAssetBuildManifest(input);
  } catch (error) {
    throw new CliDataError(schemaDiagnostics(error, "asset-manifest-schema"));
  }
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) => left.localeCompare(right))) {
      const child = source[key];
      if (child !== undefined) {
        result[key] = canonicalize(child);
      }
    }
    return result;
  }
  return value;
};

const canonicalStringify = (value: unknown): string => {
  const serialized = JSON.stringify(canonicalize(value));
  if (serialized === undefined) {
    throw new TypeError("Value cannot be represented as canonical JSON.");
  }
  return serialized;
};

const sha256 = (bytes: Uint8Array | string): string =>
  createHash("sha256").update(bytes).digest("hex");

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

interface EvidenceFile {
  readonly logicalPath: string;
  readonly filePath: string;
  readonly expectedLength: number;
  readonly expectedSha256: string;
}

const evidenceDiagnostics = async (
  projectPath: string,
  manifestPath: string,
  manifest: AssetBuildManifest,
): Promise<readonly CliDiagnostic[]> => {
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

  files.sort((left, right) => left.logicalPath.localeCompare(right.logicalPath));
  const diagnostics: CliDiagnostic[] = [];
  for (const file of files) {
    let data: Uint8Array;
    try {
      data = new Uint8Array(await readFile(file.filePath));
    } catch (error) {
      diagnostics.push({
        severity: "error",
        source: "asset-evidence",
        code: errorCode(error) ?? "read-failed",
        path: file.logicalPath,
        message: `Unable to read evidence file '${file.filePath}': ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

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

const sortDiagnostics = (
  diagnostics: readonly CliDiagnostic[],
): readonly CliDiagnostic[] =>
  [...diagnostics].sort((left, right) => {
    const severityDifference = left.severity.localeCompare(right.severity);
    if (severityDifference !== 0) {
      return severityDifference;
    }
    const sourceDifference = left.source.localeCompare(right.source);
    if (sourceDifference !== 0) {
      return sourceDifference;
    }
    const pathDifference = left.path.localeCompare(right.path);
    return pathDifference !== 0 ? pathDifference : left.code.localeCompare(right.code);
  });

const loadInputs = async (
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
  );
  const fingerprintDiagnostic = manifestFingerprintDiagnostic(assetManifest);
  if (fingerprintDiagnostic) {
    diagnostics.push(fingerprintDiagnostic);
  }
  diagnostics.push(
    ...(await evidenceDiagnostics(projectPath, manifestPath, assetManifest)),
  );

  return {
    project,
    assetManifest,
    diagnostics: sortDiagnostics(diagnostics),
  };
};

const hasErrors = (diagnostics: readonly CliDiagnostic[]): boolean =>
  diagnostics.some((diagnostic) => diagnostic.severity === "error");

const formatDiagnostic = (diagnostic: CliDiagnostic): string =>
  `${diagnostic.severity.toUpperCase()} ${diagnostic.source}:${diagnostic.code} ${diagnostic.path} — ${diagnostic.message}`;

const writeResult = (
  environment: CliEnvironment,
  format: OutputFormat,
  payload: unknown,
  human: string,
): void => {
  environment.stdout(
    format === "json"
      ? withTrailingNewline(JSON.stringify(payload, null, 2))
      : withTrailingNewline(human),
  );
};

const runValidate = async (
  command: Extract<CliCommand, { readonly kind: "validate" }>,
  environment: CliEnvironment,
): Promise<number> => {
  const loaded = await loadInputs(command.projectPath, command.assetManifestPath);
  const report = {
    reportVersion: 1 as const,
    command: "validate" as const,
    valid: !hasErrors(loaded.diagnostics),
    projectId: loaded.project.id,
    projectPath: command.projectPath,
    assetManifestPath: command.assetManifestPath,
    diagnostics: loaded.diagnostics,
  };
  const human = report.valid
    ? `Valid project '${loaded.project.id}' with ${loaded.diagnostics.length} warning(s).`
    : loaded.diagnostics.map(formatDiagnostic).join("\n");
  writeResult(environment, command.format, report, human);
  return report.valid ? 0 : 1;
};

const sameOutputPath = (left: string, right: string): boolean => {
  const normalize = (value: string): string => {
    const resolved = resolve(value);
    return process.platform === "win32"
      ? resolved.toLocaleLowerCase("en-US")
      : resolved;
  };
  return normalize(left) === normalize(right);
};

const runCompile = async (
  command: Extract<CliCommand, { readonly kind: "compile" }>,
  environment: CliEnvironment,
): Promise<number> => {
  if (command.reportPath && sameOutputPath(command.outputPath, command.reportPath)) {
    throw new CliUsageError("Bundle output and report paths must be different.");
  }

  const loaded = await loadInputs(command.projectPath, command.assetManifestPath);
  if (!loaded.assetManifest) {
    throw new Error("Compile command did not load its required asset manifest.");
  }
  if (hasErrors(loaded.diagnostics)) {
    throw new CliDataError(loaded.diagnostics);
  }

  const compiled = compileProject(loaded.project, loaded.assetManifest);
  const report = {
    reportVersion: 1 as const,
    command: "compile" as const,
    valid: true,
    projectId: loaded.project.id,
    bundleFingerprint: compiled.fingerprint,
    assetManifestFingerprint: loaded.assetManifest.fingerprint,
    assetCompilerVersion: loaded.assetManifest.compilerVersion,
    outputPath: command.outputPath,
    diagnostics: loaded.diagnostics,
  };
  const writes = [
    {
      path: command.outputPath,
      data: withTrailingNewline(compiled.canonicalJson),
    },
    ...(command.reportPath
      ? [
          {
            path: command.reportPath,
            data: withTrailingNewline(JSON.stringify(report, null, 2)),
          },
        ]
      : []),
  ];
  await writeFilesAtomically(writes);

  const human = [
    `Compiled project '${loaded.project.id}'.`,
    `Bundle: ${resolve(command.outputPath)}`,
    `Fingerprint: ${compiled.fingerprint}`,
    ...(command.reportPath ? [`Report: ${resolve(command.reportPath)}`] : []),
  ].join("\n");
  writeResult(environment, command.format, report, human);
  return 0;
};

export const runCli = async (
  argv: readonly string[],
  environment: CliEnvironment = defaultCliEnvironment,
): Promise<number> => {
  try {
    const command = parseCliArguments(argv);
    switch (command.kind) {
      case "help":
        environment.stdout(CLI_HELP);
        return 0;
      case "version":
        environment.stdout(`${CLI_VERSION}\n`);
        return 0;
      case "validate":
        return await runValidate(command, environment);
      case "compile":
        return await runCompile(command, environment);
    }
  } catch (error) {
    if (error instanceof CliUsageError) {
      environment.stderr(`${error.message}\n\n${CLI_HELP}`);
      return 2;
    }
    if (error instanceof CliDataError) {
      environment.stderr(
        withTrailingNewline(error.diagnostics.map(formatDiagnostic).join("\n")),
      );
      return 1;
    }
    environment.stderr(
      `Unexpected CLI failure: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
    );
    return 3;
  }
};
