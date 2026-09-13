import type {
  DialogueChoice,
  DialogueGraph,
  DialogueLine,
  DialogueNode,
  Id,
} from "@evavo/adventure-project-schema";

export class DialogueEditorCommandError extends Error {
  readonly code:
    | "invalid-index"
    | "duplicate-id"
    | "missing-entity"
    | "identity-change"
    | "protected-entity"
    | "empty-batch";
  readonly path: string;

  constructor(code: DialogueEditorCommandError["code"], path: string, message: string) {
    super(message);
    this.name = "DialogueEditorCommandError";
    this.code = code;
    this.path = path;
  }
}

export type DialogueEditorCommand =
  | { readonly kind: "batch"; readonly commands: readonly DialogueEditorCommand[] }
  | {
      readonly kind: "replace-graph";
      readonly graph: DialogueGraph;
    }
  | {
      readonly kind: "insert-node";
      readonly index: number;
      readonly node: DialogueNode;
    }
  | {
      readonly kind: "remove-node";
      readonly nodeId: Id<"dialogue-node">;
    }
  | {
      readonly kind: "replace-node";
      readonly nodeId: Id<"dialogue-node">;
      readonly node: DialogueNode;
    }
  | {
      readonly kind: "insert-line";
      readonly nodeId: Id<"dialogue-node">;
      readonly index: number;
      readonly line: DialogueLine;
    }
  | {
      readonly kind: "remove-line";
      readonly nodeId: Id<"dialogue-node">;
      readonly lineId: Id<"dialogue-line">;
    }
  | {
      readonly kind: "replace-line";
      readonly nodeId: Id<"dialogue-node">;
      readonly lineId: Id<"dialogue-line">;
      readonly line: DialogueLine;
    }
  | {
      readonly kind: "insert-choice";
      readonly nodeId: Id<"dialogue-node">;
      readonly index: number;
      readonly choice: DialogueChoice;
    }
  | {
      readonly kind: "remove-choice";
      readonly nodeId: Id<"dialogue-node">;
      readonly choiceId: Id<"dialogue-choice">;
    }
  | {
      readonly kind: "replace-choice";
      readonly nodeId: Id<"dialogue-node">;
      readonly choiceId: Id<"dialogue-choice">;
      readonly choice: DialogueChoice;
    };

export interface AppliedDialogueEditorCommand {
  readonly graph: DialogueGraph;
  readonly inverse: DialogueEditorCommand;
}

export interface DialogueEditorDocumentState {
  readonly graph: DialogueGraph;
  readonly savedGraph: DialogueGraph;
  readonly operationRevision: number;
}

export interface DialogueEditorHistoryEntry {
  readonly undo: DialogueEditorCommand;
  readonly redo: DialogueEditorCommand;
}

export interface DialogueEditorHistoryState {
  readonly document: DialogueEditorDocumentState;
  readonly undoStack: readonly DialogueEditorHistoryEntry[];
  readonly redoStack: readonly DialogueEditorHistoryEntry[];
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) => left.localeCompare(right))) {
      const child = source[key];
      if (child !== undefined) output[key] = canonicalize(child);
    }
    return output;
  }
  return value;
};

export const canonicalDialogueEditorJson = (value: unknown): string => {
  const output = JSON.stringify(canonicalize(value));
  if (output === undefined) {
    throw new TypeError("Dialogue editor data cannot be represented as JSON.");
  }
  return output;
};

const insertAt = <T>(values: readonly T[], index: number, value: T, path: string): T[] => {
  if (!Number.isSafeInteger(index) || index < 0 || index > values.length) {
    throw new DialogueEditorCommandError(
      "invalid-index",
      path,
      `Insert index ${index} is outside 0 to ${values.length}.`,
    );
  }
  return [...values.slice(0, index).map(cloneJson), cloneJson(value), ...values.slice(index).map(cloneJson)];
};

const removeAt = <T>(values: readonly T[], index: number): T[] => [
  ...values.slice(0, index).map(cloneJson),
  ...values.slice(index + 1).map(cloneJson),
];

const replaceAt = <T>(values: readonly T[], index: number, value: T): T[] => [
  ...values.slice(0, index).map(cloneJson),
  cloneJson(value),
  ...values.slice(index + 1).map(cloneJson),
];

const findIndexOrThrow = <T>(
  values: readonly T[],
  predicate: (value: T) => boolean,
  path: string,
  label: string,
): number => {
  const index = values.findIndex(predicate);
  if (index < 0) {
    throw new DialogueEditorCommandError("missing-entity", path, `${label} does not exist.`);
  }
  return index;
};

const assertStableIdentity = (expected: string, actual: string, path: string): void => {
  if (expected !== actual) {
    throw new DialogueEditorCommandError(
      "identity-change",
      path,
      `Replace commands cannot change ID '${expected}' to '${actual}'.`,
    );
  }
};

const nodeIds = (node: DialogueNode): string[] => [
  node.id,
  ...node.lines.map((line) => line.id),
  ...node.choices.map((choice) => choice.id),
];

const graphIds = (graph: DialogueGraph): ReadonlySet<string> => {
  const ids = new Set<string>([graph.id]);
  for (const node of graph.nodes) {
    for (const id of nodeIds(node)) ids.add(id);
  }
  return ids;
};

const assertUniqueIds = (
  graph: DialogueGraph,
  ids: readonly string[],
  path: string,
  ignored: ReadonlySet<string> = new Set(),
): void => {
  const existing = graphIds(graph);
  const local = new Set<string>();
  for (const id of ids) {
    if (local.has(id)) {
      throw new DialogueEditorCommandError(
        "duplicate-id",
        path,
        `Dialogue data declares ID '${id}' more than once.`,
      );
    }
    local.add(id);
    if (existing.has(id) && !ignored.has(id)) {
      throw new DialogueEditorCommandError(
        "duplicate-id",
        path,
        `ID '${id}' already exists in dialogue '${graph.id}'.`,
      );
    }
  }
};

const getNode = (
  graph: DialogueGraph,
  nodeId: Id<"dialogue-node">,
): { readonly index: number; readonly node: DialogueNode } => {
  const index = findIndexOrThrow(
    graph.nodes,
    (node) => node.id === nodeId,
    "nodeId",
    `Dialogue node '${nodeId}'`,
  );
  const node = graph.nodes[index];
  if (!node) throw new Error("Dialogue node index is invalid.");
  return { index, node };
};

const updateNode = (graph: DialogueGraph, index: number, node: DialogueNode): DialogueGraph => ({
  ...graph,
  nodes: replaceAt(graph.nodes, index, node),
});

const nodeIsReferenced = (graph: DialogueGraph, nodeId: Id<"dialogue-node">): string | null => {
  for (const node of graph.nodes) {
    if (node.autoNextNodeId === nodeId) return `${node.id}.autoNextNodeId`;
    for (const choice of node.choices) {
      if (choice.nextNodeId === nodeId) return `${choice.id}.nextNodeId`;
    }
  }
  return null;
};

export const applyDialogueEditorCommand = (
  graph: DialogueGraph,
  command: DialogueEditorCommand,
): AppliedDialogueEditorCommand => {
  switch (command.kind) {
    case "batch": {
      if (command.commands.length === 0) {
        throw new DialogueEditorCommandError(
          "empty-batch",
          "commands",
          "Dialogue command batches cannot be empty.",
        );
      }
      let next = graph;
      const inverses: DialogueEditorCommand[] = [];
      for (const child of command.commands) {
        const applied = applyDialogueEditorCommand(next, child);
        next = applied.graph;
        inverses.unshift(applied.inverse);
      }
      return {
        graph: next,
        inverse: { kind: "batch", commands: inverses },
      };
    }
    case "replace-graph":
      assertStableIdentity(graph.id, command.graph.id, "graph.id");
      if (!command.graph.nodes.some((node) => node.id === command.graph.startNodeId)) {
        throw new DialogueEditorCommandError(
          "protected-entity",
          "graph.startNodeId",
          `Start node '${command.graph.startNodeId}' must exist.`,
        );
      }
      assertUniqueIds(
        graph,
        [...command.graph.nodes.flatMap(nodeIds)],
        "graph.nodes",
        new Set(graph.nodes.flatMap(nodeIds)),
      );
      return {
        graph: cloneJson(command.graph),
        inverse: { kind: "replace-graph", graph },
      };
    case "insert-node":
      assertUniqueIds(graph, nodeIds(command.node), "node");
      return {
        graph: {
          ...graph,
          nodes: insertAt(graph.nodes, command.index, command.node, "index"),
        },
        inverse: { kind: "remove-node", nodeId: command.node.id },
      };
    case "remove-node": {
      if (command.nodeId === graph.startNodeId) {
        throw new DialogueEditorCommandError(
          "protected-entity",
          "nodeId",
          `Start node '${command.nodeId}' cannot be removed.`,
        );
      }
      const reference = nodeIsReferenced(graph, command.nodeId);
      if (reference) {
        throw new DialogueEditorCommandError(
          "protected-entity",
          "nodeId",
          `Dialogue node '${command.nodeId}' is referenced by '${reference}'.`,
        );
      }
      const { index, node } = getNode(graph, command.nodeId);
      return {
        graph: { ...graph, nodes: removeAt(graph.nodes, index) },
        inverse: { kind: "insert-node", index, node },
      };
    }
    case "replace-node": {
      const { index, node: previous } = getNode(graph, command.nodeId);
      assertStableIdentity(command.nodeId, command.node.id, "node.id");
      assertUniqueIds(graph, nodeIds(command.node), "node", new Set(nodeIds(previous)));
      return {
        graph: updateNode(graph, index, command.node),
        inverse: {
          kind: "replace-node",
          nodeId: command.nodeId,
          node: previous,
        },
      };
    }
    case "insert-line": {
      const { index, node } = getNode(graph, command.nodeId);
      assertUniqueIds(graph, [command.line.id], "line.id");
      return {
        graph: updateNode(graph, index, {
          ...node,
          lines: insertAt(node.lines, command.index, command.line, "index"),
        }),
        inverse: {
          kind: "remove-line",
          nodeId: command.nodeId,
          lineId: command.line.id,
        },
      };
    }
    case "remove-line": {
      const { index, node } = getNode(graph, command.nodeId);
      const lineIndex = findIndexOrThrow(
        node.lines,
        (line) => line.id === command.lineId,
        "lineId",
        `Dialogue line '${command.lineId}'`,
      );
      const line = node.lines[lineIndex];
      if (!line) throw new Error("Dialogue line index is invalid.");
      return {
        graph: updateNode(graph, index, {
          ...node,
          lines: removeAt(node.lines, lineIndex),
        }),
        inverse: {
          kind: "insert-line",
          nodeId: command.nodeId,
          index: lineIndex,
          line,
        },
      };
    }
    case "replace-line": {
      const { index, node } = getNode(graph, command.nodeId);
      const lineIndex = findIndexOrThrow(
        node.lines,
        (line) => line.id === command.lineId,
        "lineId",
        `Dialogue line '${command.lineId}'`,
      );
      const previous = node.lines[lineIndex];
      if (!previous) throw new Error("Dialogue line index is invalid.");
      assertStableIdentity(command.lineId, command.line.id, "line.id");
      return {
        graph: updateNode(graph, index, {
          ...node,
          lines: replaceAt(node.lines, lineIndex, command.line),
        }),
        inverse: {
          kind: "replace-line",
          nodeId: command.nodeId,
          lineId: command.lineId,
          line: previous,
        },
      };
    }
    case "insert-choice": {
      const { index, node } = getNode(graph, command.nodeId);
      assertUniqueIds(graph, [command.choice.id], "choice.id");
      return {
        graph: updateNode(graph, index, {
          ...node,
          choices: insertAt(node.choices, command.index, command.choice, "index"),
        }),
        inverse: {
          kind: "remove-choice",
          nodeId: command.nodeId,
          choiceId: command.choice.id,
        },
      };
    }
    case "remove-choice": {
      const { index, node } = getNode(graph, command.nodeId);
      const choiceIndex = findIndexOrThrow(
        node.choices,
        (choice) => choice.id === command.choiceId,
        "choiceId",
        `Dialogue choice '${command.choiceId}'`,
      );
      const choice = node.choices[choiceIndex];
      if (!choice) throw new Error("Dialogue choice index is invalid.");
      return {
        graph: updateNode(graph, index, {
          ...node,
          choices: removeAt(node.choices, choiceIndex),
        }),
        inverse: {
          kind: "insert-choice",
          nodeId: command.nodeId,
          index: choiceIndex,
          choice,
        },
      };
    }
    case "replace-choice": {
      const { index, node } = getNode(graph, command.nodeId);
      const choiceIndex = findIndexOrThrow(
        node.choices,
        (choice) => choice.id === command.choiceId,
        "choiceId",
        `Dialogue choice '${command.choiceId}'`,
      );
      const previous = node.choices[choiceIndex];
      if (!previous) throw new Error("Dialogue choice index is invalid.");
      assertStableIdentity(command.choiceId, command.choice.id, "choice.id");
      return {
        graph: updateNode(graph, index, {
          ...node,
          choices: replaceAt(node.choices, choiceIndex, command.choice),
        }),
        inverse: {
          kind: "replace-choice",
          nodeId: command.nodeId,
          choiceId: command.choiceId,
          choice: previous,
        },
      };
    }
  }
};

export const createDialogueEditorDocument = (graph: DialogueGraph): DialogueEditorDocumentState => {
  const snapshot = cloneJson(graph);
  return {
    graph: snapshot,
    savedGraph: cloneJson(snapshot),
    operationRevision: 0,
  };
};

export const isDialogueEditorDocumentDirty = (document: DialogueEditorDocumentState): boolean =>
  canonicalDialogueEditorJson(document.graph) !== canonicalDialogueEditorJson(document.savedGraph);

export const createDialogueEditorHistory = (graph: DialogueGraph): DialogueEditorHistoryState => ({
  document: createDialogueEditorDocument(graph),
  undoStack: [],
  redoStack: [],
});

const applyToDocument = (
  document: DialogueEditorDocumentState,
  command: DialogueEditorCommand,
): {
  readonly document: DialogueEditorDocumentState;
  readonly inverse: DialogueEditorCommand;
} => {
  const applied = applyDialogueEditorCommand(document.graph, command);
  return {
    document: {
      ...document,
      graph: applied.graph,
      operationRevision: document.operationRevision + 1,
    },
    inverse: applied.inverse,
  };
};

export const executeDialogueEditorCommand = (
  history: DialogueEditorHistoryState,
  command: DialogueEditorCommand,
): DialogueEditorHistoryState => {
  const applied = applyToDocument(history.document, command);
  return {
    document: applied.document,
    undoStack: [...history.undoStack, { undo: applied.inverse, redo: cloneJson(command) }],
    redoStack: [],
  };
};

export const undoDialogueEditorCommand = (
  history: DialogueEditorHistoryState,
): DialogueEditorHistoryState => {
  const entry = history.undoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(history.document, entry.undo);
  return {
    document: applied.document,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, entry],
  };
};

export const redoDialogueEditorCommand = (
  history: DialogueEditorHistoryState,
): DialogueEditorHistoryState => {
  const entry = history.redoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(history.document, entry.redo);
  return {
    document: applied.document,
    undoStack: [...history.undoStack, entry],
    redoStack: history.redoStack.slice(0, -1),
  };
};

export const markDialogueEditorHistorySaved = (
  history: DialogueEditorHistoryState,
): DialogueEditorHistoryState => ({
  ...history,
  document: {
    ...history.document,
    savedGraph: cloneJson(history.document.graph),
  },
});
