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
  readonly format: OutputFormat;
}

export interface CompileCommand {
  readonly kind: "compile";
  readonly projectPath: string;
  readonly assetManifestPath: string;
  readonly outputPath: string;
  readonly reportPath: string | null;
  readonly format: OutputFormat;
}

export interface PackageCommand {
  readonly kind: "package";
  readonly projectPath: string;
  readonly assetManifestPath: string;
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
    if (!token) {
      continue;
    }

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
  if (!value) {
    throw new CliUsageError(`Missing required option '${key}'.`);
  }
  return value;
};

const optionalValue = (options: ParsedOptions, key: string): string | null =>
  options.values.get(key) ?? null;

const outputValue = (options: ParsedOptions): string =>
  optionalValue(options, "--out") ?? requiredValue(options, "--output");

const outputFormat = (options: ParsedOptions): OutputFormat =>
  options.flags.has("--json") ? "json" : "human";

const JSON_FLAG = new Set(["--json"]);

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
    case "validate":
      assertAllowedOptions(
        options,
        new Set(["--project", "--asset-manifest"]),
        JSON_FLAG,
      );
      return {
        kind: "validate",
        projectPath: requiredValue(options, "--project"),
        assetManifestPath: optionalValue(options, "--asset-manifest"),
        format: outputFormat(options),
      };
    case "compile":
      assertAllowedOptions(
        options,
        new Set([
          "--project",
          "--asset-manifest",
          "--out",
          "--output",
          "--report",
        ]),
        JSON_FLAG,
      );
      return {
        kind: "compile",
        projectPath: requiredValue(options, "--project"),
        assetManifestPath: requiredValue(options, "--asset-manifest"),
        outputPath: outputValue(options),
        reportPath: optionalValue(options, "--report"),
        format: outputFormat(options),
      };
    case "package":
      assertAllowedOptions(
        options,
        new Set(["--project", "--asset-manifest", "--out", "--output"]),
        JSON_FLAG,
      );
      return {
        kind: "package",
        projectPath: requiredValue(options, "--project"),
        assetManifestPath: requiredValue(options, "--asset-manifest"),
        outputDirectory: outputValue(options),
        format: outputFormat(options),
      };
    default:
      throw new CliUsageError(`Unknown command '${command}'.`);
  }
};

export const CLI_HELP = `EVAVO Adventure Studio CLI

Usage:
  evavo-adventure validate --project <project.json> [--asset-manifest <assets.json>] [--json]
  evavo-adventure compile --project <project.json> --asset-manifest <assets.json> --out <game.bundle.json> [--report <report.json>] [--json]
  evavo-adventure package --project <project.json> --asset-manifest <assets.json> --out <release-directory> [--json]
  evavo-adventure version

Exit codes:
  0  success
  1  project or asset validation failed
  2  invalid command-line usage
  3  unexpected internal failure
`;
