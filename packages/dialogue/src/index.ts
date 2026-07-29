import {
  applyActions,
  evaluateCondition,
  type RuntimeEvent,
  type RuntimeState,
  type RuntimeTransition,
} from "@evavo/adventure-core";
import type {
  DialogueChoice,
  DialogueGraph,
  DialogueLine,
  DialogueNode,
  Id,
} from "@evavo/adventure-project-schema";

export interface ResolvedDialogueChoice {
  readonly id: Id<"dialogue-choice">;
  readonly text: string;
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly exhausted: boolean;
}

export interface DialogueView {
  readonly dialogueId: Id<"dialogue">;
  readonly nodeId: Id<"dialogue-node">;
  readonly lines: readonly DialogueLine[];
  readonly choices: readonly ResolvedDialogueChoice[];
}

export type DialogueRejectionReason =
  | "dialogue-not-active"
  | "wrong-dialogue"
  | "unknown-node"
  | "unknown-choice"
  | "choice-hidden"
  | "choice-disabled"
  | "choice-exhausted";

export type DialogueOperation =
  | {
      readonly kind: "active";
      readonly transition: RuntimeTransition;
      readonly view: DialogueView;
    }
  | {
      readonly kind: "ended";
      readonly transition: RuntimeTransition;
    }
  | {
      readonly kind: "rejected";
      readonly reason: DialogueRejectionReason;
      readonly state: RuntimeState;
    };

const findNode = (
  graph: DialogueGraph,
  nodeId: Id<"dialogue-node">,
): DialogueNode | undefined => graph.nodes.find((node) => node.id === nodeId);

const resolveChoice = (
  state: RuntimeState,
  choice: DialogueChoice,
): ResolvedDialogueChoice => {
  const visible = !choice.visibleWhen || evaluateCondition(choice.visibleWhen, state);
  const exhausted =
    choice.once && state.consumedDialogueChoiceIds.includes(choice.id);
  const enabledByCondition =
    !choice.enabledWhen || evaluateCondition(choice.enabledWhen, state);

  return {
    id: choice.id,
    text: choice.text,
    visible,
    enabled: visible && !exhausted && enabledByCondition,
    exhausted,
  };
};

export const resolveDialogueView = (
  state: RuntimeState,
  graph: DialogueGraph,
  nodeId: Id<"dialogue-node">,
): DialogueView | null => {
  const node = findNode(graph, nodeId);
  if (!node) {
    return null;
  }

  return {
    dialogueId: graph.id,
    nodeId: node.id,
    lines: node.lines,
    choices: node.choices.map((choice) => resolveChoice(state, choice)),
  };
};

const enterNode = (
  state: RuntimeState,
  graph: DialogueGraph,
  node: DialogueNode,
  previousEvents: readonly RuntimeEvent[] = [],
): DialogueOperation => {
  const entered = applyActions(state, node.enterActions);
  const activeState: RuntimeState = {
    ...entered.state,
    activeDialogue: { dialogueId: graph.id, nodeId: node.id },
  };
  const view = resolveDialogueView(activeState, graph, node.id);
  if (!view) {
    return { kind: "rejected", reason: "unknown-node", state };
  }

  return {
    kind: "active",
    transition: {
      state: activeState,
      events: [
        ...previousEvents,
        ...entered.events,
        {
          kind: "dialogue-node-entered",
          dialogueId: graph.id,
          nodeId: node.id,
        },
      ],
    },
    view,
  };
};

export const beginDialogue = (
  state: RuntimeState,
  graph: DialogueGraph,
  requestedNodeId: Id<"dialogue-node"> | null = null,
): DialogueOperation => {
  const nodeId = requestedNodeId ?? graph.startNodeId;
  const node = findNode(graph, nodeId);
  return node
    ? enterNode(state, graph, node)
    : { kind: "rejected", reason: "unknown-node", state };
};

export const endDialogue = (
  state: RuntimeState,
  graph: DialogueGraph,
): DialogueOperation => {
  if (!state.activeDialogue) {
    return { kind: "rejected", reason: "dialogue-not-active", state };
  }
  if (state.activeDialogue.dialogueId !== graph.id) {
    return { kind: "rejected", reason: "wrong-dialogue", state };
  }

  return {
    kind: "ended",
    transition: {
      state: { ...state, activeDialogue: null },
      events: [{ kind: "dialogue-ended", dialogueId: graph.id }],
    },
  };
};

export const chooseDialogueOption = (
  state: RuntimeState,
  graph: DialogueGraph,
  choiceId: Id<"dialogue-choice">,
): DialogueOperation => {
  const active = state.activeDialogue;
  if (!active) {
    return { kind: "rejected", reason: "dialogue-not-active", state };
  }
  if (active.dialogueId !== graph.id) {
    return { kind: "rejected", reason: "wrong-dialogue", state };
  }

  const currentNode = findNode(graph, active.nodeId);
  if (!currentNode) {
    return { kind: "rejected", reason: "unknown-node", state };
  }

  const choice = currentNode.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) {
    return { kind: "rejected", reason: "unknown-choice", state };
  }

  const resolved = resolveChoice(state, choice);
  if (!resolved.visible) {
    return { kind: "rejected", reason: "choice-hidden", state };
  }
  if (resolved.exhausted) {
    return { kind: "rejected", reason: "choice-exhausted", state };
  }
  if (!resolved.enabled) {
    return { kind: "rejected", reason: "choice-disabled", state };
  }

  const nextNodeId = choice.nextNodeId ?? currentNode.autoNextNodeId ?? null;
  const nextNode = nextNodeId ? findNode(graph, nextNodeId) : undefined;
  if (!choice.closeDialogue && nextNodeId && !nextNode) {
    return { kind: "rejected", reason: "unknown-node", state };
  }

  const choiceState: RuntimeState = choice.once
    ? {
        ...state,
        consumedDialogueChoiceIds: [...state.consumedDialogueChoiceIds, choice.id],
      }
    : state;
  const choiceTransition = applyActions(choiceState, choice.actions);
  const exitTransition = applyActions(
    choiceTransition.state,
    currentNode.exitActions,
  );
  const events: RuntimeEvent[] = [
    ...choiceTransition.events,
    ...exitTransition.events,
    { kind: "dialogue-choice-completed", choiceId: choice.id },
  ];

  if (choice.closeDialogue || !nextNode) {
    return {
      kind: "ended",
      transition: {
        state: { ...exitTransition.state, activeDialogue: null },
        events: [...events, { kind: "dialogue-ended", dialogueId: graph.id }],
      },
    };
  }

  return enterNode(exitTransition.state, graph, nextNode, events);
};
