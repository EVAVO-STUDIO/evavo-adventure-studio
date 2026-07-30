import type { RuntimeEvent, RuntimeState } from "@evavo/adventure-core";
import {
  beginDialogue,
  chooseDialogueOption,
  resolveDialogueView,
  type DialogueOperation,
  type DialogueView,
} from "@evavo/adventure-dialogue";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";

export interface DialogueRuntimeWorld {
  readonly story: RuntimeState;
}

export type DialogueRuntimeRejectionReason =
  | "dialogue-not-active"
  | "dialogue-missing"
  | "choice-rejected";

export type DialogueChoiceResult<T extends DialogueRuntimeWorld> =
  | {
      readonly kind: "active";
      readonly state: T;
      readonly view: DialogueView;
      readonly events: readonly RuntimeEvent[];
    }
  | {
      readonly kind: "ended";
      readonly state: T;
      readonly events: readonly RuntimeEvent[];
    }
  | {
      readonly kind: "rejected";
      readonly reason: DialogueRuntimeRejectionReason;
      readonly detail: string;
      readonly state: T;
    };

const graphById = (
  bundle: Pick<RuntimeBundle, "dialogues">,
  dialogueId: Id<"dialogue">,
) => bundle.dialogues.find((dialogue) => dialogue.id === dialogueId) ?? null;

const withStory = <T extends DialogueRuntimeWorld>(
  state: T,
  story: RuntimeState,
): T => ({ ...state, story });

const applyOperation = <T extends DialogueRuntimeWorld>(
  state: T,
  operation: DialogueOperation,
): DialogueChoiceResult<T> => {
  if (operation.kind === "rejected") {
    return {
      kind: "rejected",
      reason: "choice-rejected",
      detail: operation.reason,
      state,
    };
  }
  if (operation.kind === "ended") {
    return {
      kind: "ended",
      state: withStory(state, operation.transition.state),
      events: operation.transition.events,
    };
  }
  return {
    kind: "active",
    state: withStory(state, operation.transition.state),
    view: operation.view,
    events: operation.transition.events,
  };
};

export const resolveActiveRuntimeDialogue = (
  bundle: Pick<RuntimeBundle, "dialogues">,
  state: DialogueRuntimeWorld,
): DialogueView | null => {
  const active = state.story.activeDialogue;
  if (!active) return null;
  const graph = graphById(bundle, active.dialogueId);
  return graph
    ? resolveDialogueView(state.story, graph, active.nodeId)
    : null;
};

export const applyDialogueRequestEvents = <T extends DialogueRuntimeWorld>(
  bundle: Pick<RuntimeBundle, "dialogues">,
  state: T,
  events: readonly RuntimeEvent[],
): {
  readonly state: T;
  readonly events: readonly RuntimeEvent[];
  readonly view: DialogueView | null;
} => {
  let nextState = state;
  const emitted: RuntimeEvent[] = [...events];
  let view = resolveActiveRuntimeDialogue(bundle, nextState);

  for (const event of events) {
    if (event.kind !== "dialogue-requested") continue;
    const graph = graphById(bundle, event.dialogueId);
    if (!graph) continue;
    const operation = beginDialogue(nextState.story, graph, event.nodeId);
    if (operation.kind === "rejected") continue;
    nextState = withStory(nextState, operation.transition.state);
    emitted.push(...operation.transition.events);
    view = operation.kind === "active" ? operation.view : null;
  }

  return { state: nextState, events: emitted, view };
};

export const chooseActiveRuntimeDialogueOption = <
  T extends DialogueRuntimeWorld,
>(
  bundle: Pick<RuntimeBundle, "dialogues">,
  state: T,
  choiceId: Id<"dialogue-choice">,
): DialogueChoiceResult<T> => {
  const active = state.story.activeDialogue;
  if (!active) {
    return {
      kind: "rejected",
      reason: "dialogue-not-active",
      detail: "dialogue-not-active",
      state,
    };
  }
  const graph = graphById(bundle, active.dialogueId);
  if (!graph) {
    return {
      kind: "rejected",
      reason: "dialogue-missing",
      detail: active.dialogueId,
      state,
    };
  }
  return applyOperation(
    state,
    chooseDialogueOption(state.story, graph, choiceId),
  );
};
