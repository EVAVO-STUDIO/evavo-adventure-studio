import type { AdventureProject } from "@evavo/adventure-project-schema";
import type {
  GameLifecycleManifest,
  GameLifecycleOutcome,
} from "@evavo/adventure-project-schema/lifecycle";
import {
  createGameLifecycleEditorHistory,
  executeGameLifecycleEditorCommand,
  isGameLifecycleEditorDirty,
  markGameLifecycleEditorSaved,
  redoGameLifecycleEditorCommand,
  type GameLifecycleEditorCommand,
  type GameLifecycleEditorHistoryState,
  undoGameLifecycleEditorCommand,
} from "@evavo/adventure-project-schema/lifecycle-editor";

export interface LifecycleWorkspaceState {
  readonly project: AdventureProject;
  readonly history: GameLifecycleEditorHistoryState;
  readonly selectedOutcomeId: string;
  readonly notice: string | null;
}

export type LifecycleWorkspaceAction =
  | { readonly type: "select-outcome"; readonly outcomeId: string }
  | {
      readonly type: "execute";
      readonly command: GameLifecycleEditorCommand;
      readonly selectedOutcomeId?: string;
      readonly notice?: string;
    }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "mark-saved" }
  | { readonly type: "clear-notice" };

const firstOutcome = (manifest: GameLifecycleManifest): GameLifecycleOutcome => {
  const outcome = manifest.outcomes[0];
  if (!outcome) throw new Error("Lifecycle manifests require at least one outcome.");
  return outcome;
};

export const createLifecycleWorkspace = (
  project: AdventureProject,
  manifest: GameLifecycleManifest,
): LifecycleWorkspaceState => {
  if (project.id !== manifest.projectId) {
    throw new Error(`Lifecycle project '${manifest.projectId}' does not match '${project.id}'.`);
  }
  const history = createGameLifecycleEditorHistory(manifest);
  return {
    project,
    history,
    selectedOutcomeId: firstOutcome(history.manifest).id,
    notice: null,
  };
};

export const lifecycleWorkspaceManifest = (
  state: LifecycleWorkspaceState,
): GameLifecycleManifest => state.history.manifest;

export const selectedLifecycleOutcome = (state: LifecycleWorkspaceState): GameLifecycleOutcome =>
  state.history.manifest.outcomes.find((outcome) => outcome.id === state.selectedOutcomeId) ??
  firstOutcome(state.history.manifest);

export const lifecycleWorkspaceIsDirty = (state: LifecycleWorkspaceState): boolean =>
  isGameLifecycleEditorDirty(state.history);

const selectionAfterHistory = (
  state: LifecycleWorkspaceState,
  history: GameLifecycleEditorHistoryState,
): string =>
  history.manifest.outcomes.some((outcome) => outcome.id === state.selectedOutcomeId)
    ? state.selectedOutcomeId
    : firstOutcome(history.manifest).id;

export const lifecycleWorkspaceReducer = (
  state: LifecycleWorkspaceState,
  action: LifecycleWorkspaceAction,
): LifecycleWorkspaceState => {
  switch (action.type) {
    case "select-outcome":
      return state.history.manifest.outcomes.some((outcome) => outcome.id === action.outcomeId)
        ? { ...state, selectedOutcomeId: action.outcomeId, notice: null }
        : state;
    case "execute": {
      const history = executeGameLifecycleEditorCommand(state.history, action.command);
      return {
        ...state,
        history,
        selectedOutcomeId:
          action.selectedOutcomeId ?? selectionAfterHistory(state, history),
        notice: action.notice ?? null,
      };
    }
    case "undo": {
      const history = undoGameLifecycleEditorCommand(state.history);
      return {
        ...state,
        history,
        selectedOutcomeId: selectionAfterHistory(state, history),
        notice: "Undid the last ending edit.",
      };
    }
    case "redo": {
      const history = redoGameLifecycleEditorCommand(state.history);
      return {
        ...state,
        history,
        selectedOutcomeId: selectionAfterHistory(state, history),
        notice: "Redid the ending edit.",
      };
    }
    case "mark-saved":
      return {
        ...state,
        history: markGameLifecycleEditorSaved(state.history),
        notice: "Lifecycle manifest marked as exported.",
      };
    case "clear-notice":
      return { ...state, notice: null };
  }
};

export const replaceSelectedLifecycleOutcomeCommand = (
  state: LifecycleWorkspaceState,
  outcome: GameLifecycleOutcome,
): GameLifecycleEditorCommand => ({
  kind: "replace-outcome",
  outcomeId: selectedLifecycleOutcome(state).id,
  outcome,
});

const uniqueOutcomeId = (
  manifest: GameLifecycleManifest,
  kind: GameLifecycleOutcome["kind"],
): string => {
  const existing = new Set(manifest.outcomes.map((outcome) => outcome.id));
  const base = `outcome.${kind}`;
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base}.${suffix}`)) suffix += 1;
  return `${base}.${suffix}`;
};

export const insertLifecycleOutcomeCommand = (
  state: LifecycleWorkspaceState,
  kind: GameLifecycleOutcome["kind"],
): { readonly command: GameLifecycleEditorCommand; readonly outcomeId: string } => {
  const outcomeId = uniqueOutcomeId(state.history.manifest, kind);
  const outcome: GameLifecycleOutcome = {
    id: outcomeId,
    kind,
    priority: kind === "failure" ? 50 : 25,
    when: { kind: "flag", flag: kind === "failure" ? "case.failed" : "case.solved", equals: true },
    title: kind === "failure" ? "Case Closed" : "Case Solved",
    message:
      kind === "failure"
        ? "Author the consequence that ends this route."
        : "Author the resolution that completes this route.",
    menu: {
      allowQuickRetry: kind === "failure",
      allowLoad: true,
      allowRestart: true,
      allowTitle: true,
      labels: {
        quickRetry: "QUICK RETRY",
        loadGame: "LOAD GAME",
        restartGame: "RESTART GAME",
        returnToTitle: "RETURN TO TITLE",
        back: "BACK",
      },
    },
  };
  return {
    command: {
      kind: "insert-outcome",
      index: state.history.manifest.outcomes.length,
      outcome,
    },
    outcomeId,
  };
};

export const removeSelectedLifecycleOutcomeCommand = (
  state: LifecycleWorkspaceState,
): GameLifecycleEditorCommand => ({
  kind: "remove-outcome",
  outcomeId: selectedLifecycleOutcome(state).id,
});