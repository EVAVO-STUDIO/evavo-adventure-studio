import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
} from "node:path";
import {
  parseAssetBuildManifest,
  validateAssetBuildManifest,
  type AssetBuildManifest,
  type CompiledOutputFile,
} from "@evavo/adventure-asset-contract";
import {
  portablePathKey,
  validatePortableRuntimePaths,
} from "@evavo/adventure-asset-contract/portable-path";
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
import {
  replaceDirectoryAtomically,
  withTrailingNewline,
  writeFilesAtomically,
  type AtomicDirectoryFile,
} from "./filesystem.js";

export const CLI_VERSION = "0.1.0";

const BUNDLE_FILE_NAME = "game.bundle.json";
const RELEASE_MANIFEST_FILE_NAME = "release.manifest.json";
const RESERVED_RELEASE_PATHS = new Set(
  [BUNDLE_FILE_NAME, RELEASE_MANIFEST_FILE_NAME].map(portablePathKey),
);

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
  readonly projectPath: string;
  readonly manifestPath: string | null;
  readonly project: AdventureProject;
  readonly assetManifest: AssetBuildManifest | null;
  readonly diagnostics: readonly CliDiagnostic[];
}

interface EvidenceFile {
  readonly logicalPath: string;
  readonly filePath: string;
  readonly expectedLength: number;
  readonly expectedSha256: string;
}

interface RuntimeOutputArtifact {
  readonly assetId: string;
  readonly output: CompiledOutputFile;
  readonly data: Uint8Array;
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

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) =>
      left.localeCompare(right),
    )) {
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

const evidenceFiles = (
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
    return pathDifference !== 0
      ? pathDifference
      : left.code.localeCompare(right.code);
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

const hasErrors = (diagnostics: readonly CliDiagnostic[]): boolean =>
  diagnostics.some((diagnostic) => diagnostic.severity === "error");

const formatDiagnostic = (diagnostic: CliDiagnostic): string =>
  `${diagnostic.severity.toUpperCase()} ${diagnostic.source}:${
    diagnostic.code
  } ${diagnostic.path} — ${diagnostic.message}`;

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
  const loaded = await loadInputs(
    command.projectPath,
    command.assetManifestPath,
  );
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

const normalizedPath = (value: string): string => {
  const resolved = resolve(value);
  return process.platform === "win32"
    ? resolved.toLocaleLowerCase("en-US")
    : resolved;
};

const sameOutputPath = (left: string, right: string): boolean =>
  normalizedPath(left) === normalizedPath(right);

const isPathWithin = (candidatePath: string, directoryPath: string): boolean => {
  const pathDifference = relative(
    normalizedPath(directoryPath),
    normalizedPath(candidatePath),
  );
  return (
    pathDifference === "" ||
    (!pathDifference.startsWith("..") && !isAbsolute(pathDifference))
  );
};

const inputPaths = (loaded: LoadedInputs): readonly string[] => {
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

const assertGeneratedFilesSafe = (
  loaded: LoadedInputs,
  generatedPaths: readonly string[],
): void => {
  const inputs = inputPaths(loaded).map(normalizedPath);
  for (const generatedPath of generatedPaths) {
    const normalized = normalizedPath(generatedPath);
    if (inputs.includes(normalized)) {
      throw new CliUsageError(
        `Generated output '${generatedPath}' would overwrite an input or evidence file.`,
      );
    }
  }
};

const assertReleaseDirectorySafe = (
  loaded: LoadedInputs,
  outputDirectory: string,
): void => {
  for (const inputPath of inputPaths(loaded)) {
    if (isPathWithin(inputPath, outputDirectory)) {
      throw new CliUsageError(
        `Release directory '${outputDirectory}' contains input or evidence file '${inputPath}'.`,
      );
    }
  }
};

const runCompile = async (
  command: Extract<CliCommand, { readonly kind: "compile" }>,
  environment: CliEnvironment,
): Promise<number> => {
  if (
    command.reportPath &&
    sameOutputPath(command.outputPath, command.reportPath)
  ) {
    throw new CliUsageError("Bundle output and report paths must be different.");
  }

  const loaded = await loadInputs(
    command.projectPath,
    command.assetManifestPath,
  );
  if (!loaded.assetManifest) {
    throw new Error("Compile command did not load its required asset manifest.");
  }
  if (hasErrors(loaded.diagnostics)) {
    throw new CliDataError(loaded.diagnostics);
  }
  assertGeneratedFilesSafe(
    loaded,
    [command.outputPath, ...(command.reportPath ? [command.reportPath] : [])],
  );

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

const isReservedReleasePath = (runtimePath: string): boolean => {
  const firstSegment = runtimePath.split("/")[0] ?? "";
  return RESERVED_RELEASE_PATHS.has(portablePathKey(firstSegment));
};

const readRuntimeOutputs = async (
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
      if (isReservedReleasePath(output.runtimePath)) {
        diagnostics.push({
          severity: "error",
          source: "asset-evidence",
          code: "reserved-release-path",
          path: `${asset.assetId}.output:${output.runtimePath}`,
          message: `Runtime path '${output.runtimePath}' conflicts with a reserved release file.`,
        });
        continue;
      }

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

const releaseManifest = (
  projectId: string,
  bundleData: Uint8Array,
  bundleFingerprint: string,
  assetManifest: AssetBuildManifest,
  artifacts: readonly RuntimeOutputArtifact[],
): { readonly data: Uint8Array; readonly fingerprint: string } => {
  const payload = {
    releaseVersion: 1 as const,
    projectId,
    bundle: {
      path: BUNDLE_FILE_NAME,
      byteLength: bundleData.byteLength,
      sha256: sha256(bundleData),
      fingerprint: bundleFingerprint,
    },
    assetManifest: {
      fingerprint: assetManifest.fingerprint,
      compilerVersion: assetManifest.compilerVersion,
    },
    files: artifacts.map((artifact) => ({
      assetId: artifact.assetId,
      role: artifact.output.role,
      path: artifact.output.runtimePath,
      mediaType: artifact.output.mediaType,
      byteLength: artifact.data.byteLength,
      sha256: sha256(artifact.data),
    })),
  };
  const fingerprint = sha256(canonicalStringify(payload));
  const data = new TextEncoder().encode(
    `${canonicalStringify({ ...payload, fingerprint })}\n`,
  );
  return { data, fingerprint };
};

const runPackage = async (
  command: Extract<CliCommand, { readonly kind: "package" }>,
  environment: CliEnvironment,
): Promise<number> => {
  const loaded = await loadInputs(
    command.projectPath,
    command.assetManifestPath,
  );
  if (!loaded.assetManifest || !loaded.manifestPath) {
    throw new Error("Package command did not load its required asset manifest.");
  }
  if (hasErrors(loaded.diagnostics)) {
    throw new CliDataError(loaded.diagnostics);
  }
  assertReleaseDirectorySafe(loaded, command.outputDirectory);

  const compiled = compileProject(loaded.project, loaded.assetManifest);
  const artifacts = await readRuntimeOutputs(
    loaded.manifestPath,
    loaded.assetManifest,
  );
  const bundleData = new TextEncoder().encode(
    withTrailingNewline(compiled.canonicalJson),
  );
  const manifest = releaseManifest(
    loaded.project.id,
    bundleData,
    compiled.fingerprint,
    loaded.assetManifest,
    artifacts,
  );
  const files: AtomicDirectoryFile[] = [
    ...artifacts.map((artifact) => ({
      relativePath: artifact.output.runtimePath,
      data: artifact.data,
    })),
    { relativePath: BUNDLE_FILE_NAME, data: bundleData },
    { relativePath: RELEASE_MANIFEST_FILE_NAME, data: manifest.data },
  ];
  const outputDirectory = await replaceDirectoryAtomically(
    command.outputDirectory,
    files,
  );

  const report = {
    reportVersion: 1 as const,
    command: "package" as const,
    valid: true,
    projectId: loaded.project.id,
    outputDirectory,
    bundleFingerprint: compiled.fingerprint,
    releaseFingerprint: manifest.fingerprint,
    assetManifestFingerprint: loaded.assetManifest.fingerprint,
    fileCount: files.length,
    diagnostics: loaded.diagnostics,
  };
  const human = [
    `Packaged project '${loaded.project.id}'.`,
    `Release: ${outputDirectory}`,
    `Files: ${files.length}`,
    `Bundle fingerprint: ${compiled.fingerprint}`,
    `Release fingerprint: ${manifest.fingerprint}`,
  ].join("\n");
  writeResult(environment, command.format, report, human);
  return 0;
};

const writeFailure = (
  argv: readonly string[],
  environment: CliEnvironment,
  exitCode: number,
  diagnostics: readonly CliDiagnostic[],
): void => {
  if (argv.includes("--json")) {
    environment.stdout(
      withTrailingNewline(
        JSON.stringify(
          {
            reportVersion: 1,
            command: argv[0] ?? null,
            valid: false,
            exitCode,
            diagnostics,
          },
          null,
          2,
        ),
      ),
    );
    return;
  }
  environment.stderr(
    withTrailingNewline(diagnostics.map(formatDiagnostic).join("\n")),
  );
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
      case "package":
        return await runPackage(command, environment);
    }
  } catch (error) {
    if (error instanceof CliUsageError) {
      const diagnostic: CliDiagnostic = {
        severity: "error",
        source: "cli",
        code: "invalid-usage",
        path: "$",
        message: error.message,
      };
      if (argv.includes("--json")) {
        writeFailure(argv, environment, 2, [diagnostic]);
      } else {
        environment.stderr(`${error.message}\n\n${CLI_HELP}`);
      }
      return 2;
    }
    if (error instanceof CliDataError) {
      writeFailure(argv, environment, 1, error.diagnostics);
      return 1;
    }
    environment.stderr(
      `Unexpected CLI failure: ${
        error instanceof Error ? error.stack ?? error.message : String(error)
      }\n`,
    );
    return 3;
  }
};
