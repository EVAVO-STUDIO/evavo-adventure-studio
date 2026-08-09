import {
  createDialogueEditorHistory,
  type DialogueEditorCommand,
  type DialogueEditorHistoryState,
  executeDialogueEditorCommand,
  isDialogueEditorDocumentDirty,
  markDialogueEditorHistorySaved,
  redoDialogueEditorCommand,
  undoDialogueEditorCommand,
} from "@evavo/adventure-dialogue-editor-core";
import type {
  DialogueChoice,
  DialogueGraph,
  DialogueLine,
  DialogueNode,
  Id,
} from "@evavo/adventure-project-schema";

export interface DialogueWorkspaceState {
  readonly history: DialogueEditorHistoryState;
  readonly nodeId: Id<"dialogue-node">;
  readonly lineId: Id<"dialogue-line"> | null;
  readonly choiceId: Id<"dialogue-choice"> | null;
  readonly notice: string | null;
}

export type DialogueWorkspaceAction =
  | { readonly type: "select-node"; readonly nodeId: Id<"dialogue-node"> }
  | {
      readonly type: "select-line";
      readonly lineId: Id<"dialogue-line"> | null;
    }
  | {
      readonly type: "select-choice";
      readonly choiceId: Id<"dialogue-choice"> | null;
    }
  | {
      readonly type: "execute";
      readonly command: DialogueEditorCommand;
      readonly nodeId?: Id<"dialogue-node">;
      readonly lineId?: Id<"dialogue-line"> | null;
      readonly choiceId?: Id<"dialogue-choice"> | null;
      readonly notice?: string;
    }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "mark-saved" };

export const createDialogueWorkspace = (graph: DialogueGraph): DialogueWorkspaceState => ({
  history: createDialogueEditorHistory(graph),
  nodeId: graph.startNodeId,
  lineId: null,
  choiceId: null,
  notice: null,
});

export const dialogueWorkspaceReducer = (
  state: DialogueWorkspaceState,
  action: DialogueWorkspaceAction,
): DialogueWorkspaceState => {
  switch (action.type) {
    case "select-node":
      return {
        ...state,
        nodeId: action.nodeId,
        lineId: null,
        choiceId: null,
        notice: null,
      };
    case "select-line":
      return {
        ...state,
        lineId: action.lineId,
        choiceId: null,
        notice: null,
      };
    case "select-choice":
      return {
        ...state,
        choiceId: action.choiceId,
        lineId: null,
        notice: null,
      };
    case "execute":
      return {
        ...state,
        history: executeDialogueEditorCommand(state.history, action.command),
        nodeId: action.nodeId ?? state.nodeId,
        lineId: action.lineId === undefined ? state.lineId : action.lineId,
        choiceId: action.choiceId === undefined ? state.choiceId : action.choiceId,
        notice: action.notice ?? null,
      };
    case "undo":
      return {
        ...state,
        history: undoDialogueEditorCommand(state.history),
        lineId: null,
        choiceId: null,
        notice: "Undid the last dialogue edit.",
      };
    case "redo":
      return {
        ...state,
        history: redoDialogueEditorCommand(state.history),
        lineId: null,
        choiceId: null,
        notice: "Redid the dialogue edit.",
      };
    case "mark-saved":
      return {
        ...state,
        history: markDialogueEditorHistorySaved(state.history),
        notice: "Dialogue graph marked as saved.",
      };
  }
};

export const dialogueGraph = (state: DialogueWorkspaceState): DialogueGraph => state.history.document.graph;

export const dialogueWorkspaceIsDirty = (state: DialogueWorkspaceState): boolean =>
  isDialogueEditorDocumentDirty(state.history.document);

export const selectedDialogueNode = (state: DialogueWorkspaceState): DialogueNode => {
  const node = dialogueGraph(state).nodes.find((candidate) => candidate.id === state.nodeId);
  if (!node) {
    throw new Error(`Dialogue node '${state.nodeId}' does not exist.`);
  }
  return node;
};

export const selectedDialogueLine = (state: DialogueWorkspaceState): DialogueLine | null =>
  selectedDialogueNode(state).lines.find((candidate) => candidate.id === state.lineId) ?? null;

export const selectedDialogueChoice = (state: DialogueWorkspaceState): DialogueChoice | null =>
  selectedDialogueNode(state).choices.find((candidate) => candidate.id === state.choiceId) ?? null;

const graphIds = (graph: DialogueGraph): ReadonlySet<string> => {
  const ids = new Set<string>([graph.id]);
  for (const node of graph.nodes) {
    ids.add(node.id);
    for (const line of node.lines) ids.add(line.id);
    for (const choice of node.choices) ids.add(choice.id);
  }
  return ids;
};

const uniqueId = (ids: ReadonlySet<string>, prefix: string): string => {
  let index = 1;
  while (ids.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
};

const asId = <T extends string>(value: string): Id<T> => value as Id<T>;

export const insertDialogueNodeCommand = (
  state: DialogueWorkspaceState,
): {
  readonly command: DialogueEditorCommand;
  readonly nodeId: Id<"dialogue-node">;
} => {
  const graph = dialogueGraph(state);
  const nodeId = asId<"dialogue-node">(uniqueId(graphIds(graph), `dialogue-node.${graph.id}.topic`));
  return {
    command: {
      kind: "insert-node",
      index: graph.nodes.length,
      node: {
        id: nodeId,
        enterActions: [],
        lines: [],
        choices: [],
        exitActions: [],
      },
    },
    nodeId,
  };
};

export const removeSelectedDialogueNodeCommand = (state: DialogueWorkspaceState): DialogueEditorCommand => ({
  kind: "remove-node",
  nodeId: state.nodeId,
});

export const replaceSelectedDialogueNodeCommand = (
  state: DialogueWorkspaceState,
  node: DialogueNode,
): DialogueEditorCommand => ({
  kind: "replace-node",
  nodeId: state.nodeId,
  node,
});

export const insertDialogueLineCommand = (
  state: DialogueWorkspaceState,
): {
  readonly command: DialogueEditorCommand;
  readonly lineId: Id<"dialogue-line">;
} => {
  const graph = dialogueGraph(state);
  const node = selectedDialogueNode(state);
  const lineId = asId<"dialogue-line">(uniqueId(graphIds(graph), `dialogue-line.${node.id}.line`));
  return {
    command: {
      kind: "insert-line",
      nodeId: node.id,
      index: node.lines.length,
      line: {
        id: lineId,
        text: "New dialogue line.",
        interruptible: true,
      },
    },
    lineId,
  };
};

export const replaceSelectedDialogueLineCommand = (
  state: DialogueWorkspaceState,
  line: DialogueLine,
): DialogueEditorCommand => {
  if (!state.lineId || line.id !== state.lineId) {
    throw new Error("Select the dialogue line before editing it.");
  }
  return {
    kind: "replace-line",
    nodeId: state.nodeId,
    lineId: state.lineId,
    line,
  };
};

export const removeSelectedDialogueLineCommand = (state: DialogueWorkspaceState): DialogueEditorCommand => {
  if (!state.lineId) {
    throw new Error("Select a dialogue line before removing it.");
  }
  return {
    kind: "remove-line",
    nodeId: state.nodeId,
    lineId: state.lineId,
  };
};

export const insertDialogueChoiceCommand = (
  state: DialogueWorkspaceState,
): {
  readonly command: DialogueEditorCommand;
  readonly choiceId: Id<"dialogue-choice">;
} => {
  const graph = dialogueGraph(state);
  const node = selectedDialogueNode(state);
  const choiceId = asId<"dialogue-choice">(uniqueId(graphIds(graph), `dialogue-choice.${node.id}.choice`));
  return {
    command: {
      kind: "insert-choice",
      nodeId: node.id,
      index: node.choices.length,
      choice: {
        id: choiceId,
        text: "New player choice.",
        once: false,
        actions: [],
        closeDialogue: true,
      },
    },
    choiceId,
  };
};

export const replaceSelectedDialogueChoiceCommand = (
  state: DialogueWorkspaceState,
  choice: DialogueChoice,
): DialogueEditorCommand => {
  if (!state.choiceId || choice.id !== state.choiceId) {
    throw new Error("Select the dialogue choice before editing it.");
  }
  return {
    kind: "replace-choice",
    nodeId: state.nodeId,
    choiceId: state.choiceId,
    choice,
  };
};

export const removeSelectedDialogueChoiceCommand = (state: DialogueWorkspaceState): DialogueEditorCommand => {
  if (!state.choiceId) {
    throw new Error("Select a dialogue choice before removing it.");
  }
  return {
    kind: "remove-choice",
    nodeId: state.nodeId,
    choiceId: state.choiceId,
  };
};
