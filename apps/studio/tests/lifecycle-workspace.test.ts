import { describe, expect, it } from "vitest";
import {
  studioLifecycleManifest,
  studioLifecycleProject,
} from "../src/lifecycle-fixture.js";
import {
  createLifecycleWorkspace,
  insertLifecycleOutcomeCommand,
  lifecycleWorkspaceIsDirty,
  lifecycleWorkspaceReducer,
  removeSelectedLifecycleOutcomeCommand,
  replaceSelectedLifecycleOutcomeCommand,
  selectedLifecycleOutcome,
} from "../src/lifecycle-workspace.js";

describe("Endings workspace", () => {
  it("creates a selected deterministic lifecycle document", () => {
    const state = createLifecycleWorkspace(studioLifecycleProject, studioLifecycleManifest);
    expect(selectedLifecycleOutcome(state).id).toBe("outcome.case-closed");
    expect(lifecycleWorkspaceIsDirty(state)).toBe(false);
  });

  it("adds an ending, edits it, then undoes and redoes the edit", () => {
    let state = createLifecycleWorkspace(studioLifecycleProject, studioLifecycleManifest);
    const addition = insertLifecycleOutcomeCommand(state, "success");
    state = lifecycleWorkspaceReducer(state, {
      type: "execute",
      command: addition.command,
      selectedOutcomeId: addition.outcomeId,
    });
    expect(selectedLifecycleOutcome(state).id).toBe(addition.outcomeId);
    expect(state.history.manifest.outcomes).toHaveLength(4);

    const current = selectedLifecycleOutcome(state);
    state = lifecycleWorkspaceReducer(state, {
      type: "execute",
      command: replaceSelectedLifecycleOutcomeCommand(state, {
        ...current,
        title: "Morning Edition",
        priority: 120,
      }),
    });
    expect(selectedLifecycleOutcome(state).title).toBe("Morning Edition");
    state = lifecycleWorkspaceReducer(state, { type: "undo" });
    expect(selectedLifecycleOutcome(state).title).not.toBe("Morning Edition");
    state = lifecycleWorkspaceReducer(state, { type: "redo" });
    expect(selectedLifecycleOutcome(state).title).toBe("Morning Edition");
  });

  it("keeps a valid selection after removing the selected outcome", () => {
    let state = createLifecycleWorkspace(studioLifecycleProject, studioLifecycleManifest);
    state = lifecycleWorkspaceReducer(state, {
      type: "select-outcome",
      outcomeId: "outcome.arrested",
    });
    state = lifecycleWorkspaceReducer(state, {
      type: "execute",
      command: removeSelectedLifecycleOutcomeCommand(state),
    });
    expect(state.history.manifest.outcomes.some((outcome) => outcome.id === "outcome.arrested")).toBe(false);
    expect(state.history.manifest.outcomes.some((outcome) => outcome.id === state.selectedOutcomeId)).toBe(true);
    expect(lifecycleWorkspaceIsDirty(state)).toBe(true);
  });
});