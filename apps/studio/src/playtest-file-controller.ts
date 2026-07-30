import type {
  PlaytestArtifactKind,
  PlaytestInspectorWorkspaceState,
} from "./playtest-workspace.js";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const reportPlaytestArtifactReadFailure = (
  state: PlaytestInspectorWorkspaceState,
  kind: PlaytestArtifactKind,
  name: string,
  error: unknown,
): PlaytestInspectorWorkspaceState => {
  const message = `Unable to read '${name}': ${errorMessage(error)}`;

  if (kind === "bundle") {
    return {
      ...state,
      bundle: null,
      bundleName: name,
      beforeInspection: null,
      afterInspection: null,
      diff: null,
      canonicalDiff: null,
      replayInspection: null,
      errors: { ...state.errors, bundle: message },
    };
  }

  return {
    ...state,
    ...(kind === "before-save"
      ? {
          beforeSaveInput: null,
          beforeSaveName: name,
          beforeInspection: null,
          diff: null,
          canonicalDiff: null,
          errors: { ...state.errors, beforeSave: message },
        }
      : kind === "after-save"
        ? {
            afterSaveInput: null,
            afterSaveName: name,
            afterInspection: null,
            diff: null,
            canonicalDiff: null,
            errors: { ...state.errors, afterSave: message },
          }
        : {
            replayInput: null,
            replayName: name,
            replayInspection: null,
            errors: { ...state.errors, replay: message },
          }),
  };
};
