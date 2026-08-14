import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  canonicalStringify,
  type CompiledProject,
} from "@evavo/adventure-compiler";
import { attachRuntimeLifecycle } from "@evavo/adventure-compiler/with-lifecycle";
import {
  type AdventureProject,
  parseAdventureProject,
} from "@evavo/adventure-project-schema";
import {
  createDefaultFailureLifecycleMenu,
  type GameLifecycleManifest,
  parseGameLifecycleManifest,
} from "@evavo/adventure-project-schema/lifecycle";
import {
  type RuntimeBundle,
  parseRuntimeBundle,
} from "@evavo/adventure-runtime-bundle";
import {
  CliDataError,
  type CliDiagnostic,
  formatDiagnostic,
} from "./diagnostics.js";
import {
  withTrailingNewline,
  writeFilesAtomically,
} from "./filesystem.js";

export type LifecycleCliOutputFormat = "human" | "json";

export type LifecycleCliCommand =
  | { readonly kind: "help" }
  | {
      readonly kind: "template";
      readonly projectPath: string;
      readonly outcomeKind: "failure" | "success";
      readonly outputPath: string;
      readonly format: LifecycleCliOutputFormat;
    }
  | {
      readonly kind: "validate";
      readonly projectPath: string;
      readonly lifecyclePath: string;
      readonly format: LifecycleCliOutputFormat;
    }
  | {
      readonly kind: "attach";
      readonly lifecyclePath: string;
      readonly bundlePath: string;
      readonly outputPath: string;
      readonly format: LifecycleCliOutputFormat;
    };

export class LifecycleCliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LifecycleCliUsageError";
  }
}

interface ParsedOptions {
  readonly values: ReadonlyMap<string, string>;
  readonly flags: ReadonlySet<string>;
}

const VALUE_OPTIONS = new Set([
  "--project",
  "--lifecycle",
  "--bundle",
  "--kind",
  "--out",
  "--output",
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
        throw new LifecycleCliUsageError(`Option '${token}' was supplied more than once.`);
      }
      flags.add(token);
      continue;
    }
    if (!VALUE_OPTIONS.has(token)) {
      throw new LifecycleCliUsageError(`Unknown lifecycle option '${token}'.`);
    }
    if (values.has(token)) {
      throw new LifecycleCliUsageError(`Option '${token}' was supplied more than once.`);
    }
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) {
      throw new LifecycleCliUsageError(`Option '${token}' requires a value.`);
    }
    values.set(token, value);
    index += 1;
  }
  if (values.has("--out") && values.has("--output")) {
    throw new LifecycleCliUsageError("Use either '--out' or '--output', not both.");
  }
  return { values, flags };
};

const required = (options: ParsedOptions, key: string): string => {
  const value = options.values.get(key);
  if (!value) throw new LifecycleCliUsageError(`Missing required option '${key}'.`);
  return value;
};

const outputPath = (options: ParsedOptions): string =>
  options.values.get("--out") ?? required(options, "--output");

const outputFormat = (options: ParsedOptions): LifecycleCliOutputFormat =>
  options.flags.has("--json") ? "json" : "human";

const assertAllowed = (options: ParsedOptions, allowed: readonly string[]): void => {
  const values = new Set(allowed);
  for (const key of options.values.keys()) {
    if (!values.has(key)) {
      throw new LifecycleCliUsageError(`Option '${key}' is not valid for this lifecycle command.`);
    }
  }
};

export const parseLifecycleCliArguments = (argv: readonly string[]): LifecycleCliCommand | null => {
  const [group, subcommand, ...tokens] = argv;
  if (group !== "lifecycle" && group !== "ending" && group !== "endings") return null;
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    return { kind: "help" };
  }
  const options = parseOptions(tokens);
  switch (subcommand) {
    case "template": {
      assertAllowed(options, ["--project", "--kind", "--out", "--output"]);
      const outcomeKind = required(options, "--kind");
      if (outcomeKind !== "failure" && outcomeKind !== "success") {
        throw new LifecycleCliUsageError("Option '--kind' must be 'failure' or 'success'.");
      }
      return {
        kind: "template",
        projectPath: required(options, "--project"),
        outcomeKind,
        outputPath: outputPath(options),
        format: outputFormat(options),
      };
    }
    case "validate":
      assertAllowed(options, ["--project", "--lifecycle"]);
      return {
        kind: "validate",
        projectPath: required(options, "--project"),
        lifecyclePath: required(options, "--lifecycle"),
        format: outputFormat(options),
      };
    case "attach":
      assertAllowed(options, ["--lifecycle", "--bundle", "--out", "--output"]);
      return {
        kind: "attach",
        lifecyclePath: required(options, "--lifecycle"),
        bundlePath: required(options, "--bundle"),
        outputPath: outputPath(options),
        format: outputFormat(options),
      };
    default:
      throw new LifecycleCliUsageError(`Unknown lifecycle command '${subcommand}'.`);
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
  source: "project-schema" | "lifecycle-schema" | "runtime-bundle-schema",
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
        readonly path?: unknown;
        readonly message?: unknown;
      };
      const path = Array.isArray(candidate.path)
        ? schemaPath(candidate.path as readonly PropertyKey[])
        : String(candidate.path ?? "$");
      return {
        severity: "error" as const,
        source,
        code: String(candidate.code ?? "schema-invalid"),
        path,
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
  source: "project-file" | "lifecycle-file" | "runtime-bundle-file",
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

const loadLifecycle = async (path: string): Promise<GameLifecycleManifest> => {
  try {
    return parseGameLifecycleManifest(await readJson(path, "lifecycle-file"));
  } catch (error) {
    if (error instanceof CliDataError) throw error;
    throw new CliDataError(schemaDiagnostics(error, "lifecycle-schema"));
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

const assertOutputSafe = (out: string, inputs: readonly string[]): void => {
  const resolved = resolve(out);
  if (inputs.some((input) => resolve(input) === resolved)) {
    throw new LifecycleCliUsageError(`Output '${out}' would overwrite an input file.`);
  }
};

export interface LifecycleCliEnvironment {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

const defaultEnvironment: LifecycleCliEnvironment = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

const writeResult = (
  environment: LifecycleCliEnvironment,
  format: LifecycleCliOutputFormat,
  payload: unknown,
  human: string,
): void => {
  environment.stdout(
    format === "json"
      ? withTrailingNewline(JSON.stringify(payload, null, 2))
      : withTrailingNewline(human),
  );
};

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFilesAtomically([
    { path, data: withTrailingNewline(JSON.stringify(value, null, 2)) },
  ]);
};

const templateManifest = (
  project: AdventureProject,
  kind: "failure" | "success",
): GameLifecycleManifest => {
  const menu = createDefaultFailureLifecycleMenu();
  return parseGameLifecycleManifest({
    manifestVersion: 1,
    projectId: project.id,
    outcomes: [
      {
        id: `outcome.${kind}`,
        kind,
        priority: kind === "failure" ? 50 : 25,
        when: { kind: "flag", flag: kind === "failure" ? "case.failed" : "case.solved", equals: true },
        title: kind === "failure" ? "Case Closed" : "Case Solved",
        message:
          kind === "failure"
            ? "Author the consequence that ends this route."
            : "Author the resolution that completes this route.",
        menu: kind === "success" ? { ...menu, allowQuickRetry: false } : menu,
      },
    ],
  });
};

const runTemplate = async (
  command: Extract<LifecycleCliCommand, { readonly kind: "template" }>,
  environment: LifecycleCliEnvironment,
): Promise<number> => {
  assertOutputSafe(command.outputPath, [command.projectPath]);
  const project = await loadProject(command.projectPath);
  const manifest = templateManifest(project, command.outcomeKind);
  await writeJson(command.outputPath, manifest);
  writeResult(
    environment,
    command.format,
    {
      reportVersion: 1,
      command: "lifecycle-template",
      valid: true,
      projectId: project.id,
      outcomeKind: command.outcomeKind,
      outputPath: resolve(command.outputPath),
    },
    `Created ${command.outcomeKind} lifecycle template for '${project.id}'.\nManifest: ${resolve(command.outputPath)}`,
  );
  return 0;
};

const runValidate = async (
  command: Extract<LifecycleCliCommand, { readonly kind: "validate" }>,
  environment: LifecycleCliEnvironment,
): Promise<number> => {
  const project = await loadProject(command.projectPath);
  const lifecycle = await loadLifecycle(command.lifecyclePath);
  const diagnostics: CliDiagnostic[] = [];
  if (lifecycle.projectId !== project.id) {
    diagnostics.push({
      severity: "error",
      source: "lifecycle-semantics",
      code: "project-mismatch",
      path: "projectId",
      message: `Lifecycle project '${lifecycle.projectId}' does not match '${project.id}'.`,
    });
  }
  const valid = diagnostics.length === 0;
  writeResult(
    environment,
    command.format,
    {
      reportVersion: 1,
      command: "lifecycle-validate",
      valid,
      projectId: project.id,
      lifecycleProjectId: lifecycle.projectId,
      outcomeCount: lifecycle.outcomes.length,
      diagnostics,
    },
    valid
      ? `Valid lifecycle for '${project.id}' with ${lifecycle.outcomes.length} outcome(s).`
      : diagnostics.map(formatDiagnostic).join("\n"),
  );
  return valid ? 0 : 1;
};

const runAttach = async (
  command: Extract<LifecycleCliCommand, { readonly kind: "attach" }>,
  environment: LifecycleCliEnvironment,
): Promise<number> => {
  assertOutputSafe(command.outputPath, [command.lifecyclePath, command.bundlePath]);
  const lifecycle = await loadLifecycle(command.lifecyclePath);
  const bundle = await loadBundle(command.bundlePath);
  if (lifecycle.projectId !== bundle.projectId) {
    throw new CliDataError([
      {
        severity: "error",
        source: "lifecycle-semantics",
        code: "bundle-project-mismatch",
        path: "projectId",
        message: `Lifecycle project '${lifecycle.projectId}' does not match runtime project '${bundle.projectId}'.`,
      },
    ]);
  }
  const base: CompiledProject = {
    bundle,
    canonicalJson: canonicalStringify(bundle),
    fingerprint: "input-runtime-bundle",
    warnings: [],
  };
  const compiled = attachRuntimeLifecycle(base, lifecycle);
  await writeFilesAtomically([
    { path: command.outputPath, data: withTrailingNewline(compiled.canonicalJson) },
  ]);
  writeResult(
    environment,
    command.format,
    {
      reportVersion: 1,
      command: "lifecycle-attach",
      valid: true,
      projectId: bundle.projectId,
      outcomeCount: lifecycle.outcomes.length,
      bundleFingerprint: compiled.fingerprint,
      outputPath: resolve(command.outputPath),
    },
    [
      `Attached ${lifecycle.outcomes.length} lifecycle outcome(s) to '${bundle.projectId}'.`,
      `Bundle: ${resolve(command.outputPath)}`,
      `Fingerprint: ${compiled.fingerprint}`,
    ].join("\n"),
  );
  return 0;
};

const writeFailure = (
  argv: readonly string[],
  environment: LifecycleCliEnvironment,
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

export const LIFECYCLE_HELP = `Lifecycle / ending commands:\n  evavo-adventure lifecycle template --project <project.json> --kind <failure|success> --out <game-lifecycle.json> [--json]\n  evavo-adventure lifecycle validate --project <project.json> --lifecycle <game-lifecycle.json> [--json]\n  evavo-adventure lifecycle attach --lifecycle <game-lifecycle.json> --bundle <runtime.bundle.json> --out <lifecycle.bundle.json> [--json]\n`;

export const runLifecycleCli = async (
  argv: readonly string[],
  environment: LifecycleCliEnvironment = defaultEnvironment,
): Promise<number | null> => {
  let command: LifecycleCliCommand | null;
  try {
    command = parseLifecycleCliArguments(argv);
  } catch (error) {
    if (error instanceof LifecycleCliUsageError) {
      const diagnostic: CliDiagnostic = {
        severity: "error",
        source: "cli",
        code: "invalid-usage",
        path: "$",
        message: error.message,
      };
      if (argv.includes("--json")) writeFailure(argv, environment, 2, [diagnostic]);
      else environment.stderr(`${error.message}\n\n${LIFECYCLE_HELP}`);
      return 2;
    }
    throw error;
  }
  if (!command) return null;

  try {
    switch (command.kind) {
      case "help":
        environment.stdout(LIFECYCLE_HELP);
        return 0;
      case "template":
        return await runTemplate(command, environment);
      case "validate":
        return await runValidate(command, environment);
      case "attach":
        return await runAttach(command, environment);
    }
  } catch (error) {
    if (error instanceof LifecycleCliUsageError) {
      const diagnostic: CliDiagnostic = {
        severity: "error",
        source: "cli",
        code: "invalid-usage",
        path: "$",
        message: error.message,
      };
      if (argv.includes("--json")) writeFailure(argv, environment, 2, [diagnostic]);
      else environment.stderr(`${error.message}\n\n${LIFECYCLE_HELP}`);
      return 2;
    }
    if (error instanceof CliDataError) {
      writeFailure(argv, environment, 1, error.diagnostics);
      return 1;
    }
    environment.stderr(
      `Unexpected lifecycle CLI failure: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
    );
    return 3;
  }
};