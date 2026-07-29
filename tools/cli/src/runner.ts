import { isAbsolute, relative, resolve } from "node:path";
import { compileProjectWithInstances } from "@evavo/adventure-compiler/with-instances";
import {
  CLI_HELP,
  CliUsageError,
  parseCliArguments,
  type CliCommand,
  type OutputFormat,
} from "./arguments.js";
import {
  CliDataError,
  formatDiagnostic,
  hasErrors,
  sortDiagnostics,
  type CliDiagnostic,
} from "./diagnostics.js";
import {
  replaceDirectoryAtomically,
  withTrailingNewline,
  writeFilesAtomically,
} from "./filesystem.js";
import {
  inputPaths,
  loadInputs,
  readVerifiedRuntimeOutputs,
  type LoadedInputs,
} from "./inputs.js";
import { buildRelease } from "./release.js";
import {
  loadSceneInstances,
  type LoadedSceneInstances,
} from "./scene-inputs.js";

export const CLI_VERSION = "0.1.0";

export interface CliEnvironment {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export const defaultCliEnvironment: CliEnvironment = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

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

const combinedDiagnostics = (
  loaded: LoadedInputs,
  sceneInstances: LoadedSceneInstances,
): readonly CliDiagnostic[] =>
  sortDiagnostics([...loaded.diagnostics, ...sceneInstances.diagnostics]);

const runValidate = async (
  command: Extract<CliCommand, { readonly kind: "validate" }>,
  environment: CliEnvironment,
): Promise<number> => {
  const loaded = await loadInputs(
    command.projectPath,
    command.assetManifestPath,
  );
  const sceneInstances = await loadSceneInstances(
    command.sceneInstancesPath,
    loaded.project,
    loaded.assetManifest,
  );
  const diagnostics = combinedDiagnostics(loaded, sceneInstances);
  const report = {
    reportVersion: 1 as const,
    command: "validate" as const,
    valid: !hasErrors(diagnostics),
    projectId: loaded.project.id,
    projectPath: command.projectPath,
    assetManifestPath: command.assetManifestPath,
    sceneInstancesPath: command.sceneInstancesPath,
    diagnostics,
  };
  const human = report.valid
    ? `Valid project '${loaded.project.id}' with ${diagnostics.length} warning(s).`
    : diagnostics.map(formatDiagnostic).join("\n");
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

const allInputPaths = (
  loaded: LoadedInputs,
  sceneInstances: LoadedSceneInstances,
): readonly string[] => [
  ...inputPaths(loaded),
  ...(sceneInstances.path ? [sceneInstances.path] : []),
];

const assertGeneratedFilesSafe = (
  loaded: LoadedInputs,
  sceneInstances: LoadedSceneInstances,
  generatedPaths: readonly string[],
): void => {
  const inputs = allInputPaths(loaded, sceneInstances).map(normalizedPath);
  for (const generatedPath of generatedPaths) {
    if (inputs.includes(normalizedPath(generatedPath))) {
      throw new CliUsageError(
        `Generated output '${generatedPath}' would overwrite an input or evidence file.`,
      );
    }
  }
};

const assertReleaseDirectorySafe = (
  loaded: LoadedInputs,
  sceneInstances: LoadedSceneInstances,
  outputDirectory: string,
): void => {
  for (const inputPath of allInputPaths(loaded, sceneInstances)) {
    if (isPathWithin(inputPath, outputDirectory)) {
      throw new CliUsageError(
        `Release directory '${outputDirectory}' contains input or evidence file '${inputPath}'.`,
      );
    }
  }
};

const requireCompiledInputs = (
  loaded: LoadedInputs,
  sceneInstances: LoadedSceneInstances,
  commandName: "compile" | "package",
): NonNullable<LoadedInputs["assetManifest"]> => {
  if (!loaded.assetManifest) {
    throw new Error(
      `${commandName} command did not load its required asset manifest.`,
    );
  }
  const diagnostics = combinedDiagnostics(loaded, sceneInstances);
  if (hasErrors(diagnostics)) {
    throw new CliDataError(diagnostics);
  }
  return loaded.assetManifest;
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
  const sceneInstances = await loadSceneInstances(
    command.sceneInstancesPath,
    loaded.project,
    loaded.assetManifest,
  );
  const assetManifest = requireCompiledInputs(
    loaded,
    sceneInstances,
    "compile",
  );
  assertGeneratedFilesSafe(
    loaded,
    sceneInstances,
    [command.outputPath, ...(command.reportPath ? [command.reportPath] : [])],
  );

  const compiled = compileProjectWithInstances(
    loaded.project,
    assetManifest,
    sceneInstances.manifest,
  );
  const diagnostics = combinedDiagnostics(loaded, sceneInstances);
  const report = {
    reportVersion: 1 as const,
    command: "compile" as const,
    valid: true,
    projectId: loaded.project.id,
    bundleFingerprint: compiled.fingerprint,
    assetManifestFingerprint: assetManifest.fingerprint,
    assetCompilerVersion: assetManifest.compilerVersion,
    sceneInstancesPath: sceneInstances.path,
    outputPath: command.outputPath,
    diagnostics,
  };
  await writeFilesAtomically([
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
  ]);

  const human = [
    `Compiled project '${loaded.project.id}'.`,
    `Bundle: ${resolve(command.outputPath)}`,
    `Fingerprint: ${compiled.fingerprint}`,
    ...(sceneInstances.path
      ? [`Scene composition: ${sceneInstances.path}`]
      : []),
    ...(command.reportPath ? [`Report: ${resolve(command.reportPath)}`] : []),
  ].join("\n");
  writeResult(environment, command.format, report, human);
  return 0;
};

const runPackage = async (
  command: Extract<CliCommand, { readonly kind: "package" }>,
  environment: CliEnvironment,
): Promise<number> => {
  const loaded = await loadInputs(
    command.projectPath,
    command.assetManifestPath,
  );
  const sceneInstances = await loadSceneInstances(
    command.sceneInstancesPath,
    loaded.project,
    loaded.assetManifest,
  );
  const assetManifest = requireCompiledInputs(
    loaded,
    sceneInstances,
    "package",
  );
  if (!loaded.manifestPath) {
    throw new Error("Package command did not resolve its asset manifest path.");
  }
  assertReleaseDirectorySafe(loaded, sceneInstances, command.outputDirectory);

  const compiled = compileProjectWithInstances(
    loaded.project,
    assetManifest,
    sceneInstances.manifest,
  );
  const artifacts = await readVerifiedRuntimeOutputs(
    loaded.manifestPath,
    assetManifest,
  );
  const release = buildRelease(compiled, assetManifest, artifacts);
  const outputDirectory = await replaceDirectoryAtomically(
    command.outputDirectory,
    release.files,
  );
  const diagnostics = combinedDiagnostics(loaded, sceneInstances);

  const report = {
    reportVersion: 1 as const,
    command: "package" as const,
    valid: true,
    projectId: loaded.project.id,
    outputDirectory,
    bundleFingerprint: compiled.fingerprint,
    releaseFingerprint: release.fingerprint,
    assetManifestFingerprint: assetManifest.fingerprint,
    sceneInstancesPath: sceneInstances.path,
    fileCount: release.files.length,
    diagnostics,
  };
  const human = [
    `Packaged project '${loaded.project.id}'.`,
    `Release: ${outputDirectory}`,
    `Files: ${release.files.length}`,
    `Bundle fingerprint: ${compiled.fingerprint}`,
    `Release fingerprint: ${release.fingerprint}`,
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
