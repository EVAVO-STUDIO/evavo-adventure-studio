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

export type CliCommand =
  | HelpCommand
  | VersionCommand
  | ValidateCommand
  | CompileCommand;

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

const requiredValue = (options: ParsedOptions, key: string): string => {
  const value = options.values.get(key);
  if (!value) {
    throw new CliUsageError(`Missing required option '${key}'.`);
  }
  return value;
};

const optionalValue = (options: ParsedOptions, key: string): string | null =>
  options.values.get(key) ?? null;

const outputFormat = (options: ParsedOptions): OutputFormat =>
  options.flags.has("--json") ? "json" : "human";

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
      return {
        kind: "validate",
        projectPath: requiredValue(options, "--project"),
        assetManifestPath: optionalValue(options, "--asset-manifest"),
        format: outputFormat(options),
      };
    case "compile":
      return {
        kind: "compile",
        projectPath: requiredValue(options, "--project"),
        assetManifestPath: requiredValue(options, "--asset-manifest"),
        outputPath:
          optionalValue(options, "--out") ?? requiredValue(options, "--output"),
        reportPath: optionalValue(options, "--report"),
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
  evavo-adventure version

Exit codes:
  0  success
  1  project or asset validation failed
  2  invalid command-line usage
  3  unexpected internal failure
`;
