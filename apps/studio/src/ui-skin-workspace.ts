import type { BitmapFontManifest } from "@evavo/adventure-bitmap-font";
import type { AdventureProject, Id } from "@evavo/adventure-project-schema";
import type { RenderNode } from "@evavo/adventure-render-contract";
import {
  composeUiSkinNodes,
  type UiAssetGeometryResolver,
  type UiRuntimeState,
} from "@evavo/adventure-ui-skin/compose";
import {
  uiSkinById,
  validateUiSkinManifest,
  type UiSkin,
  type UiSkinIssue,
  type UiSkinManifest,
  type UiVerb,
} from "@evavo/adventure-ui-skin";
import {
  createUiSkinEditorHistory,
  executeUiSkinEditorCommand,
  isUiSkinEditorDocumentDirty,
  markUiSkinEditorHistorySaved,
  redoUiSkinEditorCommand,
  undoUiSkinEditorCommand,
  type UiSkinEditorCommand,
  type UiSkinEditorHistoryState,
} from "@evavo/adventure-ui-skin-editor-core";

export interface UiSkinWorkspaceState {
  readonly project: AdventureProject;
  readonly bitmapFonts: BitmapFontManifest;
  readonly history: UiSkinEditorHistoryState;
  readonly selectedSkinId: Id<"ui-skin">;
  readonly preview: UiRuntimeState;
  readonly notice: string | null;
}

export type UiSkinWorkspaceAction =
  | { readonly type: "select-skin"; readonly skinId: Id<"ui-skin"> }
  | {
      readonly type: "execute";
      readonly command: UiSkinEditorCommand;
      readonly notice?: string;
    }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "mark-saved" }
  | { readonly type: "update-preview"; readonly preview: UiRuntimeState }
  | { readonly type: "clear-notice" };

export const DEFAULT_UI_PREVIEW: UiRuntimeState = {
  statusText: "RAIN ON GLASS. LEDGER MISSING.",
  score: 12,
  maximumScore: 50,
  inventory: [
    {
      itemId: "item.notebook" as Id<"item">,
      name: "Notebook",
      iconAssetId: "asset.inventory.notebook" as Id<"asset">,
    },
    {
      itemId: "item.office-key" as Id<"item">,
      name: "Office key",
      iconAssetId: "asset.inventory.key" as Id<"asset">,
    },
  ],
  selectedItemId: "item.notebook" as Id<"item">,
  parserText: "LOOK AT LEDGER",
  parserCursorVisible: true,
  dialogueChoices: [
    {
      choiceId: "dialogue-choice.preview.ledger" as Id<"dialogue-choice">,
      text: "ASK ABOUT THE LEDGER",
      enabled: true,
    },
    {
      choiceId: "dialogue-choice.preview.rain" as Id<"dialogue-choice">,
      text: "MENTION THE RAIN",
      enabled: true,
    },
    {
      choiceId: "dialogue-choice.preview.leave" as Id<"dialogue-choice">,
      text: "END THE INTERVIEW",
      enabled: false,
    },
  ],
  hoveredDialogueChoiceId:
    "dialogue-choice.preview.rain" as Id<"dialogue-choice">,
  verbCoinPosition: { x: 160, y: 100 },
};

export const createUiSkinWorkspace = (
  project: AdventureProject,
  bitmapFonts: BitmapFontManifest,
  manifest: UiSkinManifest,
): UiSkinWorkspaceState => ({
  project,
  bitmapFonts,
  history: createUiSkinEditorHistory(project, bitmapFonts, manifest),
  selectedSkinId: manifest.defaultSkinId,
  preview: DEFAULT_UI_PREVIEW,
  notice: null,
});

export const selectedUiSkin = (state: UiSkinWorkspaceState): UiSkin =>
  uiSkinById(state.history.document.manifest, state.selectedSkinId);

export const uiSkinWorkspaceIsDirty = (
  state: UiSkinWorkspaceState,
): boolean => isUiSkinEditorDocumentDirty(state.history.document);

export const uiSkinWorkspaceIssues = (
  state: UiSkinWorkspaceState,
): readonly UiSkinIssue[] =>
  validateUiSkinManifest(
    state.project,
    state.bitmapFonts,
    state.history.document.manifest,
  );

export const uiSkinIssuesForSelectedSkin = (
  state: UiSkinWorkspaceState,
): readonly UiSkinIssue[] => {
  const skin = selectedUiSkin(state);
  const index = state.history.document.manifest.skins.findIndex(
    (candidate) => candidate.id === skin.id,
  );
  const prefix = `skins[${index}]`;
  return uiSkinWorkspaceIssues(state).filter(
    (issue) => issue.path.startsWith(prefix) || issue.path === "defaultSkinId",
  );
};

export const studioUiGeometryResolver: UiAssetGeometryResolver = {
  resolve: (assetId) => {
    if (assetId === "asset.ui.icons") {
      return {
        sourceRect: { x: 0, y: 0, width: 16, height: 16 },
        originalSize: { width: 16, height: 16 },
        trimOffset: { x: 0, y: 0 },
      };
    }
    if (
      assetId === "asset.inventory.notebook" ||
      assetId === "asset.inventory.key"
    ) {
      return {
        sourceRect: { x: 0, y: 0, width: 14, height: 14 },
        originalSize: { width: 14, height: 14 },
        trimOffset: { x: 0, y: 0 },
      };
    }
    return null;
  },
};

export const uiSkinWorkspacePreviewNodes = (
  state: UiSkinWorkspaceState,
): readonly RenderNode[] =>
  composeUiSkinNodes(
    selectedUiSkin(state),
    state.bitmapFonts,
    state.preview,
    {
      assets: studioUiGeometryResolver,
      nodePrefix: "studio.ui-preview",
    },
  );

export const replaceSelectedUiSkinCommand = (
  state: UiSkinWorkspaceState,
  skin: UiSkin,
): UiSkinEditorCommand => ({
  kind: "replace-skin",
  skinId: state.selectedSkinId,
  skin,
});

export const replaceUiVerbCommand = (
  state: UiSkinWorkspaceState,
  verb: UiVerb,
): UiSkinEditorCommand => ({
  kind: "replace-verb",
  skinId: state.selectedSkinId,
  verbId: verb.id,
  verb,
});

export const insertUiVerbCommand = (
  state: UiSkinWorkspaceState,
  verb: UiVerb,
  index = selectedUiSkin(state).verbs.length,
): UiSkinEditorCommand => ({
  kind: "insert-verb",
  skinId: state.selectedSkinId,
  index,
  verb,
});

const rejectedNotice = (error: unknown): string =>
  error instanceof Error
    ? `Interface edit rejected: ${error.message}`
    : "Interface edit was rejected.";

export const uiSkinWorkspaceReducer = (
  state: UiSkinWorkspaceState,
  action: UiSkinWorkspaceAction,
): UiSkinWorkspaceState => {
  switch (action.type) {
    case "select-skin":
      return { ...state, selectedSkinId: action.skinId, notice: null };
    case "execute": {
      try {
        const history = executeUiSkinEditorCommand(
          state.project,
          state.bitmapFonts,
          state.history,
          action.command,
        );
        const selectedExists = history.document.manifest.skins.some(
          (skin) => skin.id === state.selectedSkinId,
        );
        return {
          ...state,
          history,
          selectedSkinId: selectedExists
            ? state.selectedSkinId
            : history.document.manifest.defaultSkinId,
          notice: action.notice ?? null,
        };
      } catch (error) {
        return { ...state, notice: rejectedNotice(error) };
      }
    }
    case "undo":
      return {
        ...state,
        history: undoUiSkinEditorCommand(
          state.project,
          state.bitmapFonts,
          state.history,
        ),
        notice: "Undid the last interface edit.",
      };
    case "redo":
      return {
        ...state,
        history: redoUiSkinEditorCommand(
          state.project,
          state.bitmapFonts,
          state.history,
        ),
        notice: "Redid the interface edit.",
      };
    case "mark-saved":
      return {
        ...state,
        history: markUiSkinEditorHistorySaved(state.history),
        notice: "Interface skin document marked as saved.",
      };
    case "update-preview":
      return { ...state, preview: action.preview, notice: null };
    case "clear-notice":
      return { ...state, notice: null };
  }
};
