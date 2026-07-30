import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  formatDiagnostic,
  type CliDiagnostic,
} from "./diagnostics.js";
import { withTrailingNewline } from "./filesystem.js";
import {
  assertReplayInputFileSize,
  MAXIMUM_REPLAY_BUNDLE_BYTES,
  MAXIMUM_REPLAY_FILE_BYTES,
  ReplayInputFileTooLargeError,
} from "./replay-file-limits.js";
import {
  defaultRuntimeArtifactCliEnvironment,
  RUNTIME_ARTIFACT_HELP,
  runRuntimeArtifactCli as runRuntimeArtifactCliBase,
  type RuntimeArtifactCliEnvironment,
} from "./runtime-artifacts-base.js";

export {
  defaultRuntimeArtifactCliEnvironment,
  RUNTIME_ARTIFACT_HELP,
  type RuntimeArtifactCliEnvironment,
};

type RuntimeArtifactKind = "save-validate" | "replay-validate";

interface RuntimeArtifactPreflightCommand {
  readonly kind: RuntimeArtifactKind;
  readonly bundlePath: string;
  readonly artifactPath: string;
  readonly json: boolean;
}

class RuntimeArtifactPreflightError extends Error {
  readonly diagnostic: CliDiagnostic;

  constructor(diagnostic: CliDiagnostic) {
    super(diagnostic.message);
    this.name = "RuntimeArtifactPreflightError";
    this.diagnostic = diagnostic;
  }
}

const preflightCommand = (
  argv: readonly string[],
): RuntimeArtifactPreflightCommand | null => {
  const [command, ...tokens] = argv;
  if (command !== "save-validate" && command !== "replay-validate") {
    return null;
  }

  const artifactOption = command === "save-validate" ? "--save" : "--replay";
  const allowed = new Set(["--bundle", artifactOption]);
  const values = new Map<string, string>();
  let json = false;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    if (token === "--json") {
      if (json) return null;
      json = true;
      continue;
    }
    if (!allowed.has(token) || values.has(token)) return null;
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) return null;
    values.set(token, value);
    index += 1;
  }

  const bundlePath = values.get("--bundle");
  const artifactPath = values.get(artifactOption);
  return bundlePath && artifactPath
    ? {
        kind: command,
        bundlePath: resolve(bundlePath),
        artifactPath: resolve(artifactPath),
        json,
      }
    : null;
};

const inputDiagnostic = (
  source: CliDiagnostic["source"],
  code: string,
  path: string,
  message: string,
): CliDiagnostic => ({
  severity: "error",
  source,
  code,
  path,
  message,
});

const preflightInput = async (
  path: string,
  source: CliDiagnostic["source"],
  maximumBytes: number,
): Promise<void> => {
  let metadata;
  try {
    metadata = await stat(path);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { readonly code: unknown }).code)
        : "read-failed";
    throw new RuntimeArtifactPreflightError(
      inputDiagnostic(
        source,
        code,
        path,
        `Unable to read '${path}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
    );
  }

  if (!metadata.isFile()) {
    throw new RuntimeArtifactPreflightError(
      inputDiagnostic(
        source,
        "input-not-file",
        path,
        `Input '${path}' is not a regular file.`,
      ),
    );
  }

  try {
    assertReplayInputFileSize(path, metadata.size, maximumBytes);
  } catch (error) {
    if (error instanceof ReplayInputFileTooLargeError) {
      throw new RuntimeArtifactPreflightError(
        inputDiagnostic(source, "file-too-large", path, error.message),
      );
    }
    throw error;
  }
};

const writePreflightFailure = (
  command: RuntimeArtifactPreflightCommand,
  environment: RuntimeArtifactCliEnvironment,
  diagnostic: CliDiagnostic,
): void => {
  if (command.json) {
    environment.stdout(
      withTrailingNewline(
        JSON.stringify(
          {
            reportVersion: 1,
            command: command.kind,
            valid: false,
            exitCode: 1,
            diagnostics: [diagnostic],
          },
          null,
          2,
        ),
      ),
    );
    return;
  }
  environment.stderr(withTrailingNewline(formatDiagnostic(diagnostic)));
};

export const runRuntimeArtifactCli = async (
  argv: readonly string[],
  environment: RuntimeArtifactCliEnvironment =
    defaultRuntimeArtifactCliEnvironment,
): Promise<number | null> => {
  const command = preflightCommand(argv);
  if (!command) return runRuntimeArtifactCliBase(argv, environment);

  try {
    await preflightInput(
      command.bundlePath,
      "runtime-bundle-file",
      MAXIMUM_REPLAY_BUNDLE_BYTES,
    );
    await preflightInput(
      command.artifactPath,
      command.kind === "save-validate" ? "save-game-file" : "replay-file",
      MAXIMUM_REPLAY_FILE_BYTES,
    );
  } catch (error) {
    if (error instanceof RuntimeArtifactPreflightError) {
      writePreflightFailure(command, environment, error.diagnostic);
      return 1;
    }
    throw error;
  }

  return runRuntimeArtifactCliBase(argv, environment);
};
