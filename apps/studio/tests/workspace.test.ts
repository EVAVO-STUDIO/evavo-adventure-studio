import { describe, expect, it } from "vitest";
import { studioProject, studioSceneInstances } from "../src/fixture.js";
import {
  activeSceneComposition,
  createStudioWorkspace,
  deleteSelectionCommand,
  insertActorCommand,
  replaceSelectedPositionCommand,
  studioWorkspaceReducer,
  workspaceIsDirty,
} from "../src/workspace.js";

describe("studio workspace", () => {
  it("moves scene instances through editor-core history", () => {
    let state = createStudioWorkspace(studioProject, studioSceneInstances);
    const actor = activeSceneComposition(state).actorInstances[0];
    if (!actor) {
      throw new Error("Expected the fixture actor instance.");
    }

    state = studioWorkspaceReducer(state, {
      type: "select",
      selection: { kind: "actor", id: actor.id },
    });
    const command = replaceSelectedPositionCommand(state, { x: 101.4, y: 166.6 });
    if (!command) {
      throw new Error("Expected an actor replacement command.");
    }
    state = studioWorkspaceReducer(state, { type: "execute", command });

    expect(activeSceneComposition(state).actorInstances[0]?.position).toEqual({
      x: 101,
      y: 167,
    });
    expect(workspaceIsDirty(state)).toBe(true);
    expect(state.history.undoStack).toHaveLength(1);

    state = studioWorkspaceReducer(state, { type: "undo" });
    expect(activeSceneComposition(state).actorInstances[0]?.position).toEqual(actor.position);
    expect(workspaceIsDirty(state)).toBe(false);

    state = studioWorkspaceReducer(state, { type: "redo" });
    expect(activeSceneComposition(state).actorInstances[0]?.position).toEqual({
      x: 101,
      y: 167,
    });
  });

  it("creates unique actor instances and removes selected entities", () => {
    let state = createStudioWorkspace(studioProject, studioSceneInstances);
    const addition = insertActorCommand(state);
    state = studioWorkspaceReducer(state, {
      type: "execute",
      command: addition.command,
      selection: addition.selection,
    });

    expect(activeSceneComposition(state).actorInstances).toHaveLength(3);
    expect(state.selection).toEqual(addition.selection);

    const deletion = deleteSelectionCommand(state);
    if (!deletion) {
      throw new Error("Expected a deletion command.");
    }
    state = studioWorkspaceReducer(state, { type: "execute", command: deletion });
    state = studioWorkspaceReducer(state, { type: "select", selection: null });

    expect(activeSceneComposition(state).actorInstances).toHaveLength(2);
    expect(state.selection).toBeNull();
  });

  it("marks the current composition as saved", () => {
    let state = createStudioWorkspace(studioProject, studioSceneInstances);
    const addition = insertActorCommand(state);
    state = studioWorkspaceReducer(state, {
      type: "execute",
      command: addition.command,
    });
    expect(workspaceIsDirty(state)).toBe(true);

    state = studioWorkspaceReducer(state, { type: "mark-saved" });
    expect(workspaceIsDirty(state)).toBe(false);
  });

  it("switches scenes without mutating the composition document", () => {
    const original = JSON.stringify(studioSceneInstances);
    let state = createStudioWorkspace(studioProject, studioSceneInstances);
    state = studioWorkspaceReducer(state, {
      type: "select-scene",
      sceneId: studioProject.scenes[1]!.id,
    });

    expect(state.activeSceneId).toBe("scene.alley");
    expect(activeSceneComposition(state).actorInstances).toHaveLength(1);
    expect(JSON.stringify(studioSceneInstances)).toBe(original);
  });
});
