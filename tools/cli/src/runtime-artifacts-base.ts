import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  parseReplayLog,
  ReplayCompatibilityError,
  ReplayIntegrityError,
  validateReplayCompatibility,
  type ReplayLog,
} from "@evavo/adventure-replay";
import {
  parseRuntimeBundle,
  type RuntimeBundle,
} from "@evavo/adventure-runtime-bundle";
import {
  loadSaveGame,
  SaveGameCompatibilityError,
  SaveGameIntegrityError,
  type SaveGame,
} from "@evavo/adventure-save-game";
import {
  formatDiagnostic,
  sortDiagnostics,
  type CliDiagnostic,
} from "./diagnostics.js";
import { withTrailingNewline } from "./filesystem.js";

export interface RuntimeArtifactCliEnvironment {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export const defaultRuntimeArtifactCliEnvironment: RuntimeArtifactCliEnvironment = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

type RuntimeArtifactCommand =
  | {
      readonly kind: "save-validate";
      readonly bundlePath: string;
      readonly artifactPath: string;
      readonly json: boolean;
    }
  | {
      readonly kind: "replay-validate";
      readonly bundlePath: string;
      readonly artifactPath: string;
      readonly json: boolean;
    };

export const RUNTIME_ARTIFACT_HELP = `Runtime artifact validation

Usage:
  evavo-adventure save-validate --bundle <game.bundle.json> --save <save.json> [--json]
  evavo-adventure replay-validate --bundle <game.bundle.json> --replay <replay.json> [--json]
`;

class RuntimeArtifactUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeArtifactUsageError";
  }
}

class RuntimeArtifactDiagnosticsError extends Error {
  readonly diagnostics: readonly CliDiagnostic[];

  constructor(diagnostics: readonly CliDiagnostic[]) {
    super(diagnostics[0]?.message ?? "Runtime artifact validation failed.");
    this.name = "RuntimeArtifactDiagnosticsError";
    this.diagnostics = diagnostics;
  }
}

const parseRuntimeArtifactCommand = (
  argv: readonly string[],
): RuntimeArtifactCommand | null => {
  const [command, ...tokens] = argv;
  if (command !== "save-validate" && command !== "replay-validate") {
    return null;
  }

  const values = new Map<string, string>();
  let json = false;
  const artifactOption = command === "save-validate" ? "--save" : "--replay";
  const allowed = new Set(["--bundle", artifactOption]);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    if (token === "--json") {
      if (json) {
        throw new RuntimeArtifactUsageError("Option '--json' was supplied more than once.");
      }
      json = true;
      continue;
    }
    if (!allowed.has(token)) {
      throw new RuntimeArtifactUsageError(
        `Option '${token}' is not valid for '${command}'.`,
      );
    }
    if (values.has(token)) {
      throw new RuntimeArtifactUsageError(`Option '${token}' was supplied more than once.`);
    }
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) {
      throw new RuntimeArtifactUsageError(`Option '${token}' requires a value.`);
    }
    values.set(token, value);
    index += 1;
  }

  const bundlePath = values.get("--bundle");
  const artifactPath = values.get(artifactOption);
  if (!bundlePath) {
    throw new RuntimeArtifactUsageError("Missing required option '--bundle'.");
  }
  if (!artifactPath) {
    throw new RuntimeArtifactUsageError(
      `Missing required option '${artifactOption}'.`,
    );
  }

  return {
    kind: command,
    bundlePath,
    artifactPath,
    json,
  };
};

const pathFromSegments = (segments: readonly PropertyKey[]): string => {
  let output = "";
  for (const segment of segments) {
    output +=
      typeof segment === "number"
        ? `[${segment}]`
        : output
          ? `.${String(segment)}`
          : String(segment);
  }
  return output || "$";
};

const issueDiagnostics = (
  error: unknown,
  source: CliDiagnostic["source"],
  fallbackCode: string,
): readonly CliDiagnostic[] => {
  if (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as { readonly issues: unknown }).issues)
  ) {
    return (error as { readonly issues: readonly unknown[] }).issues.map(
      (entry): CliDiagnostic => {
        const issue = entry as {
          readonly severity?: unknown;
          readonly code?: unknown;
          readonly path?: unknown;
          readonly message?: unknown;
        };
        const path = Array.isArray(issue.path)
          ? pathFromSegments(issue.path as readonly PropertyKey[])
          : String(issue.path ?? "$ ").trim() || "$";
        return {
          severity: issue.severity === "warning" ? "warning" : "error",
          source,
          code: String(issue.code ?? fallbackCode),
          path,
          message: String(issue.message ?? "Validation failed."),
        };
      },
    );
  }
  return [
    {
      severity: "error",
      source,
      code: fallbackCode,
      path: "$",
      message: error instanceof Error ? error.message : "Validation failed.",
    },
  ];
};

const readJson = async (
  path: string,
  source: CliDiagnostic["source"],
): Promise<unknown> => {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new RuntimeArtifactDiagnosticsError([
      {
        severity: "error",
        source,
        code:
          typeof error === "object" && error !== null && "code" in error
            ? String((error as { readonly code: unknown }).code)
            : "read-failed",
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
    throw new RuntimeArtifactDiagnosticsError([
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

const isZodError = (error: unknown): boolean =>
  error instanceof Error && error.name === "ZodError";

const loadBundle = async (path: string): Promise<RuntimeBundle> => {
  const input = await readJson(path, "runtime-bundle-file");
  try {
    return parseRuntimeBundle(input);
  } catch (error) {
    throw new RuntimeArtifactDiagnosticsError(
      issueDiagnostics(
        error,
        isZodError(error)
          ? "runtime-bundle-schema"
          : "runtime-bundle-semantics",
        "runtime-bundle-invalid",
      ),
    );
  }
};

const writeFailure = (
  command: RuntimeArtifactCommand,
  environment: RuntimeArtifactCliEnvironment,
  exitCode: number,
  diagnostics: readonly CliDiagnostic[],
): void => {
  const sorted = sortDiagnostics(diagnostics);
  if (command.json) {
    environment.stdout(
      withTrailingNewline(
        JSON.stringify(
          {
            reportVersion: 1,
            command: command.kind,
            valid: false,
            exitCode,
            diagnostics: sorted,
          },
          null,
          2,
        ),
      ),
    );
  } else {
    environment.stderr(
      withTrailingNewline(sorted.map(formatDiagnostic).join("\n")),
    );
  }
};

const validateSave = async (
  command: Extract<RuntimeArtifactCommand, { readonly kind: "save-validate" }>,
  environment: RuntimeArtifactCliEnvironment,
): Promise<number> => {
  const bundle = await loadBundle(resolve(command.bundlePath));
  const input = await readJson(resolve(command.artifactPath), "save-game-file");
  let save: SaveGame;
  try {
    save = loadSaveGame(bundle, input);
  } catch (error) {
    const source: CliDiagnostic["source"] =
      error instanceof SaveGameIntegrityError
        ? "save-game-integrity"
        : error instanceof SaveGameCompatibilityError
          ? "save-game-compatibility"
          : "save-game-schema";
    throw new RuntimeArtifactDiagnosticsError(
      issueDiagnostics(error, source, "save-game-invalid"),
    );
  }

  const report = {
    reportVersion: 1 as const,
    command: command.kind,
    valid: true,
    projectId: bundle.projectId,
    bundlePath: resolve(command.bundlePath),
    savePath: resolve(command.artifactPath),
    saveVersion: save.saveVersion,
    saveFingerprint: save.saveFingerprint,
    logicalTick: save.world.story.tick,
    currentSceneId: save.world.story.currentSceneId,
  };
  environment.stdout(
    command.json
      ? withTrailingNewline(JSON.stringify(report, null, 2))
      : withTrailingNewline(
          `Valid save '${save.saveFingerprint}' for '${bundle.projectId}' at tick ${save.world.story.tick}.`,
        ),
  );
  return 0;
};

const validateReplay = async (
  command: Extract<RuntimeArtifactCommand, { readonly kind: "replay-validate" }>,
  environment: RuntimeArtifactCliEnvironment,
): Promise<number> => {
  const bundle = await loadBundle(resolve(command.bundlePath));
  const input = await readJson(resolve(command.artifactPath), "replay-file");
  let replay: ReplayLog;
  try {
    replay = parseReplayLog(input);
    const issues = validateReplayCompatibility(bundle, replay);
    if (issues.length > 0) throw new ReplayCompatibilityError(issues);
  } catch (error) {
    const source: CliDiagnostic["source"] =
      error instanceof ReplayIntegrityError
        ? "replay-integrity"
        : error instanceof ReplayCompatibilityError
          ? "replay-compatibility"
          : "replay-schema";
    throw new RuntimeArtifactDiagnosticsError(
      issueDiagnostics(error, source, "replay-invalid"),
    );
  }

  const report = {
    reportVersion: 1 as const,
    command: command.kind,
    valid: true,
    projectId: bundle.projectId,
    bundlePath: resolve(command.bundlePath),
    replayPath: resolve(command.artifactPath),
    replayVersion: replay.replayVersion,
    replayFingerprint: replay.replayFingerprint,
    initialTick: replay.initialSave.world.story.tick,
    finalTick: replay.finalTick,
    eventCount: replay.events.length,
    expectedFinalSaveFingerprint:
      replay.expectedFinalSaveFingerprint ?? null,
  };
  environment.stdout(
    command.json
      ? withTrailingNewline(JSON.stringify(report, null, 2))
      : withTrailingNewline(
          `Valid replay '${replay.replayFingerprint}' for '${bundle.projectId}' with ${replay.events.length} event(s), ticks ${replay.initialSave.world.story.tick} to ${replay.finalTick}.`,
        ),
  );
  return 0;
};

export const runRuntimeArtifactCli = async (
  argv: readonly string[],
  environment: RuntimeArtifactCliEnvironment = defaultRuntimeArtifactCliEnvironment,
): Promise<number | null> => {
  let command: RuntimeArtifactCommand | null;
  try {
    command = parseRuntimeArtifactCommand(argv);
  } catch (error) {
    if (error instanceof RuntimeArtifactUsageError) {
      const json = argv.includes("--json");
      const diagnostic: CliDiagnostic = {
        severity: "error",
        source: "cli",
        code: "invalid-usage",
        path: "$",
        message: error.message,
      };
      const recognized: RuntimeArtifactCommand = {
        kind: argv[0] === "replay-validate" ? "replay-validate" : "save-validate",
        bundlePath: "",
        artifactPath: "",
        json,
      };
      writeFailure(recognized, environment, 2, [diagnostic]);
      if (!json) environment.stderr(`\n${RUNTIME_ARTIFACT_HELP}`);
      return 2;
    }
    throw error;
  }
  if (!command) return null;

  try {
    return command.kind === "save-validate"
      ? await validateSave(command, environment)
      : await validateReplay(command, environment);
  } catch (error) {
    if (error instanceof RuntimeArtifactDiagnosticsError) {
      writeFailure(command, environment, 1, error.diagnostics);
      return 1;
    }
    const diagnostics = issueDiagnostics(
      error,
      "cli",
      "unexpected-runtime-artifact-failure",
    );
    writeFailure(command, environment, 3, diagnostics);
    return 3;
  }
};
