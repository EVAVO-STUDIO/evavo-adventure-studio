import type { RuntimeEvent, RuntimeState } from "@evavo/adventure-core";
import {
  chooseDialogueOption,
  type DialogueOperation,
  type DialogueView,
  resolveDialogueView,
} from "@evavo/adventure-dialogue";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { applyRuntimeNarrativeRequestEvents } from "./narrative.js";

export type { DialogueView } from "@evavo/adventure-dialogue";

export interface DialogueRuntimeWorld {
  readonly story: RuntimeState;
}

export type DialogueRuntimeRejectionReason = "dialogue-not-active" | "dialogue-missing" | "choice-rejected";

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

const graphById = (bundle: Pick<RuntimeBundle, "dialogues">, dialogueId: Id<"dialogue">) =>
  bundle.dialogues.find((dialogue) => dialogue.id === dialogueId) ?? null;

const withStory = <T extends DialogueRuntimeWorld>(state: T, story: RuntimeState): T => ({ ...state, story });

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

type DialogueNarrativeBundle = Pick<RuntimeBundle, "dialogues"> & Partial<Pick<RuntimeBundle, "sequences">>;

const narrativeBundle = (
  bundle: DialogueNarrativeBundle,
): Pick<RuntimeBundle, "dialogues" | "sequences"> => ({
  dialogues: bundle.dialogues,
  sequences: bundle.sequences ?? [],
});

const applyNarrativeResult = <T extends DialogueRuntimeWorld>(
  bundle: DialogueNarrativeBundle,
  result: DialogueChoiceResult<T>,
): DialogueChoiceResult<T> => {
  if (result.kind === "rejected") return result;
  const narrative = applyRuntimeNarrativeRequestEvents(narrativeBundle(bundle), result.state, result.events);
  if (result.kind === "ended") {
    return {
      kind: "ended",
      state: narrative.state,
      events: narrative.events,
    };
  }
  const view = resolveActiveRuntimeDialogue(bundle, narrative.state);
  return view
    ? {
        kind: "active",
        state: narrative.state,
        view,
        events: narrative.events,
      }
    : {
        kind: "ended",
        state: narrative.state,
        events: narrative.events,
      };
};

export const resolveActiveRuntimeDialogue = (
  bundle: Pick<RuntimeBundle, "dialogues">,
  state: DialogueRuntimeWorld,
): DialogueView | null => {
  const active = state.story.activeDialogue;
  if (!active) return null;
  const graph = graphById(bundle, active.dialogueId);
  return graph ? resolveDialogueView(state.story, graph, active.nodeId) : null;
};

export const applyDialogueRequestEvents = <T extends DialogueRuntimeWorld>(
  bundle: DialogueNarrativeBundle,
  state: T,
  events: readonly RuntimeEvent[],
): {
  readonly state: T;
  readonly events: readonly RuntimeEvent[];
  readonly view: DialogueView | null;
} => {
  const narrative = applyRuntimeNarrativeRequestEvents(narrativeBundle(bundle), state, events);
  return {
    state: narrative.state,
    events: narrative.events,
    view: resolveActiveRuntimeDialogue(bundle, narrative.state),
  };
};

export const chooseActiveRuntimeDialogueOption = <T extends DialogueRuntimeWorld>(
  bundle: DialogueNarrativeBundle,
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
  return applyNarrativeResult(
    bundle,
    applyOperation(state, chooseDialogueOption(state.story, graph, choiceId)),
  );
};
