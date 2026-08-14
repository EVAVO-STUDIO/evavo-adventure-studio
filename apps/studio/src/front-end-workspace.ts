import type { ClassicFrontEndManifest } from "@evavo/adventure-project-schema/front-end";
import {
  createClassicFrontEndEditorHistory,
  executeClassicFrontEndEditorCommand,
  isClassicFrontEndEditorDirty,
  markClassicFrontEndEditorSaved,
  redoClassicFrontEndEditorCommand,
  type ClassicFrontEndEditorCommand,
  type ClassicFrontEndEditorHistoryState,
  undoClassicFrontEndEditorCommand,
} from "@evavo/adventure-project-schema/front-end-editor";

export type FrontEndPreviewScreen = "splash" | "title" | "options" | "credits" | "quit";

export interface FrontEndWorkspaceState {
  readonly history: ClassicFrontEndEditorHistoryState;
  readonly preview: FrontEndPreviewScreen;
  readonly notice: string | null;
}

export type FrontEndWorkspaceAction =
  | {
      readonly type: "execute";
      readonly command: ClassicFrontEndEditorCommand;
      readonly notice?: string;
    }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "mark-saved" }
  | { readonly type: "set-preview"; readonly preview: FrontEndPreviewScreen }
  | { readonly type: "clear-notice" };

export const createFrontEndWorkspace = (
  manifest: ClassicFrontEndManifest,
): FrontEndWorkspaceState => ({
  history: createClassicFrontEndEditorHistory(manifest),
  preview: "title",
  notice: null,
});

export const frontEndWorkspaceManifest = (
  state: FrontEndWorkspaceState,
): ClassicFrontEndManifest => state.history.manifest;

export const frontEndWorkspaceIsDirty = (state: FrontEndWorkspaceState): boolean =>
  isClassicFrontEndEditorDirty(state.history);

export const frontEndWorkspaceReducer = (
  state: FrontEndWorkspaceState,
  action: FrontEndWorkspaceAction,
): FrontEndWorkspaceState => {
  switch (action.type) {
    case "execute":
      return {
        ...state,
        history: executeClassicFrontEndEditorCommand(state.history, action.command),
        notice: action.notice ?? null,
      };
    case "undo":
      return {
        ...state,
        history: undoClassicFrontEndEditorCommand(state.history),
        notice: "Undid the last front-end edit.",
      };
    case "redo":
      return {
        ...state,
        history: redoClassicFrontEndEditorCommand(state.history),
        notice: "Redid the front-end edit.",
      };
    case "mark-saved":
      return {
        ...state,
        history: markClassicFrontEndEditorSaved(state.history),
        notice: "Front-end manifest marked as exported.",
      };
    case "set-preview":
      return { ...state, preview: action.preview, notice: null };
    case "clear-notice":
      return { ...state, notice: null };
  }
};