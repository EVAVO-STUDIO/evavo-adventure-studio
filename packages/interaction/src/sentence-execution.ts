import type { RuntimeState } from "@evavo/adventure-core";
import type { Id } from "@evavo/adventure-project-schema";
import {
  createItemCombinationRuntimeState,
  resolveItemCombination,
  type ItemCombinationManifest,
  type ItemCombinationResult,
  type ItemCombinationRuntimeState,
} from "./item-combinations.js";
import {
  resolveSentenceIntent,
  type SentenceGrammar,
  type SentenceState,
} from "./sentence.js";

export type SentenceExecutionResult =
  | {
      readonly kind: "incomplete";
      readonly text: string;
      readonly sentence: SentenceState;
      readonly combinations: ItemCombinationRuntimeState;
      readonly story: RuntimeState;
    }
  | {
      readonly kind: "invalid";
      readonly text: string;
      readonly reason: string;
      readonly sentence: SentenceState;
      readonly combinations: ItemCombinationRuntimeState;
      readonly story: RuntimeState;
    }
  | {
      readonly kind: "room-command";
      readonly text: string;
      readonly verb: string;
      readonly objectInstanceId: Id<"object">;
      readonly itemId: Id<"item"> | null;
      readonly sentence: SentenceState;
      readonly combinations: ItemCombinationRuntimeState;
      readonly story: RuntimeState;
    }
  | {
      readonly kind: "item-combination";
      readonly text: string;
      readonly sentence: SentenceState;
      readonly result: ItemCombinationResult;
      readonly combinations: ItemCombinationRuntimeState;
      readonly story: RuntimeState;
    };

export const executeSentenceIntent = (
  grammar: SentenceGrammar,
  sentence: SentenceState,
  story: RuntimeState,
  combinationManifest: ItemCombinationManifest,
  combinations: ItemCombinationRuntimeState = createItemCombinationRuntimeState(),
): SentenceExecutionResult => {
  const intent = resolveSentenceIntent(grammar, sentence);
  switch (intent.kind) {
    case "incomplete":
      return {
        kind: "incomplete",
        text: intent.text,
        sentence,
        story,
        combinations,
      };
    case "invalid":
      return {
        kind: "invalid",
        text: intent.text,
        reason: intent.reason,
        sentence,
        story,
        combinations,
      };
    case "room-command":
      return {
        kind: "room-command",
        text: intent.text,
        verb: intent.verb,
        objectInstanceId: intent.objectInstanceId,
        itemId: intent.itemId,
        sentence,
        story,
        combinations,
      };
    case "item-combination": {
      const result = resolveItemCombination(combinationManifest, story, combinations, {
        verb: intent.verb,
        primaryItemId: intent.primaryItemId,
        secondaryItemId: intent.secondaryItemId,
      });
      return {
        kind: "item-combination",
        text: intent.text,
        sentence,
        result,
        story: result.story,
        combinations: result.combinations,
      };
    }
  }
};
