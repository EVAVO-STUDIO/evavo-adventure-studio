export type OutputFormat = "human" | "json";

export interface HelpCommand {
  readonly kind: "help";
}

export interface VersionCommand {
  readonly kind: "version";
}

export interface ValidateCommand {
  readonly kind: "validate";
  readonly projectPath: string;
  readonly assetManifestPath: string | null;
  readonly sceneInstancesPath: string | null;
  readonly artDirectionPath: string | null;
  readonly artEvidencePath: string | null;
  readonly format: OutputFormat;
}

export interface CompileCommand {
  readonly kind: "compile";
  readonly projectPath: string;
  readonly assetManifestPath: string;
  readonly sceneInstancesPath: string | null;
  readonly artDirectionPath: string | null;
  readonly artEvidencePath: string | null;
  readonly outputPath: string;
  readonly reportPath: string | null;
  readonly format: OutputFormat;
}

export interface PackageCommand {
  readonly kind: "package";
  readonly projectPath: string;
  readonly assetManifestPath: string;
  readonly sceneInstancesPath: string | null;
  readonly artDirectionPath: string | null;
  readonly artEvidencePath: string | null;
  readonly outputDirectory: string;
  readonly format: OutputFormat;
}

export type CliCommand =
  | HelpCommand
  | VersionCommand
  | ValidateCommand
  | CompileCommand
  | PackageCommand;

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

interface ParsedOptions {
  readonly values: ReadonlyMap<string, string>;
  readonly flags: ReadonlySet<string>;
}

const VALUE_OPTIONS = new Set([
  "--project",
  "--asset-manifest",
  "--scene-instances",
  "--art-direction",
  "--art-evidence",
  "--out",
  "--output",
  "--report",
]);

const FLAG_OPTIONS = new Set(["--json"]);

const parseOptions = (tokens: readonly string[]): ParsedOptions => {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;

    if (FLAG_OPTIONS.has(token)) {
      if (flags.has(token)) {
        throw new CliUsageError(`Option '${token}' was supplied more than once.`);
      }
      flags.add(token);
      continue;
    }

    if (!VALUE_OPTIONS.has(token)) {
      throw new CliUsageError(`Unknown option '${token}'.`);
    }
    if (values.has(token)) {
      throw new CliUsageError(`Option '${token}' was supplied more than once.`);
    }

    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) {
      throw new CliUsageError(`Option '${token}' requires a value.`);
    }
    values.set(token, value);
    index += 1;
  }

  if (values.has("--out") && values.has("--output")) {
    throw new CliUsageError("Use either '--out' or '--output', not both.");
  }
  return { values, flags };
};

const assertAllowedOptions = (
  options: ParsedOptions,
  allowedValues: ReadonlySet<string>,
  allowedFlags: ReadonlySet<string>,
): void => {
  for (const option of options.values.keys()) {
    if (!allowedValues.has(option)) {
      throw new CliUsageError(`Option '${option}' is not valid for this command.`);
    }
  }
  for (const option of options.flags) {
    if (!allowedFlags.has(option)) {
      throw new CliUsageError(`Option '${option}' is not valid for this command.`);
    }
  }
};

const requiredValue = (options: ParsedOptions, key: string): string => {
  const value = options.values.get(key);
  if (!value) throw new CliUsageError(`Missing required option '${key}'.`);
  return value;
};

const optionalValue = (options: ParsedOptions, key: string): string | null =>
  options.values.get(key) ?? null;

const outputValue = (options: ParsedOptions): string =>
  optionalValue(options, "--out") ?? requiredValue(options, "--output");

const outputFormat = (options: ParsedOptions): OutputFormat =>
  options.flags.has("--json") ? "json" : "human";

const JSON_FLAG = new Set(["--json"]);
const PROJECT_INPUT_OPTIONS = [
  "--project",
  "--asset-manifest",
  "--scene-instances",
  "--art-direction",
  "--art-evidence",
] as const;

const artPaths = (
  options: ParsedOptions,
): {
  readonly artDirectionPath: string | null;
  readonly artEvidencePath: string | null;
} => {
  const artDirectionPath = optionalValue(options, "--art-direction");
  const artEvidencePath = optionalValue(options, "--art-evidence");
  if (artEvidencePath && !artDirectionPath) {
    throw new CliUsageError(
      "Option '--art-evidence' requires '--art-direction'.",
    );
  }
  if (artEvidencePath && !options.values.has("--asset-manifest")) {
    throw new CliUsageError(
      "Option '--art-evidence' requires '--asset-manifest'.",
    );
  }
  return { artDirectionPath, artEvidencePath };
};

export const parseCliArguments = (argv: readonly string[]): CliCommand => {
  const [command, ...tokens] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    return { kind: "help" };
  }
  if (command === "version" || command === "--version" || command === "-v") {
    if (tokens.length > 0) {
      throw new CliUsageError("The version command does not accept options.");
    }
    return { kind: "version" };
  }

  const options = parseOptions(tokens);
  switch (command) {
    case "validate": {
      assertAllowedOptions(options, new Set(PROJECT_INPUT_OPTIONS), JSON_FLAG);
      const art = artPaths(options);
      return {
        kind: "validate",
        projectPath: requiredValue(options, "--project"),
        assetManifestPath: optionalValue(options, "--asset-manifest"),
        sceneInstancesPath: optionalValue(options, "--scene-instances"),
        ...art,
        format: outputFormat(options),
      };
    }
    case "compile": {
      assertAllowedOptions(
        options,
        new Set([
          ...PROJECT_INPUT_OPTIONS,
          "--out",
          "--output",
          "--report",
        ]),
        JSON_FLAG,
      );
      const art = artPaths(options);
      return {
        kind: "compile",
        projectPath: requiredValue(options, "--project"),
        assetManifestPath: requiredValue(options, "--asset-manifest"),
        sceneInstancesPath: optionalValue(options, "--scene-instances"),
        ...art,
        outputPath: outputValue(options),
        reportPath: optionalValue(options, "--report"),
        format: outputFormat(options),
      };
    }
    case "package": {
      assertAllowedOptions(
        options,
        new Set([...PROJECT_INPUT_OPTIONS, "--out", "--output"]),
        JSON_FLAG,
      );
      const art = artPaths(options);
      return {
        kind: "package",
        projectPath: requiredValue(options, "--project"),
        assetManifestPath: requiredValue(options, "--asset-manifest"),
        sceneInstancesPath: optionalValue(options, "--scene-instances"),
        ...art,
        outputDirectory: outputValue(options),
        format: outputFormat(options),
      };
    }
    default:
      throw new CliUsageError(`Unknown command '${command}'.`);
  }
};

export const CLI_HELP = `EVAVO Adventure Studio CLI

Usage:
  evavo-adventure validate --project <project.json> [--asset-manifest <assets.json>] [--scene-instances <scene-instances.json>] [--art-direction <art-direction.json>] [--art-evidence <art-evidence.json>] [--json]
  evavo-adventure compile --project <project.json> --asset-manifest <assets.json> [--scene-instances <scene-instances.json>] [--art-direction <art-direction.json>] [--art-evidence <art-evidence.json>] --out <game.bundle.json> [--report <report.json>] [--json]
  evavo-adventure package --project <project.json> --asset-manifest <assets.json> [--scene-instances <scene-instances.json>] [--art-direction <art-direction.json>] [--art-evidence <art-evidence.json>] --out <release-directory> [--json]
  evavo-adventure version

Exit codes:
  0  success
  1  project, asset, scene composition or art evidence validation failed
  2  invalid command-line usage
  3  unexpected internal failure
`;
