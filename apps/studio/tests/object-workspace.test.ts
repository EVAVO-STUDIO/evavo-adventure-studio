import { describe, expect, it } from "vitest";
import { studioProject, studioSceneInstances } from "../src/fixture.js";
import {
  createObjectWorkspace,
  insertObjectStateCommand,
  insertStateInteractionCommand,
  objectWorkspaceIsDirty,
  objectWorkspaceReducer,
  removeSelectedInteractionCommand,
  removeSelectedObjectStateCommand,
  replaceSelectedInteractionCommand,
  selectedObjectDefinition,
  selectedObjectInteraction,
  selectedObjectState,
  setInitialObjectStateCommand,
} from "../src/object-workspace.js";

describe("object state workspace", () => {
  it("adds states through reversible editor history", () => {
    let state = createObjectWorkspace(studioProject, studioSceneInstances);
    const before = selectedObjectDefinition(state)?.states.length;
    const addition = insertObjectStateCommand(state);
    state = objectWorkspaceReducer(state, {
      type: "execute",
      command: addition.command,
      stateId: addition.stateId,
    });

    expect(selectedObjectDefinition(state)?.states).toHaveLength((before ?? 0) + 1);
    expect(selectedObjectState(state)?.id).toBe(addition.stateId);
    expect(objectWorkspaceIsDirty(state)).toBe(true);

    state = objectWorkspaceReducer(state, { type: "undo" });
    expect(selectedObjectDefinition(state)?.states).toHaveLength(before ?? 0);
    expect(objectWorkspaceIsDirty(state)).toBe(false);
  });

  it("changes initial state before allowing state removal", () => {
    let state = createObjectWorkspace(studioProject, studioSceneInstances);
    const definition = selectedObjectDefinition(state)!;
    const initial = selectedObjectState(state)!;

    expect(() => removeSelectedObjectStateCommand(state)).toThrow(
      "Choose a different initial state",
    );

    const alternative = definition.states.find(
      (candidate) => candidate.id !== initial.id,
    );
    if (!alternative) throw new Error("Expected an alternative object state.");
    state = objectWorkspaceReducer(state, {
      type: "select-state",
      stateId: alternative.id,
    });
    state = objectWorkspaceReducer(state, {
      type: "execute",
      command: setInitialObjectStateCommand(state, alternative.id),
    });
    state = objectWorkspaceReducer(state, {
      type: "select-state",
      stateId: initial.id,
    });
    const removal = removeSelectedObjectStateCommand(state);
    state = objectWorkspaceReducer(state, {
      type: "execute",
      command: removal.command,
      stateId: removal.nextStateId,
    });

    expect(selectedObjectDefinition(state)?.states.some(
      (candidate) => candidate.id === initial.id,
    )).toBe(false);
  });

  it("adds, edits and removes state-specific interactions", () => {
    let state = createObjectWorkspace(studioProject, studioSceneInstances);
    const addition = insertStateInteractionCommand(state);
    state = objectWorkspaceReducer(state, {
      type: "execute",
      command: addition.command,
      interactionId: addition.interactionId,
    });

    const interaction = selectedObjectInteraction(state);
    if (!interaction) throw new Error("Expected the new interaction.");
    state = objectWorkspaceReducer(state, {
      type: "execute",
      command: replaceSelectedInteractionCommand(state, {
        ...interaction,
        verb: "take",
        actions: [{ kind: "say", text: "It is fixed to the desk." }],
      }),
    });

    expect(selectedObjectInteraction(state)).toMatchObject({
      verb: "take",
      actions: [{ kind: "say", text: "It is fixed to the desk." }],
    });

    state = objectWorkspaceReducer(state, {
      type: "execute",
      command: removeSelectedInteractionCommand(state),
      interactionId: null,
    });
    expect(selectedObjectInteraction(state)).toBeNull();
    expect(selectedObjectState(state)?.interactions.some(
      (candidate) => candidate.id === addition.interactionId,
    )).toBe(false);
  });

  it("keeps unique IDs across new states and verbs", () => {
    let state = createObjectWorkspace(studioProject, studioSceneInstances);
    const firstState = insertObjectStateCommand(state);
    state = objectWorkspaceReducer(state, {
      type: "execute",
      command: firstState.command,
      stateId: firstState.stateId,
    });
    const firstVerb = insertStateInteractionCommand(state);
    state = objectWorkspaceReducer(state, {
      type: "execute",
      command: firstVerb.command,
      interactionId: firstVerb.interactionId,
    });
    const secondVerb = insertStateInteractionCommand(state);

    expect(firstVerb.interactionId).not.toBe(secondVerb.interactionId);
    expect(firstState.stateId).not.toBe(firstVerb.interactionId);
  });
});
