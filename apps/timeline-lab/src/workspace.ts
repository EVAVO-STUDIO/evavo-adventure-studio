import type { Id, Sequence, SequenceCue, SequenceTrack } from "@evavo/adventure-project-schema";
import {
  createSequenceEditorHistory,
  executeSequenceEditorCommand,
  isSequenceEditorDocumentDirty,
  markSequenceEditorHistorySaved,
  redoSequenceEditorCommand,
  type SequenceEditorCommand,
  type SequenceEditorHistoryState,
  undoSequenceEditorCommand,
} from "@evavo/adventure-sequence-editor-core";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

export interface TimelineSelection {
  readonly trackId: Id<"sequence-track">;
  readonly cueIndex: number;
  readonly expectedCue: SequenceCue;
}

export interface TimelineWorkspaceState {
  readonly history: SequenceEditorHistoryState;
  readonly selection: TimelineSelection | null;
  readonly pixelsPerTick: number;
  readonly scrollTick: number;
  readonly snapTicks: number;
  readonly playheadTick: number;
  readonly notice: string | null;
}

export type TimelineWorkspaceAction =
  | { readonly type: "select"; readonly selection: TimelineSelection | null }
  | {
      readonly type: "execute";
      readonly command: SequenceEditorCommand;
      readonly selection?: TimelineSelection | null;
      readonly notice?: string;
    }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "mark-saved" }
  | { readonly type: "set-zoom"; readonly pixelsPerTick: number }
  | { readonly type: "set-scroll"; readonly scrollTick: number }
  | { readonly type: "set-snap"; readonly snapTicks: number }
  | { readonly type: "set-playhead"; readonly playheadTick: number };

export const createTimelineWorkspace = (sequence: Sequence): TimelineWorkspaceState => ({
  history: createSequenceEditorHistory(sequence),
  selection: null,
  pixelsPerTick: 1.6,
  scrollTick: 0,
  snapTicks: 6,
  playheadTick: 0,
  notice: null,
});

export const timelineWorkspaceReducer = (
  state: TimelineWorkspaceState,
  action: TimelineWorkspaceAction,
): TimelineWorkspaceState => {
  switch (action.type) {
    case "select":
      return { ...state, selection: action.selection, notice: null };
    case "execute":
      return {
        ...state,
        history: executeSequenceEditorCommand(state.history, action.command),
        selection: action.selection === undefined ? state.selection : action.selection,
        notice: action.notice ?? null,
      };
    case "undo":
      return {
        ...state,
        history: undoSequenceEditorCommand(state.history),
        selection: null,
        notice: "Undid the last timeline edit.",
      };
    case "redo":
      return {
        ...state,
        history: redoSequenceEditorCommand(state.history),
        selection: null,
        notice: "Redid the timeline edit.",
      };
    case "mark-saved":
      return {
        ...state,
        history: markSequenceEditorHistorySaved(state.history),
        notice: "Sequence document marked as saved.",
      };
    case "set-zoom":
      return {
        ...state,
        pixelsPerTick: Math.min(8, Math.max(0.4, action.pixelsPerTick)),
      };
    case "set-scroll":
      return { ...state, scrollTick: Math.max(0, action.scrollTick) };
    case "set-snap":
      return {
        ...state,
        snapTicks: Math.max(1, Math.round(action.snapTicks)),
      };
    case "set-playhead":
      return {
        ...state,
        playheadTick: Math.min(
          state.history.document.sequence.durationTicks - 1,
          Math.max(0, Math.round(action.playheadTick)),
        ),
      };
  }
};

export const timelineSequenceDocument = (state: TimelineWorkspaceState): Sequence =>
  state.history.document.sequence;

export const timelineWorkspaceIsDirty = (state: TimelineWorkspaceState): boolean =>
  isSequenceEditorDocumentDirty(state.history.document);

export const selectedTimelineCue = (
  state: TimelineWorkspaceState,
): { readonly track: SequenceTrack; readonly cue: SequenceCue } | null => {
  const selection = state.selection;
  if (!selection) return null;
  const track = timelineSequenceDocument(state).tracks.find(
    (candidate) => candidate.id === selection.trackId,
  );
  const cue = track?.cues[selection.cueIndex];
  return track && cue ? { track, cue } : null;
};

export const snapTick = (state: TimelineWorkspaceState, tick: number): number =>
  Math.min(
    timelineSequenceDocument(state).durationTicks - 1,
    Math.max(0, Math.round(tick / state.snapTicks) * state.snapTicks),
  );

const insertionIndex = (cues: readonly SequenceCue[], tick: number): number => {
  const index = cues.findIndex((cue) => cue.atTick > tick);
  return index < 0 ? cues.length : index;
};

export const moveSelectedCueCommand = (
  state: TimelineWorkspaceState,
  targetTick: number,
): {
  readonly command: SequenceEditorCommand;
  readonly selection: TimelineSelection;
} => {
  const selection = state.selection;
  const selected = selectedTimelineCue(state);
  if (!selection || !selected) {
    throw new Error("Select a timeline cue before moving it.");
  }
  const atTick = snapTick(state, targetTick);
  const cue = { ...selected.cue, atTick } as SequenceCue;
  const remaining = selected.track.cues.filter((_candidate, index) => index !== selection.cueIndex);
  const index = insertionIndex(remaining, atTick);
  return {
    command: {
      kind: "batch",
      commands: [
        {
          kind: "remove-cue",
          trackId: selection.trackId,
          cueIndex: selection.cueIndex,
          expectedCue: selection.expectedCue,
        },
        {
          kind: "insert-cue",
          trackId: selection.trackId,
          index,
          cue,
        },
      ],
    },
    selection: {
      trackId: selection.trackId,
      cueIndex: index,
      expectedCue: cue,
    },
  };
};

export const replaceSelectedCueCommand = (
  state: TimelineWorkspaceState,
  cue: SequenceCue,
): SequenceEditorCommand => {
  const selection = state.selection;
  if (!selection) {
    throw new Error("Select a timeline cue before editing it.");
  }
  return {
    kind: "replace-cue",
    trackId: selection.trackId,
    cueIndex: selection.cueIndex,
    expectedCue: selection.expectedCue,
    cue,
  };
};

export const removeSelectedCueCommand = (state: TimelineWorkspaceState): SequenceEditorCommand => {
  const selection = state.selection;
  if (!selection) {
    throw new Error("Select a timeline cue before removing it.");
  }
  return {
    kind: "remove-cue",
    trackId: selection.trackId,
    cueIndex: selection.cueIndex,
    expectedCue: selection.expectedCue,
  };
};

const defaultCueForTrack = (track: SequenceTrack, atTick: number): SequenceCue => {
  switch (track.kind) {
    case "actor":
      return {
        kind: "actor-animation",
        atTick,
        actorId: id<"actor">("actor.detective"),
        animationState: "idle",
        facing: "east",
        awaitCompletion: false,
      };
    case "camera":
      return {
        kind: "camera-shot",
        atTick,
        durationTicks: 30,
        position: { x: 0, y: 0 },
        easing: "linear",
      };
    case "dialogue":
      return {
        kind: "speech",
        atTick,
        text: "New cinematic line.",
        durationTicks: 36,
      };
    case "audio":
      return {
        kind: "stop-audio",
        atTick,
        bus: "effects",
        fadeTicks: 0,
      };
    case "story":
      return {
        kind: "story-action",
        atTick,
        action: { kind: "set-flag", flag: "sequence.new-cue", value: true },
      };
    case "effects":
      return {
        kind: "layer-visibility",
        atTick,
        layerId: "layer.new",
        visible: true,
      };
  }
};

export const insertCueCommand = (
  state: TimelineWorkspaceState,
  trackId: Id<"sequence-track">,
  targetTick = state.playheadTick,
): {
  readonly command: SequenceEditorCommand;
  readonly selection: TimelineSelection;
} => {
  const sequence = timelineSequenceDocument(state);
  const track = sequence.tracks.find((candidate) => candidate.id === trackId);
  if (!track) {
    throw new Error(`Timeline track '${trackId}' does not exist.`);
  }
  const atTick = snapTick(state, targetTick);
  const cue = defaultCueForTrack(track, atTick);
  const index = insertionIndex(track.cues, atTick);
  return {
    command: {
      kind: "insert-cue",
      trackId,
      index,
      cue,
    },
    selection: { trackId, cueIndex: index, expectedCue: cue },
  };
};
