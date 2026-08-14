import { evaluateCondition, type RuntimeState } from "@evavo/adventure-core";
import type { GameLifecycleOutcome } from "@evavo/adventure-project-schema/lifecycle";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";

export const resolveActiveGameLifecycleOutcome = (
  bundle: RuntimeBundle,
  story: RuntimeState,
): GameLifecycleOutcome | null => {
  if (!bundle.lifecycle || bundle.lifecycle.projectId !== story.projectId) return null;
  const matches = bundle.lifecycle.outcomes.filter((outcome) => evaluateCondition(outcome.when, story));
  matches.sort((left, right) => {
    const priority = right.priority - left.priority;
    return priority !== 0 ? priority : left.id.localeCompare(right.id);
  });
  return matches[0] ?? null;
};