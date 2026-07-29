import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import {
  createArtDirectionEditorHistory,
  createArtDirectionManifest,
  evaluateCompiledArtDirection,
  executeArtDirectionEditorCommand,
  isArtDirectionEditorDocumentDirty,
  markArtDirectionEditorHistorySaved,
  redoArtDirectionEditorCommand,
  undoArtDirectionEditorCommand,
  validateArtDirectionManifest,
  type ArtAssetRule,
  type ArtDirectionEditorCommand,
  type ArtDirectionEditorHistoryState,
  type ArtDirectionIssue,
  type ArtPreset,
} from "@evavo/adventure-art-direction";
import {
  evaluateArtDirectionWithVisualEvidence,
  type ArtVisualEvidenceIssue,
  type ArtVisualEvidenceManifest,
} from "@evavo/adventure-art-direction/evidence";
import type { AdventureProject, Id } from "@evavo/adventure-project-schema";

export type ArtWorkspaceIssue = ArtDirectionIssue | ArtVisualEvidenceIssue;

export interface ArtDirectionEvidenceBundle {
  readonly manifest: AssetBuildManifest;
  readonly visualEvidence: ArtVisualEvidenceManifest | null;
}

export interface ArtDirectionWorkspaceState {
  readonly project: AdventureProject;
  readonly compiledEvidence: AssetBuildManifest | null;
  readonly visualEvidence: ArtVisualEvidenceManifest | null;
  readonly history: ArtDirectionEditorHistoryState;
  readonly selectedAssetId: Id<"asset">;
  readonly notice: string | null;
}

export type ArtDirectionWorkspaceAction =
  | { readonly type: "select-asset"; readonly assetId: Id<"asset"> }
  | {
      readonly type: "execute";
      readonly command: ArtDirectionEditorCommand;
      readonly notice?: string;
    }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "mark-saved" }
  | { readonly type: "clear-notice" };

const firstRule = (
  history: ArtDirectionEditorHistoryState,
): ArtAssetRule => {
  const rule = history.document.manifest.assets[0];
  if (!rule) throw new Error("Art direction manifests require at least one rule.");
  return rule;
};

const normalizeEvidence = (
  evidence: AssetBuildManifest | ArtDirectionEvidenceBundle | null,
  explicitVisualEvidence: ArtVisualEvidenceManifest | null,
): {
  readonly manifest: AssetBuildManifest | null;
  readonly visualEvidence: ArtVisualEvidenceManifest | null;
} => {
  if (!evidence) {
    return { manifest: null, visualEvidence: explicitVisualEvidence };
  }
  if ("manifest" in evidence) {
    return {
      manifest: evidence.manifest,
      visualEvidence: explicitVisualEvidence ?? evidence.visualEvidence,
    };
  }
  return { manifest: evidence, visualEvidence: explicitVisualEvidence };
};

export const createArtDirectionWorkspace = (
  project: AdventureProject,
  evidence: AssetBuildManifest | ArtDirectionEvidenceBundle | null,
  initialManifest = createArtDirectionManifest(project, "vga-256-320x200"),
  explicitVisualEvidence: ArtVisualEvidenceManifest | null = null,
): ArtDirectionWorkspaceState => {
  const history = createArtDirectionEditorHistory(project, initialManifest);
  const normalized = normalizeEvidence(evidence, explicitVisualEvidence);
  return {
    project,
    compiledEvidence: normalized.manifest,
    visualEvidence: normalized.visualEvidence,
    history,
    selectedAssetId: firstRule(history).assetId,
    notice: null,
  };
};

export const selectedArtDirectionRule = (
  state: ArtDirectionWorkspaceState,
): ArtAssetRule => {
  const rule = state.history.document.manifest.assets.find(
    (candidate) => candidate.assetId === state.selectedAssetId,
  );
  if (!rule) {
    throw new Error(`Art direction rule '${state.selectedAssetId}' does not exist.`);
  }
  return rule;
};

export const artDirectionWorkspaceIssues = (
  state: ArtDirectionWorkspaceState,
): readonly ArtWorkspaceIssue[] => {
  if (state.compiledEvidence && state.visualEvidence) {
    return evaluateArtDirectionWithVisualEvidence(
      state.project,
      state.history.document.manifest,
      state.compiledEvidence,
      state.visualEvidence,
    );
  }
  if (state.compiledEvidence) {
    return evaluateCompiledArtDirection(
      state.project,
      state.history.document.manifest,
      state.compiledEvidence,
    );
  }
  return validateArtDirectionManifest(
    state.project,
    state.history.document.manifest,
  );
};

export const artDirectionWorkspaceIsDirty = (
  state: ArtDirectionWorkspaceState,
): boolean => isArtDirectionEditorDocumentDirty(state.history.document);

export const artDirectionIssuesForAsset = (
  state: ArtDirectionWorkspaceState,
  assetId: Id<"asset">,
): readonly ArtWorkspaceIssue[] =>
  artDirectionWorkspaceIssues(state).filter(
    (entry) =>
      entry.path.includes(assetId) || entry.message.includes(`'${assetId}'`),
  );

export const artDirectionWorkspaceReducer = (
  state: ArtDirectionWorkspaceState,
  action: ArtDirectionWorkspaceAction,
): ArtDirectionWorkspaceState => {
  switch (action.type) {
    case "select-asset":
      return { ...state, selectedAssetId: action.assetId, notice: null };
    case "execute":
      return {
        ...state,
        history: executeArtDirectionEditorCommand(
          state.project,
          state.history,
          action.command,
        ),
        notice: action.notice ?? null,
      };
    case "undo":
      return {
        ...state,
        history: undoArtDirectionEditorCommand(state.project, state.history),
        notice: "Undid the last art-direction edit.",
      };
    case "redo":
      return {
        ...state,
        history: redoArtDirectionEditorCommand(state.project, state.history),
        notice: "Redid the art-direction edit.",
      };
    case "mark-saved":
      return {
        ...state,
        history: markArtDirectionEditorHistorySaved(state.history),
        notice: "Art direction manifest marked as saved.",
      };
    case "clear-notice":
      return { ...state, notice: null };
  }
};

export const replaceSelectedArtRuleCommand = (
  state: ArtDirectionWorkspaceState,
  rule: ArtAssetRule,
): ArtDirectionEditorCommand => ({
  kind: "replace-asset-rule",
  assetId: state.selectedAssetId,
  rule,
});

export const replaceArtPresetCommand = (
  state: ArtDirectionWorkspaceState,
  preset: ArtPreset,
): ArtDirectionEditorCommand => ({
  kind: "replace-profile",
  profile: createArtDirectionManifest(state.project, preset).profile,
});
