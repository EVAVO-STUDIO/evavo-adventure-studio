import { createInitialState, evaluateCondition, runInteraction } from "@evavo/adventure-core";
import { describe, expect, it } from "vitest";
import {
  nightShiftCompleteInstances,
  nightShiftCompleteProject,
} from "../src/night-shift-complete-proof.js";
import { nightShiftLifecycle } from "../src/night-shift-lifecycle.js";

const interaction = (definitionId: string, stateId: string, interactionId: string) => {
  const definition = nightShiftCompleteInstances.objectDefinitions.find(
    (candidate) => candidate.id === definitionId,
  );
  const state = definition?.states.find((candidate) => candidate.id === stateId);
  const result = state?.interactions.find((candidate) => candidate.id === interactionId);
  if (!result) throw new Error(`Missing interaction '${interactionId}'.`);
  return result;
};

const activeOutcome = (state: ReturnType<typeof createInitialState>) =>
  [...nightShiftLifecycle.outcomes]
    .filter((outcome) => evaluateCondition(outcome.when, state))
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))[0] ?? null;

describe("Night Shift lifecycle", () => {
  it("activates a bounded quick-retry failure after an unsafe roadside action", () => {
    let state = createInitialState(nightShiftCompleteProject);
    const result = runInteraction(
      state,
      interaction(
        "object-definition.night-shift.sedan",
        "object-state.night-shift.sedan.stopped",
        "interaction.night-shift.sedan.unsafe-action",
      ),
    );
    if (result.kind !== "accepted") throw new Error("Unsafe action was rejected.");
    state = result.transition.state;
    expect(activeOutcome(state)).toMatchObject({
      id: "outcome.night-shift.roadside-failure",
      kind: "failure",
      menu: {
        allowQuickRetry: true,
        allowLoad: true,
        allowRestart: true,
        allowTitle: true,
      },
    });
  });

  it("activates success after the diner witness and receipt proof are completed", () => {
    let state = createInitialState(nightShiftCompleteProject);
    for (const [definitionId, stateId, interactionId] of [
      [
        "object-definition.night-shift.diner-server",
        "object-state.night-shift.diner-server.waiting",
        "interaction.night-shift.diner-server.ask-van",
      ],
      [
        "object-definition.night-shift.receipt",
        "object-state.night-shift.receipt.visible",
        "interaction.night-shift.receipt.inspect-after-talk",
      ],
      [
        "object-definition.night-shift.diner-exit",
        "object-state.night-shift.diner-exit.closed",
        "interaction.night-shift.diner-exit.complete",
      ],
    ] as const) {
      const result = runInteraction(state, interaction(definitionId, stateId, interactionId));
      if (result.kind !== "accepted") throw new Error(`${interactionId} was rejected.`);
      state = result.transition.state;
    }
    expect(activeOutcome(state)).toMatchObject({
      id: "outcome.night-shift.proof-complete",
      kind: "success",
      menu: { allowQuickRetry: false, allowLoad: true, allowRestart: true, allowTitle: true },
    });
  });

  it("keeps failure dominant if conflicting terminal flags ever coexist", () => {
    const state = {
      ...createInitialState(nightShiftCompleteProject),
      flags: {
        roadsideFailure: true,
        nightShiftProofComplete: true,
      },
    };
    expect(activeOutcome(state)?.id).toBe("outcome.night-shift.roadside-failure");
  });
});
