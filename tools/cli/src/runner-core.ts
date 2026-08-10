import { isAbsolute, relative, resolve } from "node:path";
import { createArtVisualEvidenceFromAssetManifest } from "@evavo/adventure-asset-pipeline/art-evidence";
import { compileProjectWithInstances } from "@evavo/adventure-compiler/scene-instances";
import {
  CLI_HELP,
  type CliCommand,
  CliUsageError,
  type OutputFormat,
  parseCliArguments,
} from "./arguments.js";
import {
  artInputPaths,
  type LoadedArtInputs,
  loadArtInputs,
} from "./art-inputs.js";
import {
  audioMixInputPaths,
  type LoadedAudioMix,
  loadAudioMix,
} from "./audio-inputs.js";
import {
  CliDataError,
  type CliDiagnostic,
  formatDiagnostic,
  hasErrors,
  sortDiagnostics,
} from "./diagnostics.js";
import {
  replaceDirectoryAtomically,
  withTrailingNewline,
  writeFilesAtomically,
} from "./filesystem.js";
import {
  bitmapFontInputPaths,
  type LoadedBitmapFonts,
  loadBitmapFonts,
} from "./font-inputs.js";
import {
  inputPaths,
  type LoadedInputs,
  loadInputs,
  readVerifiedRuntimeOutputs,
} from "./inputs.js";
import { buildRelease } from "./release.js";
import {
  type LoadedSceneInstances,
  loadSceneInstances,
} from "./scene-inputs.js";
import {
  type LoadedUiSkins,
  loadUiSkins,
  uiSkinInputPaths,
} from "./ui-inputs.js";

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

interface CombinedInputState {
  readonly base: LoadedInputs;
  readonly sceneInstances: LoadedSceneInstances;
  readonly art: LoadedArtInputs;
  readonly bitmapFonts: LoadedBitmapFonts;
  readonly uiSkins: LoadedUiSkins;
  readonly audioMix: LoadedAudioMix;
  readonly diagnostics: readonly CliDiagnostic[];
}

const loadCombinedInputs = async (
  projectPath: string,
  assetManifestPath: string | null,
  sceneInstancesPath: string | null,
  artDirectionPath: string | null,
  artEvidencePath: string | null,
  bitmapFontsPath: string | null,
  uiSkinsPath: string | null,
  audioMixPath: string | null,
): Promise<CombinedInputState> => {
  const base = await loadInputs(projectPath, assetManifestPath);
  const sceneInstances = await loadSceneInstances(
    sceneInstancesPath,
    base.project,
    base.assetManifest,
  );
  const art = await loadArtInputs(
    artDirectionPath,
    artEvidencePath,
    base.project,
    base.assetManifest,
  );
  const bitmapFonts = await loadBitmapFonts(
    bitmapFontsPath,
    base.project,
    base.assetManifest,
  );
  const uiSkins = await loadUiSkins(
    uiSkinsPath,
    base.project,
    bitmapFonts.manifest,
  );
  const audioMix = await loadAudioMix(
    audioMixPath,
    base.project,
    base.assetManifest,
  );
  return {
    base,
    sceneInstances,
    art,
    bitmapFonts,
    uiSkins,
    audioMix,
    diagnostics: sortDiagnostics([
      ...base.diagnostics,
      ...sceneInstances.diagnostics,
      ...art.diagnostics,
      ...bitmapFonts.diagnostics,
      ...uiSkins.diagnostics,
      ...audioMix.diagnostics,
    ]),
  };
};

const allInputPaths = (loaded: CombinedInputState): readonly string[] => [
  ...inputPaths(loaded.base),
  ...(loaded.sceneInstances.path ? [loaded.sceneInstances.path] : []),
  ...artInputPaths(loaded.art),
  ...bitmapFontInputPaths(loaded.bitmapFonts),
  ...uiSkinInputPaths(loaded.uiSkins),
  ...audioMixInputPaths(loaded.audioMix),
];

const runValidate = async (
  command: Extract<CliCommand, { readonly kind: "validate" }>,
  environment: CliEnvironment,
): Promise<number> => {
  const loaded = await loadCombinedInputs(
    command.projectPath,
    command.assetManifestPath,
    command.sceneInstancesPath,
    command.artDirectionPath,
    command.artEvidencePath,
    command.bitmapFontsPath,
    command.uiSkinsPath,
    command.audioMixPath,
  );
  const valid = !hasErrors(loaded.diagnostics);
  const report = {
    reportVersion: 1 as const,
    command: "validate" as const,
    valid,
    projectId: loaded.base.project.id,
    projectPath: command.projectPath,
    assetManifestPath: command.assetManifestPath,
    sceneInstancesPath: command.sceneInstancesPath,
    artDirectionPath: command.artDirectionPath,
    artEvidencePath: command.artEvidencePath,
    bitmapFontsPath: command.bitmapFontsPath,
    bitmapFontCount: loaded.bitmapFonts.manifest?.fonts.length ?? 0,
    uiSkinsPath: command.uiSkinsPath,
    uiSkinCount: loaded.uiSkins.manifest?.skins.length ?? 0,
    audioMixPath: command.audioMixPath,
    audioCueCount: loaded.audioMix.manifest?.cues.length ?? 0,
    audioSoundscapeCount: loaded.audioMix.manifest?.soundscapes.length ?? 0,
    diagnostics: loaded.diagnostics,
  };
  const human = valid
    ? `Valid project '${loaded.base.project.id}' with ${
        loaded.diagnostics.filter((entry) => entry.severity === "warning").length
      } warning(s).`
    : loaded.diagnostics.map(formatDiagnostic).join("\n");
  writeResult(environment, command.format, report, human);
  return valid ? 0 : 1;
};

const normalizedPath = (value: string): string => {
  const resolved = resolve(value);
  return process.platform === "win32"
    ? resolved.toLocaleLowerCase("en-US")
    : resolved;
};

const sameOutputPath = (left: string, right: string): boolean =>
  normalizedPath(left) === normalizedPath(right);

const isPathWithin = (
  candidatePath: string,
  directoryPath: string,
): boolean => {
  const pathDifference = relative(
    normalizedPath(directoryPath),
    normalizedPath(candidatePath),
  );
  return (
    pathDifference === "" ||
    (!pathDifference.startsWith("..") && !isAbsolute(pathDifference))
  );
};

const assertGeneratedPathsSafe = (
  inputFilePaths: readonly string[],
  generatedPaths: readonly string[],
): void => {
  const inputs = inputFilePaths.map(normalizedPath);
  for (const generatedPath of generatedPaths) {
    if (inputs.includes(normalizedPath(generatedPath))) {
      throw new CliUsageError(
        `Generated output '${generatedPath}' would overwrite an input or evidence file.`,
      );
    }
  }
};

const assertGeneratedFilesSafe = (
  loaded: CombinedInputState,
  generatedPaths: readonly string[],
): void => assertGeneratedPathsSafe(allInputPaths(loaded), generatedPaths);

const assertReleaseDirectorySafe = (
  loaded: CombinedInputState,
  outputDirectory: string,
): void => {
  for (const inputPath of allInputPaths(loaded)) {
    if (isPathWithin(inputPath, outputDirectory)) {
      throw new CliUsageError(
        `Release directory '${outputDirectory}' contains input or evidence file '${inputPath}'.`,
      );
    }
  }
};

const requireCompiledInputs = (
  loaded: CombinedInputState,
  commandName: "compile" | "package",
): NonNullable<LoadedInputs["assetManifest"]> => {
  if (!loaded.base.assetManifest) {
    throw new Error(
      `${commandName} command did not load its required asset manifest.`,
    );
  }
  if (hasErrors(loaded.diagnostics)) {
    throw new CliDataError(loaded.diagnostics);
  }
  return loaded.base.assetManifest;
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

  const loaded = await loadCombinedInputs(
    command.projectPath,
    command.assetManifestPath,
    command.sceneInstancesPath,
    command.artDirectionPath,
    command.artEvidencePath,
    command.bitmapFontsPath,
    command.uiSkinsPath,
    command.audioMixPath,
  );
  const assetManifest = requireCompiledInputs(loaded, "compile");
  assertGeneratedFilesSafe(loaded, [
    command.outputPath,
    ...(command.reportPath ? [command.reportPath] : []),
  ]);

  const compiled = compileProjectWithInstances(
    loaded.base.project,
    assetManifest,
    loaded.sceneInstances.manifest,
    loaded.bitmapFonts.manifest ?? undefined,
    loaded.uiSkins.manifest ?? undefined,
    loaded.audioMix.manifest ?? undefined,
  );
  const report = {
    reportVersion: 1 as const,
    command: "compile" as const,
    valid: true,
    projectId: loaded.base.project.id,
    bundleFingerprint: compiled.fingerprint,
    assetManifestFingerprint: assetManifest.fingerprint,
    assetCompilerVersion: assetManifest.compilerVersion,
    sceneInstancesPath: loaded.sceneInstances.path,
    artDirectionPath: loaded.art.artDirectionPath,
    artEvidencePath: loaded.art.artEvidencePath,
    artProfile: loaded.art.manifest?.profile.preset ?? null,
    bitmapFontsPath: loaded.bitmapFonts.path,
    bitmapFontCount: loaded.bitmapFonts.manifest?.fonts.length ?? 0,
    uiSkinsPath: loaded.uiSkins.path,
    uiSkinCount: loaded.uiSkins.manifest?.skins.length ?? 0,
    audioMixPath: loaded.audioMix.path,
    audioCueCount: loaded.audioMix.manifest?.cues.length ?? 0,
    audioSoundscapeCount: loaded.audioMix.manifest?.soundscapes.length ?? 0,
    outputPath: command.outputPath,
    diagnostics: loaded.diagnostics,
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
    `Compiled project '${loaded.base.project.id}'.`,
    `Bundle: ${resolve(command.outputPath)}`,
    `Fingerprint: ${compiled.fingerprint}`,
    ...(loaded.art.manifest
      ? [`Art profile: ${loaded.art.manifest.profile.preset}`]
      : []),
    ...(loaded.bitmapFonts.manifest
      ? [`Bitmap fonts: ${loaded.bitmapFonts.manifest.fonts.length}`]
      : []),
    ...(loaded.uiSkins.manifest
      ? [`Interface skins: ${loaded.uiSkins.manifest.skins.length}`]
      : []),
    ...(loaded.audioMix.manifest
      ? [
          `Audio cues: ${loaded.audioMix.manifest.cues.length}`,
          `Soundscapes: ${loaded.audioMix.manifest.soundscapes.length}`,
        ]
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
  const loaded = await loadCombinedInputs(
    command.projectPath,
    command.assetManifestPath,
    command.sceneInstancesPath,
    command.artDirectionPath,
    command.artEvidencePath,
    command.bitmapFontsPath,
    command.uiSkinsPath,
    command.audioMixPath,
  );
  const assetManifest = requireCompiledInputs(loaded, "package");
  if (!loaded.base.manifestPath) {
    throw new Error("Package command did not resolve its asset manifest path.");
  }
  assertReleaseDirectorySafe(loaded, command.outputDirectory);

  const compiled = compileProjectWithInstances(
    loaded.base.project,
    assetManifest,
    loaded.sceneInstances.manifest,
    loaded.bitmapFonts.manifest ?? undefined,
    loaded.uiSkins.manifest ?? undefined,
    loaded.audioMix.manifest ?? undefined,
  );
  const artifacts = await readVerifiedRuntimeOutputs(
    loaded.base.manifestPath,
    assetManifest,
  );
  const release = buildRelease(compiled, assetManifest, artifacts);
  const outputDirectory = await replaceDirectoryAtomically(
    command.outputDirectory,
    release.files,
  );

  const report = {
    reportVersion: 1 as const,
    command: "package" as const,
    valid: true,
    projectId: loaded.base.project.id,
    outputDirectory,
    bundleFingerprint: compiled.fingerprint,
    releaseFingerprint: release.fingerprint,
    assetManifestFingerprint: assetManifest.fingerprint,
    sceneInstancesPath: loaded.sceneInstances.path,
    artDirectionPath: loaded.art.artDirectionPath,
    artEvidencePath: loaded.art.artEvidencePath,
    artProfile: loaded.art.manifest?.profile.preset ?? null,
    bitmapFontsPath: loaded.bitmapFonts.path,
    bitmapFontCount: loaded.bitmapFonts.manifest?.fonts.length ?? 0,
    uiSkinsPath: loaded.uiSkins.path,
    uiSkinCount: loaded.uiSkins.manifest?.skins.length ?? 0,
    audioMixPath: loaded.audioMix.path,
    audioCueCount: loaded.audioMix.manifest?.cues.length ?? 0,
    audioSoundscapeCount: loaded.audioMix.manifest?.soundscapes.length ?? 0,
    fileCount: release.files.length,
    diagnostics: loaded.diagnostics,
  };
  const human = [
    `Packaged project '${loaded.base.project.id}'.`,
    `Release: ${outputDirectory}`,
    `Files: ${release.files.length}`,
    `Bundle fingerprint: ${compiled.fingerprint}`,
    `Release fingerprint: ${release.fingerprint}`,
    ...(loaded.art.manifest
      ? [`Art profile: ${loaded.art.manifest.profile.preset}`]
      : []),
    ...(loaded.bitmapFonts.manifest
      ? [`Bitmap fonts: ${loaded.bitmapFonts.manifest.fonts.length}`]
      : []),
    ...(loaded.uiSkins.manifest
      ? [`Interface skins: ${loaded.uiSkins.manifest.skins.length}`]
      : []),
    ...(loaded.audioMix.manifest
      ? [
          `Audio cues: ${loaded.audioMix.manifest.cues.length}`,
          `Soundscapes: ${loaded.audioMix.manifest.soundscapes.length}`,
        ]
      : []),
  ].join("\n");
  writeResult(environment, command.format, report, human);
  return 0;
};

const runArtEvidence = async (
  command: Extract<CliCommand, { readonly kind: "art-evidence" }>,
  environment: CliEnvironment,
): Promise<number> => {
  const loaded = await loadInputs(
    command.projectPath,
    command.assetManifestPath,
  );
  const manifest = loaded.assetManifest;
  if (!loaded.manifestPath || !manifest) {
    throw new Error(
      "Art-evidence command did not load its required asset manifest.",
    );
  }
  if (hasErrors(loaded.diagnostics)) {
    throw new CliDataError(loaded.diagnostics);
  }

  assertGeneratedPathsSafe(inputPaths(loaded), [command.outputPath]);
  const artifacts = await readVerifiedRuntimeOutputs(
    loaded.manifestPath,
    manifest,
  );
  const outputs = new Map(
    artifacts.map((artifact) => [
      `${artifact.assetId}:${artifact.output.role}`,
      artifact.data,
    ] as const),
  );
  const evidence = await createArtVisualEvidenceFromAssetManifest(
    manifest,
    async (assetId, output) => {
      const data = outputs.get(`${assetId}:${output.role}`);
      if (!data) {
        throw new Error(
          `Verified runtime output '${assetId}:${output.role}' is unavailable.`,
        );
      }
      return data;
    },
  );
  await writeFilesAtomically([
    {
      path: command.outputPath,
      data: withTrailingNewline(JSON.stringify(evidence, null, 2)),
    },
  ]);

  const visualOutputCount = evidence.assets.reduce(
    (total, asset) =>
      total + (asset.kind === "image" ? 1 : asset.pages.length),
    0,
  );
  const report = {
    reportVersion: 1 as const,
    command: "art-evidence" as const,
    valid: true,
    projectId: loaded.project.id,
    assetManifestFingerprint: manifest.fingerprint,
    outputPath: resolve(command.outputPath),
    assetCount: evidence.assets.length,
    visualOutputCount,
  };
  writeResult(
    environment,
    command.format,
    report,
    [
      `Generated art evidence for '${loaded.project.id}'.`,
      `Assets: ${evidence.assets.length}`,
      `Visual outputs: ${visualOutputCount}`,
      `Evidence: ${resolve(command.outputPath)}`,
    ].join("\n"),
  );
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
      case "art-evidence":
        return await runArtEvidence(command, environment);
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
