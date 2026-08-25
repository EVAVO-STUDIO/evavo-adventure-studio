import { describe, expect, it } from "vitest";
import {
  coldMeridianProofComplete,
  compareColdMeridianRecordings,
  createColdMeridianGameplayState,
  discoverColdMeridianFact,
  exchangeColdMeridianFact,
  failColdMeridianActionInsert,
  resolveColdMeridianActionInsert,
  retryColdMeridianActionInsert,
  startColdMeridianActionInsert,
  switchColdMeridianProtagonist,
  triggerColdMeridianHardCutaway,
  chooseColdMeridianWrongInference,
} from "../src/cold-meridian-gameplay-proof.js";

describe("Cold Meridian modern-retro noir proof", () => {
  it("keeps protagonist knowledge separate until an authored exchange", () => {
    let state = createColdMeridianGameplayState();
    state = discoverColdMeridianFact(state, "technician-a", "fact.signal.badge-number").state;
    expect(state.knowledge["technician-a"]).toContain("fact.signal.badge-number");
    expect(state.knowledge["technician-b"]).not.toContain("fact.signal.badge-number");
    expect(state.knowledge.shared).not.toContain("fact.signal.badge-number");

    state = exchangeColdMeridianFact(
      state,
      "technician-a",
      "technician-b",
      "fact.signal.badge-number",
    ).state;
    expect(state.knowledge["technician-b"]).toContain("fact.signal.badge-number");
    expect(state.knowledge.shared).toContain("fact.signal.badge-number");
  });

  it("requires both technicians' signal observations before unlocking the relay route", () => {
    let state = createColdMeridianGameplayState();
    state = discoverColdMeridianFact(state, "technician-a", "fact.signal.badge-number").state;
    state = exchangeColdMeridianFact(state, "technician-a", "technician-b", "fact.signal.badge-number").state;
    expect(compareColdMeridianRecordings(state).state.relayRouteUnlocked).toBe(false);

    state = switchColdMeridianProtagonist(state, "technician-b").state;
    state = discoverColdMeridianFact(state, "technician-b", "fact.signal.prediction-offset").state;
    state = exchangeColdMeridianFact(state, "technician-b", "technician-a", "fact.signal.prediction-offset").state;
    state = compareColdMeridianRecordings(state).state;
    expect(state.recordingsCompared).toBe(true);
    expect(state.predictionOffsetKnown).toBe(true);
    expect(state.relayRouteUnlocked).toBe(true);
  });

  it("turns a plausible wrong inference into a changed recoverable state with new evidence", () => {
    let state = createColdMeridianGameplayState();
    state = discoverColdMeridianFact(state, "technician-a", "fact.signal.badge-number").state;
    state = discoverColdMeridianFact(state, "technician-b", "fact.signal.prediction-offset").state;
    state = exchangeColdMeridianFact(state, "technician-a", "technician-b", "fact.signal.badge-number").state;
    state = exchangeColdMeridianFact(state, "technician-b", "technician-a", "fact.signal.prediction-offset").state;
    state = compareColdMeridianRecordings(state).state;
    state = chooseColdMeridianWrongInference(state).state;
    expect(state.lateArrival).toBe(true);
    expect(state.knowledge[state.activeProtagonist]).toContain(
      "fact.late-arrival.secondary-vehicle",
    );
    expect(state.relayRouteUnlocked).toBe(true);
  });

  it("uses a bounded action failure and retry without resetting investigation state", () => {
    let state = createColdMeridianGameplayState();
    state = discoverColdMeridianFact(state, "technician-a", "fact.signal.badge-number").state;
    state = discoverColdMeridianFact(state, "technician-b", "fact.signal.prediction-offset").state;
    state = exchangeColdMeridianFact(state, "technician-a", "technician-b", "fact.signal.badge-number").state;
    state = exchangeColdMeridianFact(state, "technician-b", "technician-a", "fact.signal.prediction-offset").state;
    state = compareColdMeridianRecordings(state).state;
    state = startColdMeridianActionInsert(state).state;
    expect(state.retryCheckpointAvailable).toBe(true);
    state = failColdMeridianActionInsert(state).state;
    expect(state.actionState).toBe("failed");
    expect(state.failureCount).toBe(1);
    state = retryColdMeridianActionInsert(state).state;
    expect(state.actionState).toBe("active");
    expect(state.knowledge.shared).toEqual(
      expect.arrayContaining(["fact.signal.badge-number", "fact.signal.prediction-offset"]),
    );
    state = resolveColdMeridianActionInsert(state).state;
    expect(state.actionState).toBe("resolved");
    expect(state.retryCheckpointAvailable).toBe(false);
  });

  it("completes through shared evidence, hard cutaway and resolved action insert", () => {
    let state = createColdMeridianGameplayState();
    state = discoverColdMeridianFact(state, "technician-a", "fact.signal.badge-number").state;
    state = discoverColdMeridianFact(state, "technician-b", "fact.signal.prediction-offset").state;
    state = exchangeColdMeridianFact(state, "technician-a", "technician-b", "fact.signal.badge-number").state;
    state = exchangeColdMeridianFact(state, "technician-b", "technician-a", "fact.signal.prediction-offset").state;
    state = compareColdMeridianRecordings(state).state;
    state = triggerColdMeridianHardCutaway(state).state;
    state = startColdMeridianActionInsert(state).state;
    state = resolveColdMeridianActionInsert(state).state;
    expect(coldMeridianProofComplete(state)).toBe(true);
  });
});
