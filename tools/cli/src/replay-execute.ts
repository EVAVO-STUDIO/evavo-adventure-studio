import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  executeInspectedReplay,
  ReplayExecutionLimitError,
  resolveReplayExecutionLimits,
  type ReplayExecutionLimits,
} from "@evavo/adventure-playtest-inspector/replay-execution";
import {
  ReplayCompatibilityError,
  ReplayDivergenceError,
  ReplayExecutionError,
  ReplayIntegrityError,
} from "@evavo/adventure-replay";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  assertReplayOutputPath,
  ReplayOutputCollisionError,
  ReplayOutputExistsError,
  writeReplayOutputSave,
} from "./replay-output.js";

export interface ReplayExecuteCliEnvironment {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export const defaultReplayExecuteCliEnvironment: ReplayExecuteCliEnvironment = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

export const REPLAY_EXECUTE_HELP = `Replay execution

Usage:
  evavo-adventure replay-execute --bundle <game.bundle.json> --replay <replay.json> [--output-save <final.save.json>] [--max-events <count>] [--max-duration-ticks <ticks>] [--json]
`;

interface ReplayExecuteCommand {
  readonly bundlePath: string;
  readonly replayPath: string;
  readonly outputSavePath: string | null;
  readonly maxEvents: number | undefined;
  readonly maxDurationTicks: number | undefined;
  readonly json: boolean;
}

interface ReplayExecuteDiagnostic {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

class ReplayExecuteUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayExecuteUsageError";
  }
}

class ReplayExecuteInputError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, path: string, message: string) {
    super(message);
    this.name = "ReplayExecuteInputError";
    this.code = code;
    this.path = path;
  }
}

const positiveIntegerOption = (
  values: ReadonlyMap<string, string>,
  option: string,
): number | undefined => {
  const value = values.get(option);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ReplayExecuteUsageError(
      `Option '${option}' must be a positive safe integer.`,
    );
  }
  return parsed;
};

const parseCommand = (argv: readonly string[]): ReplayExecuteCommand | null => {
  const [command, ...tokens] = argv;
  if (command !== "replay-execute") return null;

  const values = new Map<string, string>();
  const allowed = new Set([
    "--bundle",
    "--replay",
    "--output-save",
    "--max-events",
    "--max-duration-ticks",
  ]);
  let json = false;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    if (token === "--json") {
      if (json) {
        throw new ReplayExecuteUsageError(
          "Option '--json' was supplied more than once.",
        );
      }
      json = true;
      continue;
    }
    if (!allowed.has(token)) {
      throw new ReplayExecuteUsageError(
        `Option '${token}' is not valid for 'replay-execute'.`,
      );
    }
    if (values.has(token)) {
      throw new ReplayExecuteUsageError(
        `Option '${token}' was supplied more than once.`,
      );
    }
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) {
      throw new ReplayExecuteUsageError(`Option '${token}' requires a value.`);
    }
    values.set(token, value);
    index += 1;
  }

  const bundlePath = values.get("--bundle");
  const replayPath = values.get("--replay");
  if (!bundlePath) {
    throw new ReplayExecuteUsageError("Missing required option '--bundle'.");
  }
  if (!replayPath) {
    throw new ReplayExecuteUsageError("Missing required option '--replay'.");
  }

  return {
    bundlePath,
    replayPath,
    outputSavePath: values.get("--output-save") ?? null,
    maxEvents: positiveIntegerOption(values, "--max-events"),
    maxDurationTicks: positiveIntegerOption(
      values,
      "--max-duration-ticks",
    ),
    json,
  };
};

const readJson = async (path: string, label: string): Promise<unknown> => {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { readonly code: unknown }).code)
        : "read-failed";
    throw new ReplayExecuteInputError(
      code,
      path,
      `Unable to read ${label} '${path}': ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new ReplayExecuteInputError(
      "invalid-json",
      path,
      `Invalid JSON in ${label} '${path}': ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const issuePath = (value: unknown): string => {
  if (!Array.isArray(value)) return String(value ?? "$ ").trim() || "$";
  let output = "";
  for (const segment of value) {
    output +=
      typeof segment === "number"
        ? `[${segment}]`
        : output
          ? `.${String(segment)}`
          : String(segment);
  }
  return output || "$";
};

const issueDiagnostic = (error: unknown): ReplayExecuteDiagnostic | null => {
  if (
    typeof error !== "object" ||
    error === null ||
    !("issues" in error) ||
    !Array.isArray((error as { readonly issues: unknown }).issues)
  ) {
    return null;
  }
  const first = (error as { readonly issues: readonly unknown[] }).issues[0] as
    | {
        readonly code?: unknown;
        readonly path?: unknown;
        readonly message?: unknown;
      }
    | undefined;
  return {
    code: String(first?.code ?? "runtime-bundle-invalid"),
    path: issuePath(first?.path),
    message:
      first?.message === undefined
        ? error instanceof Error
          ? error.message
          : "Runtime bundle validation failed."
        : String(first.message),
  };
};

const executionError = (error: unknown): ReplayExecuteDiagnostic => {
  if (error instanceof ReplayExecuteInputError) {
    return { code: error.code, path: error.path, message: error.message };
  }
  if (error instanceof ReplayOutputCollisionError) {
    return {
      code: "output-collides-with-input",
      path: "--output-save",
      message: error.message,
    };
  }
  if (error instanceof ReplayOutputExistsError) {
    return {
      code: "output-exists",
      path: error.outputPath,
      message: error.message,
    };
  }
  if (error instanceof ReplayExecutionLimitError) {
    return {
      code: "replay-limit-exceeded",
      path:
        error.code === "event-count-exceeded"
          ? "events"
          : "finalTick",
      message: error.message,
    };
  }
  if (error instanceof ReplayIntegrityError) {
    return { code: "replay-integrity", path: "$", message: error.message };
  }
  if (error instanceof ReplayCompatibilityError) {
    return {
      code: "replay-compatibility",
      path: error.issues[0]?.path ?? "$",
      message: error.message,
    };
  }
  if (error instanceof ReplayDivergenceError) {
    return {
      code: "replay-divergence",
      path: "expectedFinalSaveFingerprint",
      message: error.message,
    };
  }
  if (error instanceof ReplayExecutionError) {
    return { code: "replay-execution", path: "$", message: error.message };
  }
  if (
    error instanceof Error &&
    error.name === "ControlledActorSaveMismatchError"
  ) {
    return {
      code: "controlled-actor-mismatch",
      path: "initialSave.interface.controlledActorInstanceId",
      message: error.message,
    };
  }
  if (error instanceof Error && error.name === "ZodError") {
    return { code: "schema-invalid", path: "$", message: error.message };
  }
  const issue = issueDiagnostic(error);
  if (issue) return issue;
  return {
    code: "replay-execute-failed",
    path: "$",
    message: error instanceof Error ? error.message : String(error),
  };
};

export const replayExecuteExitCodeForDiagnosticCode = (
  code: string,
): 1 | 3 => (code === "replay-execute-failed" ? 3 : 1);

const writeFailure = (
  command: ReplayExecuteCommand,
  environment: ReplayExecuteCliEnvironment,
  exitCode: number,
  error: ReplayExecuteDiagnostic,
): void => {
  const report = {
    reportVersion: 1,
    command: "replay-execute",
    valid: false,
    exitCode,
    diagnostics: [
      {
        severity: "error",
        source: "replay-execution",
        code: error.code,
        path: error.path,
        message: error.message,
      },
    ],
  };
  if (command.json) {
    environment.stdout(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    environment.stderr(
      `[ERROR] replay-execution/${error.code} ${error.path}: ${error.message}\n`,
    );
  }
};

const commandLimits = (
  command: ReplayExecuteCommand,
): ReplayExecutionLimits => ({
  ...(command.maxEvents !== undefined
    ? { maxEvents: command.maxEvents }
    : {}),
  ...(command.maxDurationTicks !== undefined
    ? { maxDurationTicks: command.maxDurationTicks }
    : {}),
});

export const runReplayExecuteCli = async (
  argv: readonly string[],
  environment: ReplayExecuteCliEnvironment = defaultReplayExecuteCliEnvironment,
): Promise<number | null> => {
  let command: ReplayExecuteCommand | null;
  try {
    command = parseCommand(argv);
  } catch (error) {
    if (!(error instanceof ReplayExecuteUsageError)) throw error;
    const json = argv.includes("--json");
    const recognized: ReplayExecuteCommand = {
      bundlePath: "",
      replayPath: "",
      outputSavePath: null,
      maxEvents: undefined,
      maxDurationTicks: undefined,
      json,
    };
    writeFailure(recognized, environment, 2, {
      code: "invalid-usage",
      path: "$",
      message: error.message,
    });
    if (!json) environment.stderr(`\n${REPLAY_EXECUTE_HELP}`);
    return 2;
  }
  if (!command) return null;

  const bundlePath = resolve(command.bundlePath);
  const replayPath = resolve(command.replayPath);
  const outputSavePath = command.outputSavePath
    ? resolve(command.outputSavePath)
    : null;

  try {
    if (outputSavePath) {
      assertReplayOutputPath(outputSavePath, [bundlePath, replayPath]);
    }
    const bundle = parseRuntimeBundle(
      await readJson(bundlePath, "runtime bundle"),
    );
    const limits = commandLimits(command);
    const resolvedLimits = resolveReplayExecutionLimits(bundle, limits);
    const execution = executeInspectedReplay(
      bundle,
      await readJson(replayPath, "replay"),
      limits,
    );
    if (outputSavePath) {
      await writeReplayOutputSave(outputSavePath, execution.finalSaveDocument);
    }

    const report = {
      reportVersion: 1,
      command: "replay-execute",
      valid: true,
      projectId: bundle.projectId,
      bundlePath,
      replayPath,
      outputSavePath,
      executionLimits: resolvedLimits,
      replayFingerprint: execution.replayFingerprint,
      eventCount: execution.eventCount,
      initialTick: execution.initialTick,
      finalTick: execution.finalTick,
      finalSaveFingerprint: execution.finalSaveFingerprint,
      expectedFinalSaveFingerprint: execution.expectedFinalSaveFingerprint,
      checkpointMatched: execution.checkpointMatched,
    };
    environment.stdout(
      command.json
        ? `${JSON.stringify(report, null, 2)}\n`
        : `Executed replay '${execution.replayFingerprint}' to tick ${execution.finalTick}; final save '${execution.finalSaveFingerprint}'.\n`,
    );
    return 0;
  } catch (error) {
    const diagnostic = executionError(error);
    const exitCode = replayExecuteExitCodeForDiagnosticCode(diagnostic.code);
    writeFailure(command, environment, exitCode, diagnostic);
    return exitCode;
  }
};
