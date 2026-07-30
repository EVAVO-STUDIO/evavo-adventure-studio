import {
  diffSaveGames,
  inspectReplay,
  inspectSaveGame,
  type ReplayInspection,
  type SaveGameDiff,
  type SaveGameInspection,
} from "@evavo/adventure-playtest-inspector";
import {
  parseRuntimeBundle,
  type RuntimeBundle,
} from "@evavo/adventure-runtime-bundle";

export type PlaytestArtifactKind = "bundle" | "before-save" | "after-save" | "replay";

export interface PlaytestInspectorErrors {
  readonly bundle: string | null;
  readonly beforeSave: string | null;
  readonly afterSave: string | null;
  readonly replay: string | null;
}

export interface PlaytestInspectorWorkspaceState {
  readonly bundle: RuntimeBundle | null;
  readonly bundleName: string | null;
  readonly beforeSaveInput: unknown | null;
  readonly beforeSaveName: string | null;
  readonly afterSaveInput: unknown | null;
  readonly afterSaveName: string | null;
  readonly replayInput: unknown | null;
  readonly replayName: string | null;
  readonly beforeInspection: SaveGameInspection | null;
  readonly afterInspection: SaveGameInspection | null;
  readonly diff: SaveGameDiff | null;
  readonly replayInspection: ReplayInspection | null;
  readonly errors: PlaytestInspectorErrors;
}

const emptyErrors = (): PlaytestInspectorErrors => ({
  bundle: null,
  beforeSave: null,
  afterSave: null,
  replay: null,
});

export const createPlaytestInspectorWorkspace = (): PlaytestInspectorWorkspaceState => ({
  bundle: null,
  bundleName: null,
  beforeSaveInput: null,
  beforeSaveName: null,
  afterSaveInput: null,
  afterSaveName: null,
  replayInput: null,
  replayName: null,
  beforeInspection: null,
  afterInspection: null,
  diff: null,
  replayInspection: null,
  errors: emptyErrors(),
});

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const parseJson = (text: string, label: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new SyntaxError(
      `${label} is not valid JSON: ${errorMessage(error)}`,
    );
  }
};

const artifactErrorCleared = (
  errors: PlaytestInspectorErrors,
  kind: Exclude<PlaytestArtifactKind, "bundle">,
): PlaytestInspectorErrors => ({
  ...errors,
  ...(kind === "before-save"
    ? { beforeSave: null }
    : kind === "after-save"
      ? { afterSave: null }
      : { replay: null }),
});

const recompute = (
  state: PlaytestInspectorWorkspaceState,
): PlaytestInspectorWorkspaceState => {
  const bundle = state.bundle;
  if (!bundle) {
    return {
      ...state,
      beforeInspection: null,
      afterInspection: null,
      diff: null,
      replayInspection: null,
    };
  }

  let beforeInspection: SaveGameInspection | null = null;
  let afterInspection: SaveGameInspection | null = null;
  let diff: SaveGameDiff | null = null;
  let replayInspection: ReplayInspection | null = null;
  let beforeSaveError: string | null =
    state.beforeSaveInput === null ? state.errors.beforeSave : null;
  let afterSaveError: string | null =
    state.afterSaveInput === null ? state.errors.afterSave : null;
  let replayError: string | null =
    state.replayInput === null ? state.errors.replay : null;

  if (state.beforeSaveInput !== null) {
    try {
      beforeInspection = inspectSaveGame(bundle, state.beforeSaveInput);
    } catch (error) {
      beforeSaveError = errorMessage(error);
    }
  }
  if (state.afterSaveInput !== null) {
    try {
      afterInspection = inspectSaveGame(bundle, state.afterSaveInput);
    } catch (error) {
      afterSaveError = errorMessage(error);
    }
  }
  if (
    state.beforeSaveInput !== null &&
    state.afterSaveInput !== null &&
    beforeSaveError === null &&
    afterSaveError === null
  ) {
    try {
      diff = diffSaveGames(
        bundle,
        state.beforeSaveInput,
        state.afterSaveInput,
      );
    } catch (error) {
      afterSaveError = errorMessage(error);
    }
  }
  if (state.replayInput !== null) {
    try {
      replayInspection = inspectReplay(bundle, state.replayInput);
    } catch (error) {
      replayError = errorMessage(error);
    }
  }

  return {
    ...state,
    beforeInspection,
    afterInspection,
    diff,
    replayInspection,
    errors: {
      bundle: null,
      beforeSave: beforeSaveError,
      afterSave: afterSaveError,
      replay: replayError,
    },
  };
};

export const loadPlaytestArtifactText = (
  state: PlaytestInspectorWorkspaceState,
  kind: PlaytestArtifactKind,
  text: string,
  name: string,
): PlaytestInspectorWorkspaceState => {
  if (kind === "bundle") {
    try {
      const bundle = parseRuntimeBundle(parseJson(text, "Runtime bundle"));
      return recompute({
        ...state,
        bundle,
        bundleName: name,
        errors: { ...state.errors, bundle: null },
      });
    } catch (error) {
      return {
        ...state,
        bundle: null,
        bundleName: name,
        beforeInspection: null,
        afterInspection: null,
        diff: null,
        replayInspection: null,
        errors: {
          ...state.errors,
          bundle: errorMessage(error),
        },
      };
    }
  }

  let input: unknown;
  try {
    input = parseJson(
      text,
      kind === "replay" ? "Replay" : "Save game",
    );
  } catch (error) {
    const message = errorMessage(error);
    return {
      ...state,
      ...(kind === "before-save"
        ? {
            beforeSaveInput: null,
            beforeSaveName: name,
            beforeInspection: null,
            diff: null,
            errors: { ...state.errors, beforeSave: message },
          }
        : kind === "after-save"
          ? {
              afterSaveInput: null,
              afterSaveName: name,
              afterInspection: null,
              diff: null,
              errors: { ...state.errors, afterSave: message },
            }
          : {
              replayInput: null,
              replayName: name,
              replayInspection: null,
              errors: { ...state.errors, replay: message },
            }),
    };
  }

  return recompute({
    ...state,
    ...(kind === "before-save"
      ? { beforeSaveInput: input, beforeSaveName: name }
      : kind === "after-save"
        ? { afterSaveInput: input, afterSaveName: name }
        : { replayInput: input, replayName: name }),
    errors: artifactErrorCleared(state.errors, kind),
  });
};

export const clearPlaytestArtifact = (
  state: PlaytestInspectorWorkspaceState,
  kind: PlaytestArtifactKind,
): PlaytestInspectorWorkspaceState => {
  if (kind === "bundle") return createPlaytestInspectorWorkspace();
  return recompute({
    ...state,
    ...(kind === "before-save"
      ? { beforeSaveInput: null, beforeSaveName: null }
      : kind === "after-save"
        ? { afterSaveInput: null, afterSaveName: null }
        : { replayInput: null, replayName: null }),
    errors: artifactErrorCleared(state.errors, kind),
  });
};
