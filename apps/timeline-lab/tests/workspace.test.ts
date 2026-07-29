import { describe, expect, it } from "vitest";
import { timelineSequence } from "../src/fixture.js";
import {
  createTimelineWorkspace,
  insertCueCommand,
  moveSelectedCueCommand,
  removeSelectedCueCommand,
  selectedTimelineCue,
  timelineSequenceDocument,
  timelineWorkspaceIsDirty,
  timelineWorkspaceReducer,
} from "../src/workspace.js";

describe("cinematic timeline workspace", () => {
  it("moves cues across authored ordering with one undo step", () => {
    let state = createTimelineWorkspace(timelineSequence);
    const track = timelineSequence.tracks[0]!;
    const cue = track.cues[0]!;
    state = timelineWorkspaceReducer(state, {
      type: "select",
      selection: {
        trackId: track.id,
        cueIndex: 0,
        expectedCue: cue,
      },
    });
    const move = moveSelectedCueCommand(state, 150);
    state = timelineWorkspaceReducer(state, {
      type: "execute",
      command: move.command,
      selection: move.selection,
    });

    expect(timelineSequenceDocument(state).tracks[0]?.cues.map((item) => item.atTick)).toEqual([
      72,
      150,
      174,
    ]);
    expect(selectedTimelineCue(state)?.cue.atTick).toBe(150);
    expect(state.history.undoStack).toHaveLength(1);
    expect(timelineWorkspaceIsDirty(state)).toBe(true);

    state = timelineWorkspaceReducer(state, { type: "undo" });
    expect(timelineSequenceDocument(state).tracks[0]?.cues).toEqual(track.cues);
    expect(timelineWorkspaceIsDirty(state)).toBe(false);
  });

  it("snaps inserted cues to the active fixed-tick interval", () => {
    let state = createTimelineWorkspace(timelineSequence);
    state = timelineWorkspaceReducer(state, {
      type: "set-playhead",
      playheadTick: 53,
    });
    const addition = insertCueCommand(state, timelineSequence.tracks[2]!.id);
    state = timelineWorkspaceReducer(state, {
      type: "execute",
      command: addition.command,
      selection: addition.selection,
    });

    expect(selectedTimelineCue(state)?.cue).toMatchObject({
      kind: "speech",
      atTick: 54,
      text: "New cinematic line.",
    });
  });

  it("removes the selected cue with exact expected state", () => {
    let state = createTimelineWorkspace(timelineSequence);
    const track = timelineSequence.tracks[5]!;
    const cue = track.cues[0]!;
    state = timelineWorkspaceReducer(state, {
      type: "select",
      selection: {
        trackId: track.id,
        cueIndex: 0,
        expectedCue: cue,
      },
    });
    state = timelineWorkspaceReducer(state, {
      type: "execute",
      command: removeSelectedCueCommand(state),
      selection: null,
    });

    expect(timelineSequenceDocument(state).tracks[5]?.cues).toHaveLength(1);
  });

  it("clamps zoom, snapping and playhead settings", () => {
    let state = createTimelineWorkspace(timelineSequence);
    state = timelineWorkspaceReducer(state, {
      type: "set-zoom",
      pixelsPerTick: 100,
    });
    state = timelineWorkspaceReducer(state, { type: "set-snap", snapTicks: 0 });
    state = timelineWorkspaceReducer(state, {
      type: "set-playhead",
      playheadTick: 9999,
    });

    expect(state.pixelsPerTick).toBe(8);
    expect(state.snapTicks).toBe(1);
    expect(state.playheadTick).toBe(timelineSequence.durationTicks - 1);
  });
});
