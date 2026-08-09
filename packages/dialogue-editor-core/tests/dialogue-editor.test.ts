import { dialogueGraphSchema, type Id } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { parseDialogueEditorCommand } from "../src/command-schema.js";
import {
  createDialogueEditorHistory,
  type DialogueEditorCommandError,
  executeDialogueEditorCommand,
  isDialogueEditorDocumentDirty,
  markDialogueEditorHistorySaved,
  redoDialogueEditorCommand,
  undoDialogueEditorCommand,
} from "../src/index.js";

const id = <T extends string>(value: string) => value as Id<T>;

const graph = dialogueGraphSchema.parse({
  id: "dialogue.detective.receptionist",
  name: "Receptionist interview",
  startNodeId: "dialogue-node.receptionist.opening",
  nodes: [
    {
      id: "dialogue-node.receptionist.opening",
      lines: [
        {
          id: "dialogue-line.receptionist.opening",
          speakerId: "actor.receptionist",
          text: "You are late, detective.",
        },
      ],
      choices: [
        {
          id: "dialogue-choice.receptionist.ask-ledger",
          text: "Ask about the missing ledger.",
          nextNodeId: "dialogue-node.receptionist.ledger",
        },
      ],
    },
    {
      id: "dialogue-node.receptionist.ledger",
      lines: [
        {
          id: "dialogue-line.receptionist.ledger",
          speakerId: "actor.receptionist",
          text: "It was here before the lights failed.",
        },
      ],
      choices: [
        {
          id: "dialogue-choice.receptionist.close",
          text: "End the interview.",
          closeDialogue: true,
        },
      ],
    },
  ],
});

describe("dialogue editor history", () => {
  it("edits lines with deterministic undo and redo", () => {
    let history = createDialogueEditorHistory(graph);
    const node = graph.nodes[0]!;
    const line = node.lines[0]!;
    history = executeDialogueEditorCommand(history, {
      kind: "replace-line",
      nodeId: node.id,
      lineId: line.id,
      line: { ...line, text: "You took your time, detective." },
    });

    expect(history.document.graph.nodes[0]?.lines[0]?.text).toBe("You took your time, detective.");
    expect(isDialogueEditorDocumentDirty(history.document)).toBe(true);

    history = undoDialogueEditorCommand(history);
    expect(history.document.graph.nodes[0]?.lines[0]?.text).toBe("You are late, detective.");
    expect(isDialogueEditorDocumentDirty(history.document)).toBe(false);

    history = redoDialogueEditorCommand(history);
    expect(history.document.graph.nodes[0]?.lines[0]?.text).toBe("You took your time, detective.");

    history = markDialogueEditorHistorySaved(history);
    expect(isDialogueEditorDocumentDirty(history.document)).toBe(false);
  });

  it("protects start and referenced nodes", () => {
    const history = createDialogueEditorHistory(graph);

    expect(() =>
      executeDialogueEditorCommand(history, {
        kind: "remove-node",
        nodeId: graph.startNodeId,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<DialogueEditorCommandError>>({
        code: "protected-entity",
      }),
    );

    expect(() =>
      executeDialogueEditorCommand(history, {
        kind: "remove-node",
        nodeId: graph.nodes[1]!.id,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<DialogueEditorCommandError>>({
        code: "protected-entity",
      }),
    );
  });

  it("prevents duplicate line and choice IDs", () => {
    const history = createDialogueEditorHistory(graph);

    expect(() =>
      executeDialogueEditorCommand(history, {
        kind: "insert-line",
        nodeId: graph.nodes[1]!.id,
        index: 1,
        line: {
          id: graph.nodes[0]!.lines[0]!.id,
          text: "Duplicate line.",
          interruptible: true,
        },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<DialogueEditorCommandError>>({
        code: "duplicate-id",
      }),
    );

    expect(() =>
      executeDialogueEditorCommand(history, {
        kind: "insert-choice",
        nodeId: graph.nodes[1]!.id,
        index: 1,
        choice: {
          id: graph.nodes[0]!.choices[0]!.id,
          text: "Duplicate choice.",
          once: false,
          actions: [],
          closeDialogue: true,
        },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<DialogueEditorCommandError>>({
        code: "duplicate-id",
      }),
    );
  });

  it("applies atomic line and choice batches", () => {
    const node = graph.nodes[1]!;
    const history = executeDialogueEditorCommand(createDialogueEditorHistory(graph), {
      kind: "batch",
      commands: [
        {
          kind: "insert-line",
          nodeId: node.id,
          index: node.lines.length,
          line: {
            id: id<"dialogue-line">("dialogue-line.receptionist.warning"),
            speakerId: id<"actor">("actor.detective"),
            text: "Then somebody used the blackout.",
            interruptible: true,
          },
        },
        {
          kind: "insert-choice",
          nodeId: node.id,
          index: node.choices.length,
          choice: {
            id: id<"dialogue-choice">("dialogue-choice.receptionist.press"),
            text: "Press for a name.",
            once: false,
            actions: [],
            closeDialogue: true,
          },
        },
      ],
    });

    expect(history.document.graph.nodes[1]?.lines).toHaveLength(2);
    expect(history.document.graph.nodes[1]?.choices).toHaveLength(2);
    expect(history.undoStack).toHaveLength(1);
  });
});

describe("dialogue editor command schema", () => {
  it("parses recursive dialogue batches", () => {
    expect(
      parseDialogueEditorCommand({
        kind: "batch",
        commands: [
          {
            kind: "replace-line",
            nodeId: graph.nodes[0]!.id,
            lineId: graph.nodes[0]!.lines[0]!.id,
            line: {
              ...graph.nodes[0]!.lines[0],
              text: "Changed line.",
            },
          },
        ],
      }),
    ).toMatchObject({ kind: "batch" });
  });

  it("rejects empty dialogue batches", () => {
    expect(() => parseDialogueEditorCommand({ kind: "batch", commands: [] })).toThrow();
  });
});
