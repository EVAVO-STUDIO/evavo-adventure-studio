import type {
  AudioBusId,
  AudioBusMix,
  AudioCue,
  AudioDuckingRule,
  AudioMixIssue,
  AudioMixManifest,
  AudioSceneLayer,
  AudioSceneSoundscape,
  AudioSpeechBinding,
} from "@evavo/adventure-audio";
import { validateAudioMixManifest } from "@evavo/adventure-audio";
import {
  createAudioEditorHistory,
  executeAudioEditorCommand,
  isAudioEditorDocumentDirty,
  markAudioEditorHistorySaved,
  redoAudioEditorCommand,
  type AudioEditorCommand,
  type AudioEditorHistoryState,
  undoAudioEditorCommand,
} from "@evavo/adventure-audio-editor-core";
import type { AdventureProject, Id } from "@evavo/adventure-project-schema";

export interface AudioWorkspaceState {
  readonly project: AdventureProject;
  readonly history: AudioEditorHistoryState;
  readonly selectedCueId: Id<"audio-cue"> | null;
  readonly selectedSceneId: Id<"scene">;
  readonly selectedBindingId: Id<"audio-speech-binding"> | null;
  readonly selectedDuckingRuleId: Id<"audio-ducking-rule"> | null;
  readonly notice: string | null;
}

export type AudioWorkspaceAction =
  | { readonly type: "select-cue"; readonly cueId: Id<"audio-cue"> | null }
  | { readonly type: "select-scene"; readonly sceneId: Id<"scene"> }
  | {
      readonly type: "select-binding";
      readonly bindingId: Id<"audio-speech-binding"> | null;
    }
  | {
      readonly type: "select-ducking-rule";
      readonly ruleId: Id<"audio-ducking-rule"> | null;
    }
  | {
      readonly type: "execute";
      readonly command: AudioEditorCommand;
      readonly notice?: string;
    }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "mark-saved" }
  | { readonly type: "clear-notice" };

export const createAudioWorkspace = (
  project: AdventureProject,
  manifest: AudioMixManifest,
): AudioWorkspaceState => ({
  project,
  history: createAudioEditorHistory(project, manifest),
  selectedCueId: manifest.cues[0]?.id ?? null,
  selectedSceneId: project.startSceneId,
  selectedBindingId: manifest.speechBindings[0]?.id ?? null,
  selectedDuckingRuleId: manifest.ducking[0]?.id ?? null,
  notice: null,
});

export const audioWorkspaceManifest = (
  state: AudioWorkspaceState,
): AudioMixManifest => state.history.document.manifest;

export const selectedAudioCue = (
  state: AudioWorkspaceState,
): AudioCue | null =>
  audioWorkspaceManifest(state).cues.find(
    (cue) => cue.id === state.selectedCueId,
  ) ?? null;

export const selectedAudioSoundscape = (
  state: AudioWorkspaceState,
): AudioSceneSoundscape | null =>
  audioWorkspaceManifest(state).soundscapes.find(
    (soundscape) => soundscape.sceneId === state.selectedSceneId,
  ) ?? null;

export const selectedAudioSpeechBinding = (
  state: AudioWorkspaceState,
): AudioSpeechBinding | null =>
  audioWorkspaceManifest(state).speechBindings.find(
    (binding) => binding.id === state.selectedBindingId,
  ) ?? null;

export const selectedAudioDuckingRule = (
  state: AudioWorkspaceState,
): AudioDuckingRule | null =>
  audioWorkspaceManifest(state).ducking.find(
    (rule) => rule.id === state.selectedDuckingRuleId,
  ) ?? null;

export const audioWorkspaceIsDirty = (state: AudioWorkspaceState): boolean =>
  isAudioEditorDocumentDirty(state.history.document);

export const audioWorkspaceIssues = (
  state: AudioWorkspaceState,
): readonly AudioMixIssue[] =>
  validateAudioMixManifest(state.project, audioWorkspaceManifest(state));

export const audioIssuesForSelection = (
  state: AudioWorkspaceState,
): readonly AudioMixIssue[] => {
  const issues = audioWorkspaceIssues(state);
  if (
    state.selectedCueId === null &&
    state.selectedBindingId === null &&
    state.selectedDuckingRuleId === null
  ) {
    return issues;
  }

  const cue = selectedAudioCue(state);
  const soundscape = selectedAudioSoundscape(state);
  const binding = selectedAudioSpeechBinding(state);
  const rule = selectedAudioDuckingRule(state);
  return issues.filter(
    (issue) =>
      (cue ? issue.message.includes(`'${cue.id}'`) : false) ||
      (soundscape ? issue.message.includes(`'${soundscape.sceneId}'`) : false) ||
      (binding ? issue.message.includes(`'${binding.id}'`) : false) ||
      (rule ? issue.message.includes(`'${rule.id}'`) : false),
  );
};

export const replaceAudioBusCommand = (
  busId: AudioBusId,
  bus: AudioBusMix,
): AudioEditorCommand => ({ kind: "replace-bus", busId, bus });

export const replaceSelectedAudioCueCommand = (
  state: AudioWorkspaceState,
  cue: AudioCue,
): AudioEditorCommand => {
  if (!state.selectedCueId) {
    throw new Error("No audio cue is selected.");
  }
  return { kind: "replace-cue", cueId: state.selectedCueId, cue };
};

export const insertAudioCueCommand = (
  state: AudioWorkspaceState,
  cue: AudioCue,
  index = audioWorkspaceManifest(state).cues.length,
): AudioEditorCommand => ({ kind: "insert-cue", index, cue });

export const replaceSelectedSoundscapeCommand = (
  state: AudioWorkspaceState,
  soundscape: AudioSceneSoundscape,
): AudioEditorCommand => ({
  kind: "replace-soundscape",
  sceneId: state.selectedSceneId,
  soundscape,
});

export const insertSceneLayerCommand = (
  state: AudioWorkspaceState,
  layer: AudioSceneLayer,
  index = selectedAudioSoundscape(state)?.layers.length ?? 0,
): AudioEditorCommand => ({
  kind: "insert-scene-layer",
  sceneId: state.selectedSceneId,
  index,
  layer,
});

export const replaceSceneLayerCommand = (
  state: AudioWorkspaceState,
  layer: AudioSceneLayer,
): AudioEditorCommand => ({
  kind: "replace-scene-layer",
  sceneId: state.selectedSceneId,
  layerId: layer.id,
  layer,
});

export const replaceSpeechBindingCommand = (
  binding: AudioSpeechBinding,
): AudioEditorCommand => ({
  kind: "replace-speech-binding",
  bindingId: binding.id,
  binding,
});

export const replaceDuckingRuleCommand = (
  rule: AudioDuckingRule,
): AudioEditorCommand => ({
  kind: "replace-ducking-rule",
  ruleId: rule.id,
  rule,
});

const rejectedNotice = (error: unknown): string =>
  error instanceof Error
    ? `Audio edit rejected: ${error.message}`
    : "Audio edit was rejected.";

const reconciledSelection = (
  state: AudioWorkspaceState,
  history: AudioEditorHistoryState,
): Pick<
  AudioWorkspaceState,
  | "selectedCueId"
  | "selectedBindingId"
  | "selectedDuckingRuleId"
> => {
  const manifest = history.document.manifest;
  return {
    selectedCueId: manifest.cues.some(
      (cue) => cue.id === state.selectedCueId,
    )
      ? state.selectedCueId
      : (manifest.cues[0]?.id ?? null),
    selectedBindingId: manifest.speechBindings.some(
      (binding) => binding.id === state.selectedBindingId,
    )
      ? state.selectedBindingId
      : (manifest.speechBindings[0]?.id ?? null),
    selectedDuckingRuleId: manifest.ducking.some(
      (rule) => rule.id === state.selectedDuckingRuleId,
    )
      ? state.selectedDuckingRuleId
      : (manifest.ducking[0]?.id ?? null),
  };
};

export const audioWorkspaceReducer = (
  state: AudioWorkspaceState,
  action: AudioWorkspaceAction,
): AudioWorkspaceState => {
  switch (action.type) {
    case "select-cue":
      return { ...state, selectedCueId: action.cueId, notice: null };
    case "select-scene":
      return { ...state, selectedSceneId: action.sceneId, notice: null };
    case "select-binding":
      return { ...state, selectedBindingId: action.bindingId, notice: null };
    case "select-ducking-rule":
      return {
        ...state,
        selectedDuckingRuleId: action.ruleId,
        notice: null,
      };
    case "execute": {
      try {
        const history = executeAudioEditorCommand(
          state.project,
          state.history,
          action.command,
        );
        return {
          ...state,
          history,
          ...reconciledSelection(state, history),
          notice: action.notice ?? null,
        };
      } catch (error) {
        return { ...state, notice: rejectedNotice(error) };
      }
    }
    case "undo": {
      const history = undoAudioEditorCommand(state.project, state.history);
      return {
        ...state,
        history,
        ...reconciledSelection(state, history),
        notice: "Undid the last audio edit.",
      };
    }
    case "redo": {
      const history = redoAudioEditorCommand(state.project, state.history);
      return {
        ...state,
        history,
        ...reconciledSelection(state, history),
        notice: "Redid the audio edit.",
      };
    }
    case "mark-saved":
      return {
        ...state,
        history: markAudioEditorHistorySaved(state.history),
        notice: "Audio mix document marked as saved.",
      };
    case "clear-notice":
      return { ...state, notice: null };
  }
};
