import { describe, expect, it } from "vitest";
import { reportPlaytestArtifactReadFailure } from "../src/playtest-file-controller.js";
import { createPlaytestInspectorWorkspace } from "../src/playtest-workspace.js";

describe("playtest artifact file controller", () => {
  it("classifies a save read failure without disturbing unrelated errors", () => {
    const withReplayFailure = reportPlaytestArtifactReadFailure(
      createPlaytestInspectorWorkspace(),
      "replay",
      "broken.replay.json",
      new Error("device disconnected"),
    );

    const state = reportPlaytestArtifactReadFailure(
      withReplayFailure,
      "before-save",
      "broken.save.json",
      new Error("permission denied"),
    );

    expect(state.beforeSaveInput).toBeNull();
    expect(state.beforeSaveName).toBe("broken.save.json");
    expect(state.beforeInspection).toBeNull();
    expect(state.diff).toBeNull();
    expect(state.errors.beforeSave).toBe(
      "Unable to read 'broken.save.json': permission denied",
    );
    expect(state.errors.replay).toBe(
      "Unable to read 'broken.replay.json': device disconnected",
    );
  });

  it("invalidates bundle-dependent views when the selected bundle cannot be read", () => {
    const state = reportPlaytestArtifactReadFailure(
      createPlaytestInspectorWorkspace(),
      "bundle",
      "game.bundle.json",
      "read aborted",
    );

    expect(state).toMatchObject({
      bundle: null,
      bundleName: "game.bundle.json",
      beforeInspection: null,
      afterInspection: null,
      diff: null,
      replayInspection: null,
      errors: {
        bundle: "Unable to read 'game.bundle.json': read aborted",
      },
    });
  });

  it("uses the matching error channel for each artifact kind", () => {
    let state = createPlaytestInspectorWorkspace();
    state = reportPlaytestArtifactReadFailure(
      state,
      "after-save",
      "after.save.json",
      new Error("after failed"),
    );
    state = reportPlaytestArtifactReadFailure(
      state,
      "replay",
      "run.replay.json",
      new Error("replay failed"),
    );

    expect(state.afterSaveName).toBe("after.save.json");
    expect(state.replayName).toBe("run.replay.json");
    expect(state.errors).toEqual({
      bundle: null,
      beforeSave: null,
      afterSave: "Unable to read 'after.save.json': after failed",
      replay: "Unable to read 'run.replay.json': replay failed",
    });
  });
});
