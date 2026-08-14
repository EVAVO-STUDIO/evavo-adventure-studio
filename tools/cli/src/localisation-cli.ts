import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  canonicalStringify,
  type CompiledProject,
} from "@evavo/adventure-compiler";
import { attachRuntimeLocalisation } from "@evavo/adventure-compiler/with-localisation";
import {
  type AdventureProject,
  parseAdventureProject,
} from "@evavo/adventure-project-schema";
import {
  createLocalisationTemplate,
  createPseudoLocalisationLocale,
  extractLocalisableText,
  type LocalisationManifest,
  parseLocalisationManifest,
  validateLocalisationManifest,
} from "@evavo/adventure-project-schema/localisation";
import {
  type RuntimeBundle,
  parseRuntimeBundle,
} from "@evavo/adventure-runtime-bundle";
import {
  CliDataError,
  type CliDiagnostic,
  formatDiagnostic,
  hasErrors,
  sortDiagnostics,
} from "./diagnostics.js";
import {
  withTrailingNewline,
  writeFilesAtomically,
} from "./filesystem.js";

export type LocalisationCliOutputFormat = "human" | "json";

export interface LocalisationSourceCommand {
  readonly kind: "source";
  readonly projectPath: string;
  readonly outputPath: string;
  readonly format: LocalisationCliOutputFormat;
}

export interface LocalisationTemplateCommand {
  readonly kind: "template";
  readonly projectPath: string;
  readonly sourceLocale: string;
  readonly locale: string;
  readonly label: string | null;
  readonly outputPath: string;
  readonly format: LocalisationCliOutputFormat;
}

export interface LocalisationPseudoCommand {
  readonly kind: "pseudo";
  readonly projectPath: string;
  readonly sourceLocale: string;
  readonly locale: string;
  readonly label: string | null;
  readonly outputPath: string;
  readonly format: LocalisationCliOutputFormat;
}

export interface LocalisationValidateCommand {
  readonly kind: "validate";
  readonly projectPath: string;
  readonly localisationPath: string;
  readonly format: LocalisationCliOutputFormat;
}

export interface LocalisationAttachCommand {
  readonly kind: "attach";
  readonly projectPath: string;
  readonly localisationPath: string;
  readonly bundlePath: string;
  readonly outputPath: string;
  readonly defaultLocale: string | null;
  readonly format: LocalisationCliOutputFormat;
}

export interface LocalisationHelpCommand {
  readonly kind: "help";
}

export type LocalisationCliCommand =
  | LocalisationHelpCommand
  | LocalisationSourceCommand
  | LocalisationTemplateCommand
  | LocalisationPseudoCommand
  | LocalisationValidateCommand
  | LocalisationAttachCommand;

export class LocalisationCliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalisationCliUsageError";
  }
}

interface ParsedOptions {
  readonly values: ReadonlyMap<string, string>;
  readonly flags: ReadonlySet<string>;
}

const VALUE_OPTIONS = new Set([
  "--project",
  "--localisation",
  "--bundle",
  "--out",
  "--output",
  "--source-locale",
  "--locale",
  "--label",
  "--default-locale",
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
        throw new LocalisationCliUsageError(`Option '${token}' was supplied more than once.`);
      }
      flags.add(token);
      continue;
    }
    if (!VALUE_OPTIONS.has(token)) {
      throw new LocalisationCliUsageError(`Unknown localisation option '${token}'.`);
    }
    if (values.has(token)) {
      throw new LocalisationCliUsageError(`Option '${token}' was supplied more than once.`);
    }
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) {
      throw new LocalisationCliUsageError(`Option '${token}' requires a value.`);
    }
    values.set(token, value);
    index += 1;
  }
  if (values.has("--out") && values.has("--output")) {
    throw new LocalisationCliUsageError("Use either '--out' or '--output', not both.");
  }
  return { values, flags };
};

const required = (options: ParsedOptions, key: string): string => {
  const value = options.values.get(key);
  if (!value) throw new LocalisationCliUsageError(`Missing required option '${key}'.`);
  return value;
};

const optional = (options: ParsedOptions, key: string): string | null =>
  options.values.get(key) ?? null;

const outputPath = (options: ParsedOptions): string =>
  optional(options, "--out") ?? required(options, "--output");

const format = (options: ParsedOptions): LocalisationCliOutputFormat =>
  options.flags.has("--json") ? "json" : "human";

const assertAllowed = (options: ParsedOptions, allowed: readonly string[]): void => {
  const allowedSet = new Set(allowed);
  for (const key of options.values.keys()) {
    if (!allowedSet.has(key)) {
      throw new LocalisationCliUsageError(`Option '${key}' is not valid for this localisation command.`);
    }
  }
};

export const parseLocalisationCliArguments = (
  argv: readonly string[],
): LocalisationCliCommand | null => {
  const [group, subcommand, ...tokens] = argv;
  if (group !== "localisation" && group !== "localization" && group !== "localize") return null;
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    return { kind: "help" };
  }
  const options = parseOptions(tokens);
  switch (subcommand) {
    case "source":
      assertAllowed(options, ["--project", "--out", "--output"]);
      return {
        kind: "source",
        projectPath: required(options, "--project"),
        outputPath: outputPath(options),
        format: format(options),
      };
    case "template":
      assertAllowed(options, [
        "--project",
        "--source-locale",
        "--locale",
        "--label",
        "--out",
        "--output",
      ]);
      return {
        kind: "template",
        projectPath: required(options, "--project"),
        sourceLocale: required(options, "--source-locale"),
        locale: required(options, "--locale"),
        label: optional(options, "--label"),
        outputPath: outputPath(options),
        format: format(options),
      };
    case "pseudo":
      assertAllowed(options, [
        "--project",
        "--source-locale",
        "--locale",
        "--label",
        "--out",
        "--output",
      ]);
      return {
        kind: "pseudo",
        projectPath: required(options, "--project"),
        sourceLocale: required(options, "--source-locale"),
        locale: optional(options, "--locale") ?? "qps-ploc",
        label: optional(options, "--label"),
        outputPath: outputPath(options),
        format: format(options),
      };
    case "validate":
      assertAllowed(options, ["--project", "--localisation"]);
      return {
        kind: "validate",
        projectPath: required(options, "--project"),
        localisationPath: required(options, "--localisation"),
        format: format(options),
      };
    case "attach":
      assertAllowed(options, [
        "--project",
        "--localisation",
        "--bundle",
        "--default-locale",
        "--out",
        "--output",
      ]);
      return {
        kind: "attach",
        projectPath: required(options, "--project"),
        localisationPath: required(options, "--localisation"),
        bundlePath: required(options, "--bundle"),
        outputPath: outputPath(options),
        defaultLocale: optional(options, "--default-locale"),
        format: format(options),
      };
    default:
      throw new LocalisationCliUsageError(`Unknown localisation command '${subcommand}'.`);
  }
};

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
  source: "project-schema" | "localisation-schema" | "runtime-bundle-schema",
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

const readJson = async (
  inputPath: string,
  source: "project-file" | "localisation-file" | "runtime-bundle-file",
): Promise<unknown> => {
  const path = resolve(inputPath);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new CliDataError([
      {
        severity: "error",
        source,
        code: "read-failed",
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
  try {
    return parseAdventureProject(await readJson(path, "project-file"));
  } catch (error) {
    if (error instanceof CliDataError) throw error;
    throw new CliDataError(schemaDiagnostics(error, "project-schema"));
  }
};

const loadManifest = async (path: string): Promise<LocalisationManifest> => {
  try {
    return parseLocalisationManifest(await readJson(path, "localisation-file"));
  } catch (error) {
    if (error instanceof CliDataError) throw error;
    throw new CliDataError(schemaDiagnostics(error, "localisation-schema"));
  }
};

const loadBundle = async (path: string): Promise<RuntimeBundle> => {
  try {
    return parseRuntimeBundle(await readJson(path, "runtime-bundle-file"));
  } catch (error) {
    if (error instanceof CliDataError) throw error;
    throw new CliDataError(schemaDiagnostics(error, "runtime-bundle-schema"));
  }
};

const localisationDiagnostics = (
  project: AdventureProject,
  manifest: LocalisationManifest,
): readonly CliDiagnostic[] =>
  sortDiagnostics(
    validateLocalisationManifest(project, manifest).map((issue) => ({
      severity: issue.severity,
      source: "localisation-semantics" as const,
      code: issue.code,
      path: issue.path,
      message: issue.message,
    })),
  );

const assertOutputSafe = (out: string, inputs: readonly string[]): void => {
  const output = resolve(out);
  if (inputs.some((input) => resolve(input) === output)) {
    throw new LocalisationCliUsageError(`Output '${out}' would overwrite an input file.`);
  }
};

export interface LocalisationCliEnvironment {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

const defaultEnvironment: LocalisationCliEnvironment = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

const writeResult = (
  environment: LocalisationCliEnvironment,
  outputFormat: LocalisationCliOutputFormat,
  payload: unknown,
  human: string,
): void => {
  environment.stdout(
    outputFormat === "json"
      ? withTrailingNewline(JSON.stringify(payload, null, 2))
      : withTrailingNewline(human),
  );
};

const writeJsonFile = async (path: string, value: unknown): Promise<void> => {
  await writeFilesAtomically([
    {
      path,
      data: withTrailingNewline(JSON.stringify(value, null, 2)),
    },
  ]);
};

const runSource = async (
  command: LocalisationSourceCommand,
  environment: LocalisationCliEnvironment,
): Promise<number> => {
  assertOutputSafe(command.outputPath, [command.projectPath]);
  const project = await loadProject(command.projectPath);
  const sourceEntries = extractLocalisableText(project);
  const catalogue = {
    catalogueVersion: 1 as const,
    projectId: project.id,
    sourceEntries,
  };
  await writeJsonFile(command.outputPath, catalogue);
  writeResult(
    environment,
    command.format,
    { ...catalogue, outputPath: resolve(command.outputPath) },
    `Extracted ${sourceEntries.length} localisable string(s) from '${project.id}'.\nCatalogue: ${resolve(command.outputPath)}`,
  );
  return 0;
};

const runTemplate = async (
  command: LocalisationTemplateCommand,
  environment: LocalisationCliEnvironment,
): Promise<number> => {
  assertOutputSafe(command.outputPath, [command.projectPath]);
  const project = await loadProject(command.projectPath);
  const manifest = createLocalisationTemplate(project, command.sourceLocale, [
    {
      locale: command.locale,
      ...(command.label ? { label: command.label } : {}),
      status: "draft",
    },
  ]);
  await writeJsonFile(command.outputPath, manifest);
  writeResult(
    environment,
    command.format,
    {
      reportVersion: 1,
      command: "localisation-template",
      valid: true,
      projectId: project.id,
      sourceLocale: command.sourceLocale,
      locale: command.locale,
      stringCount: extractLocalisableText(project).length,
      outputPath: resolve(command.outputPath),
    },
    `Created '${command.locale}' localisation template for '${project.id}'.\nManifest: ${resolve(command.outputPath)}`,
  );
  return 0;
};

const runPseudo = async (
  command: LocalisationPseudoCommand,
  environment: LocalisationCliEnvironment,
): Promise<number> => {
  assertOutputSafe(command.outputPath, [command.projectPath]);
  const project = await loadProject(command.projectPath);
  const locale = createPseudoLocalisationLocale(project, {
    locale: command.locale,
    ...(command.label ? { label: command.label } : {}),
  });
  const manifest = parseLocalisationManifest({
    manifestVersion: 1,
    projectId: project.id,
    sourceLocale: command.sourceLocale,
    locales: [locale],
  });
  await writeJsonFile(command.outputPath, manifest);
  writeResult(
    environment,
    command.format,
    {
      reportVersion: 1,
      command: "localisation-pseudo",
      valid: true,
      projectId: project.id,
      locale: command.locale,
      stringCount: locale.entries.length,
      outputPath: resolve(command.outputPath),
    },
    `Created pseudo-localisation '${command.locale}' for '${project.id}'.\nManifest: ${resolve(command.outputPath)}`,
  );
  return 0;
};

const runValidate = async (
  command: LocalisationValidateCommand,
  environment: LocalisationCliEnvironment,
): Promise<number> => {
  const project = await loadProject(command.projectPath);
  const manifest = await loadManifest(command.localisationPath);
  const diagnostics = localisationDiagnostics(project, manifest);
  const valid = !hasErrors(diagnostics);
  writeResult(
    environment,
    command.format,
    {
      reportVersion: 1,
      command: "localisation-validate",
      valid,
      projectId: project.id,
      sourceLocale: manifest.sourceLocale,
      localeCount: manifest.locales.length,
      diagnostics,
    },
    valid
      ? `Valid localisation for '${project.id}' with ${diagnostics.filter((entry) => entry.severity === "warning").length} warning(s).`
      : diagnostics.map(formatDiagnostic).join("\n"),
  );
  return valid ? 0 : 1;
};

const runAttach = async (
  command: LocalisationAttachCommand,
  environment: LocalisationCliEnvironment,
): Promise<number> => {
  assertOutputSafe(command.outputPath, [
    command.projectPath,
    command.localisationPath,
    command.bundlePath,
  ]);
  const project = await loadProject(command.projectPath);
  const manifest = await loadManifest(command.localisationPath);
  const diagnostics = localisationDiagnostics(project, manifest);
  if (hasErrors(diagnostics)) throw new CliDataError(diagnostics);
  const bundle = await loadBundle(command.bundlePath);
  if (bundle.projectId !== project.id) {
    throw new CliDataError([
      {
        severity: "error",
        source: "localisation-semantics",
        code: "bundle-project-mismatch",
        path: "projectId",
        message: `Runtime bundle project '${bundle.projectId}' does not match '${project.id}'.`,
      },
    ]);
  }
  const defaultLocale = command.defaultLocale ?? manifest.sourceLocale;
  const supportedDefault =
    defaultLocale.toLowerCase() === manifest.sourceLocale.toLowerCase() ||
    manifest.locales.some((locale) => locale.locale.toLowerCase() === defaultLocale.toLowerCase());
  if (!supportedDefault) {
    throw new LocalisationCliUsageError(
      `Default locale '${defaultLocale}' is not the source locale or a declared target locale.`,
    );
  }

  const canonicalJson = canonicalStringify(bundle);
  const base: CompiledProject = {
    bundle,
    canonicalJson,
    fingerprint: "input-runtime-bundle",
    warnings: [],
  };
  const compiled = attachRuntimeLocalisation(base, project, manifest, defaultLocale);
  await writeFilesAtomically([
    { path: command.outputPath, data: withTrailingNewline(compiled.canonicalJson) },
  ]);
  writeResult(
    environment,
    command.format,
    {
      reportVersion: 1,
      command: "localisation-attach",
      valid: true,
      projectId: project.id,
      sourceLocale: manifest.sourceLocale,
      defaultLocale,
      localeCount: manifest.locales.length,
      bundleFingerprint: compiled.fingerprint,
      outputPath: resolve(command.outputPath),
      diagnostics,
    },
    [
      `Attached ${manifest.locales.length} target locale(s) to '${project.id}'.`,
      `Default locale: ${defaultLocale}`,
      `Bundle: ${resolve(command.outputPath)}`,
      `Fingerprint: ${compiled.fingerprint}`,
    ].join("\n"),
  );
  return 0;
};

const writeFailure = (
  argv: readonly string[],
  environment: LocalisationCliEnvironment,
  exitCode: number,
  diagnostics: readonly CliDiagnostic[],
): void => {
  if (argv.includes("--json")) {
    environment.stdout(
      withTrailingNewline(
        JSON.stringify(
          {
            reportVersion: 1,
            command: argv.slice(0, 2).join(" ") || null,
            valid: false,
            exitCode,
            diagnostics,
          },
          null,
          2,
        ),
      ),
    );
  } else {
    environment.stderr(withTrailingNewline(diagnostics.map(formatDiagnostic).join("\n")));
  }
};

export const LOCALISATION_HELP = `Localisation commands:\n  evavo-adventure localisation source --project <project.json> --out <source-catalogue.json> [--json]\n  evavo-adventure localisation template --project <project.json> --source-locale <locale> --locale <locale> [--label <label>] --out <localisation.json> [--json]\n  evavo-adventure localisation pseudo --project <project.json> --source-locale <locale> [--locale <locale>] [--label <label>] --out <pseudo-localisation.json> [--json]\n  evavo-adventure localisation validate --project <project.json> --localisation <localisation.json> [--json]\n  evavo-adventure localisation attach --project <project.json> --localisation <localisation.json> --bundle <runtime.bundle.json> [--default-locale <locale>] --out <localised.bundle.json> [--json]\n`;

export const runLocalisationCli = async (
  argv: readonly string[],
  environment: LocalisationCliEnvironment = defaultEnvironment,
): Promise<number | null> => {
  let command: LocalisationCliCommand | null;
  try {
    command = parseLocalisationCliArguments(argv);
  } catch (error) {
    if (error instanceof LocalisationCliUsageError) {
      if (argv.includes("--json")) {
        writeFailure(argv, environment, 2, [
          {
            severity: "error",
            source: "cli",
            code: "invalid-usage",
            path: "$",
            message: error.message,
          },
        ]);
      } else {
        environment.stderr(`${error.message}\n\n${LOCALISATION_HELP}`);
      }
      return 2;
    }
    throw error;
  }
  if (!command) return null;

  try {
    switch (command.kind) {
      case "help":
        environment.stdout(LOCALISATION_HELP);
        return 0;
      case "source":
        return await runSource(command, environment);
      case "template":
        return await runTemplate(command, environment);
      case "pseudo":
        return await runPseudo(command, environment);
      case "validate":
        return await runValidate(command, environment);
      case "attach":
        return await runAttach(command, environment);
    }
  } catch (error) {
    if (error instanceof LocalisationCliUsageError) {
      const diagnostic: CliDiagnostic = {
        severity: "error",
        source: "cli",
        code: "invalid-usage",
        path: "$",
        message: error.message,
      };
      if (argv.includes("--json")) writeFailure(argv, environment, 2, [diagnostic]);
      else environment.stderr(`${error.message}\n\n${LOCALISATION_HELP}`);
      return 2;
    }
    if (error instanceof CliDataError) {
      writeFailure(argv, environment, 1, error.diagnostics);
      return 1;
    }
    environment.stderr(
      `Unexpected localisation CLI failure: ${
        error instanceof Error ? error.stack ?? error.message : String(error)
      }\n`,
    );
    return 3;
  }
};