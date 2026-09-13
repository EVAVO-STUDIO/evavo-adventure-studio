import type { Id } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { studioDialogueGraph } from "../src/dialogue-fixture.js";
import {
  createDialogueWorkspace,
  dialogueGraph,
  dialogueWorkspaceIsDirty,
  dialogueWorkspaceReducer,
  insertDialogueChoiceCommand,
  insertDialogueLineCommand,
  insertDialogueNodeCommand,
  removeSelectedDialogueChoiceCommand,
  replaceSelectedDialogueChoiceCommand,
  replaceSelectedDialogueLineCommand,
  selectedDialogueChoice,
  selectedDialogueLine,
  selectedDialogueNode,
} from "../src/dialogue-workspace.js";

describe("dialogue studio workspace", () => {
  it("adds topic nodes and preserves undo history", () => {
    let state = createDialogueWorkspace(studioDialogueGraph);
    const addition = insertDialogueNodeCommand(state);
    state = dialogueWorkspaceReducer(state, {
      type: "execute",
      command: addition.command,
      nodeId: addition.nodeId,
      lineId: null,
      choiceId: null,
    });

    expect(dialogueGraph(state).nodes).toHaveLength(studioDialogueGraph.nodes.length + 1);
    expect(selectedDialogueNode(state).id).toBe(addition.nodeId);
    expect(dialogueWorkspaceIsDirty(state)).toBe(true);

    state = dialogueWorkspaceReducer(state, { type: "undo" });
    expect(dialogueGraph(state).nodes).toHaveLength(studioDialogueGraph.nodes.length);
    expect(dialogueWorkspaceIsDirty(state)).toBe(false);
  });

  it("adds and edits performance lines", () => {
    let state = createDialogueWorkspace(studioDialogueGraph);
    const addition = insertDialogueLineCommand(state);
    state = dialogueWorkspaceReducer(state, {
      type: "execute",
      command: addition.command,
      lineId: addition.lineId,
      choiceId: null,
    });

    const line = selectedDialogueLine(state);
    if (!line) throw new Error("Expected the inserted dialogue line.");
    state = dialogueWorkspaceReducer(state, {
      type: "execute",
      command: replaceSelectedDialogueLineCommand(state, {
        ...line,
        speakerId: id<"actor">("actor.detective"),
        text: "Let us begin again.",
      }),
    });

    expect(selectedDialogueLine(state)).toMatchObject({
      speakerId: "actor.detective",
      text: "Let us begin again.",
    });
  });

  it("adds, branches and removes player choices", () => {
    let state = createDialogueWorkspace(studioDialogueGraph);
    const addition = insertDialogueChoiceCommand(state);
    state = dialogueWorkspaceReducer(state, {
      type: "execute",
      command: addition.command,
      choiceId: addition.choiceId,
      lineId: null,
    });

    const choice = selectedDialogueChoice(state);
    if (!choice) throw new Error("Expected the inserted dialogue choice.");
    const target = studioDialogueGraph.nodes[1]!.id;
    state = dialogueWorkspaceReducer(state, {
      type: "execute",
      command: replaceSelectedDialogueChoiceCommand(state, {
        ...choice,
        text: "Return to the ledger.",
        nextNodeId: target,
        closeDialogue: false,
      }),
    });

    expect(selectedDialogueChoice(state)).toMatchObject({
      text: "Return to the ledger.",
      nextNodeId: target,
      closeDialogue: false,
    });

    state = dialogueWorkspaceReducer(state, {
      type: "execute",
      command: removeSelectedDialogueChoiceCommand(state),
      choiceId: null,
    });
    expect(selectedDialogueChoice(state)).toBeNull();
  });

  it("switches topics without mutating the fixture graph", () => {
    const original = JSON.stringify(studioDialogueGraph);
    let state = createDialogueWorkspace(studioDialogueGraph);
    state = dialogueWorkspaceReducer(state, {
      type: "select-node",
      nodeId: studioDialogueGraph.nodes[2]!.id,
    });

    expect(selectedDialogueNode(state).id).toBe(studioDialogueGraph.nodes[2]!.id);
    expect(JSON.stringify(studioDialogueGraph)).toBe(original);
  });
});
const id = <T extends string>(value: string): Id<T> => value as Id<T>;
