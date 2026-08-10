import type { Id } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { studioAudioMix, studioAudioProject } from "../src/audio-fixture.js";
import {
  audioWorkspaceIsDirty,
  audioWorkspaceIssues,
  audioWorkspaceReducer,
  createAudioWorkspace,
  insertAudioCueCommand,
  replaceAudioBusCommand,
  replaceSceneLayerCommand,
  selectedAudioCue,
  selectedAudioSoundscape,
} from "../src/audio-workspace.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

describe("Audio Studio workspace", () => {
  it("loads a valid authored mix and tracks bus edits", () => {
    let state = createAudioWorkspace(studioAudioProject, studioAudioMix);
    expect(audioWorkspaceIssues(state).filter((issue) => issue.severity === "error")).toEqual([]);

    const music = studioAudioMix.buses.find((bus) => bus.id === "music")!;
    state = audioWorkspaceReducer(state, {
      type: "execute",
      command: replaceAudioBusCommand("music", { ...music, volume: 0.64 }),
      notice: "Adjusted score level.",
    });

    expect(
      state.history.document.manifest.buses.find((bus) => bus.id === "music")
        ?.volume,
    ).toBe(0.64);
    expect(audioWorkspaceIsDirty(state)).toBe(true);

    state = audioWorkspaceReducer(state, { type: "undo" });
    expect(
      state.history.document.manifest.buses.find((bus) => bus.id === "music")
        ?.volume,
    ).toBe(0.78);
    expect(audioWorkspaceIsDirty(state)).toBe(false);
  });

  it("edits scene layers without changing authored order", () => {
    let state = createAudioWorkspace(studioAudioProject, studioAudioMix);
    const soundscape = selectedAudioSoundscape(state)!;
    const rain = soundscape.layers.find(
      (layer) => layer.id === "audio-scene-layer.office.rain",
    )!;

    state = audioWorkspaceReducer(state, {
      type: "execute",
      command: replaceSceneLayerCommand(state, {
        ...rain,
        fadeInTicks: 36,
      }),
    });

    expect(selectedAudioSoundscape(state)?.layers.map((layer) => layer.id)).toEqual(
      soundscape.layers.map((layer) => layer.id),
    );
    expect(
      selectedAudioSoundscape(state)?.layers.find((layer) => layer.id === rain.id)
        ?.fadeInTicks,
    ).toBe(36);
  });

  it("rejects invalid cue edits without mutating history", () => {
    let state = createAudioWorkspace(studioAudioProject, studioAudioMix);
    const cue = selectedAudioCue(state)!;
    const revision = state.history.document.operationRevision;

    state = audioWorkspaceReducer(state, {
      type: "execute",
      command: {
        kind: "replace-cue",
        cueId: cue.id,
        cue: {
          ...cue,
          bus: "speech",
          loop: {
            startMilliseconds: 0,
            endMilliseconds: 1000,
            crossfadeMilliseconds: 0,
          },
        },
      },
    });

    expect(state.history.document.operationRevision).toBe(revision);
    expect(state.notice).toContain("Audio edit rejected");
  });

  it("reconciles selection after a selected cue is removed", () => {
    let state = createAudioWorkspace(studioAudioProject, studioAudioMix);
    state = audioWorkspaceReducer(state, {
      type: "select-cue",
      cueId: id<"audio-cue">("audio-cue.effect.thunder"),
    });
    state = audioWorkspaceReducer(state, {
      type: "execute",
      command: {
        kind: "remove-cue",
        cueId: id<"audio-cue">("audio-cue.effect.thunder"),
      },
    });

    expect(state.selectedCueId).toBe(studioAudioMix.cues[0]?.id);
  });

  it("creates new authored cues through serializable commands", () => {
    let state = createAudioWorkspace(studioAudioProject, studioAudioMix);
    const cue = {
      ...studioAudioMix.cues.find(
        (candidate) => candidate.id === "audio-cue.interface.click",
      )!,
      id: id<"audio-cue">("audio-cue.interface.hover"),
      name: "Interface hover",
      volume: 0.42,
    };
    state = audioWorkspaceReducer(state, {
      type: "execute",
      command: insertAudioCueCommand(state, cue),
    });

    expect(
      state.history.document.manifest.cues.some(
        (candidate) => candidate.id === cue.id,
      ),
    ).toBe(true);
  });
});
