import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import { addSaveGameIssue, type SaveGameCompatibilityIssue, SaveGamePolicyError } from "./errors.js";

export const activeSequencePolicyIssues = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
): readonly SaveGameCompatibilityIssue[] => {
  const issues: SaveGameCompatibilityIssue[] = [];
  world.story.activeSequences.forEach((active, index) => {
    const sequence = bundle.sequences.find((candidate) => candidate.id === active.sequenceId);
    if (!sequence) {
      addSaveGameIssue(
        issues,
        "missing-active-sequence",
        `world.story.activeSequences[${index}].sequenceId`,
        `Active sequence '${active.sequenceId}' is missing from the runtime bundle.`,
      );
      return;
    }
    if (sequence.savePolicy === "disabled") {
      addSaveGameIssue(
        issues,
        "sequence-save-disabled",
        `world.story.activeSequences[${index}]`,
        `Sequence '${sequence.id}' disables saving while it is active.`,
      );
    } else if (sequence.savePolicy === "boundary-only" && active.elapsedTicks > 0) {
      addSaveGameIssue(
        issues,
        "sequence-boundary-required",
        `world.story.activeSequences[${index}].elapsedTicks`,
        `Sequence '${sequence.id}' permits saving only at a sequence boundary.`,
      );
    }
  });
  return issues;
};

export const assertSaveGameAllowed = (bundle: RuntimeBundle, world: InteractiveRuntimeWorldState): void => {
  const issues = activeSequencePolicyIssues(bundle, world);
  if (issues.length > 0) throw new SaveGamePolicyError(issues);
};
