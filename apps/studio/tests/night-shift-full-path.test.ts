import { createInitialState, runInteraction } from "@evavo/adventure-core";
import { describe, expect, it } from "vitest";
import {
  nightShiftCompleteInstances,
  nightShiftCompleteProject,
} from "../src/night-shift-complete-proof.js";

const interaction = (definitionId: string, stateId: string, interactionId: string) => {
  const definition = nightShiftCompleteInstances.objectDefinitions.find(
    (candidate) => candidate.id === definitionId,
  );
  const state = definition?.states.find((candidate) => candidate.id === stateId);
  const resolved = state?.interactions.find((candidate) => candidate.id === interactionId);
  if (!resolved) throw new Error(`Missing interaction '${interactionId}'.`);
  return resolved;
};

const successPath = [
  ["object-definition.night-shift.briefing", "object-state.night-shift.briefing.unread", "interaction.night-shift.briefing.read"],
  ["object-definition.night-shift.radio", "object-state.night-shift.radio.rack", "interaction.night-shift.radio.take"],
  ["object-definition.night-shift.keys", "object-state.night-shift.keys.hook", "interaction.night-shift.keys.take"],
  ["object-definition.night-shift.station-door", "object-state.night-shift.station-door.closed", "interaction.night-shift.station-door.leave-ready"],
  ["object-definition.night-shift.sedan", "object-state.night-shift.sedan.stopped", "interaction.night-shift.sedan.observe"],
  ["object-definition.night-shift.sedan", "object-state.night-shift.sedan.stopped", "interaction.night-shift.sedan.talk-after-observe"],
  ["object-definition.night-shift.sedan", "object-state.night-shift.sedan.stopped", "interaction.night-shift.sedan.resolve-safe"],
  ["object-definition.night-shift.diner-server", "object-state.night-shift.diner-server.waiting", "interaction.night-shift.diner-server.ask-van"],
  ["object-definition.night-shift.receipt", "object-state.night-shift.receipt.visible", "interaction.night-shift.receipt.inspect-after-talk"],
  ["object-definition.night-shift.diner-exit", "object-state.night-shift.diner-exit.closed", "interaction.night-shift.diner-exit.complete"],
] as const;

describe("Night Shift deterministic complete route", () => {
  it("finishes station, roadside and diner at a stable total score of 32", () => {
    let state = createInitialState(nightShiftCompleteProject);
    for (const [definitionId, stateId, interactionId] of successPath) {
      const result = runInteraction(state, interaction(definitionId, stateId, interactionId));
      if (result.kind !== "accepted") throw new Error(`${interactionId} was rejected.`);
      state = result.transition.state;
    }

    expect(state.score).toBe(32);
    expect(state.awardedScoreIds).toEqual([
      "score-award.night-shift.briefing",
      "score-award.night-shift.radio",
      "score-award.night-shift.keys",
      "score-award.night-shift.ready-exit",
      "score-award.night-shift.observe",
      "score-award.night-shift.contact",
      "score-award.night-shift.resolve",
      "score-award.night-shift.diner-witness",
      "score-award.night-shift.diner-receipt",
      "score-award.night-shift.proof-complete",
    ]);
    expect(state.flags).toMatchObject({
      briefingRead: true,
      radioReady: true,
      keysReady: true,
      vehicleObserved: true,
      driverSpoken: true,
      roadsideResolved: true,
      dinerWitnessSpoken: true,
      dinerReceiptNoted: true,
      nightShiftProofComplete: true,
    });
    expect(state.flags.roadsideFailure ?? false).toBe(false);
  });

  it("never allows repeated one-shot score interactions to inflate the route total", () => {
    let state = createInitialState(nightShiftCompleteProject);
    const briefing = interaction(
      "object-definition.night-shift.briefing",
      "object-state.night-shift.briefing.unread",
      "interaction.night-shift.briefing.read",
    );
    const first = runInteraction(state, briefing);
    if (first.kind !== "accepted") throw new Error("First briefing interaction was rejected.");
    state = first.transition.state;
    const second = runInteraction(state, briefing);
    expect(second).toMatchObject({ kind: "rejected", reason: "already-used" });
    if (second.kind === "rejected") expect(second.state.score).toBe(4);
  });
});
