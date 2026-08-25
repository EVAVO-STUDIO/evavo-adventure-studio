import { describe, expect, it } from "vitest";
import {
  analyseOpenCaseFragment,
  askOpenCaseWitnessAboutWindow,
  bagOpenCaseFragment,
  collectOpenCaseFragment,
  createOpenCaseGameplayState,
  enterProtectedScene,
  logOpenCaseCustody,
  OPEN_CASE_MAX_SCORE,
  observeOpenCaseFragment,
  openCaseProofComplete,
  photographOpenCaseFragment,
  reviewOpenCaseBoard,
  signOpenCaseEntryLog,
} from "../src/open-case-gameplay-proof.js";

describe("Open Case late-Sierra procedural proof", () => {
  it("explains and recovers from invalid procedure without destroying unrelated case state", () => {
    let state = createOpenCaseGameplayState();
    const boundary = enterProtectedScene(state);
    expect(boundary.failure?.id).toBe("entry-before-log");
    state = boundary.state;

    state = signOpenCaseEntryLog(state).state;
    state = observeOpenCaseFragment(state).state;
    const badCollection = collectOpenCaseFragment(state);
    expect(badCollection.failure?.id).toBe("collect-before-photo");
    expect(badCollection.feedback).toMatch(/original position.*photographed/iu);
    expect(badCollection.state.entryLogSigned).toBe(true);
    expect(badCollection.state.evidenceState).toBe("observed");

    state = photographOpenCaseFragment(badCollection.state).state;
    state = collectOpenCaseFragment(state).state;
    expect(state.evidenceState).toBe("collected");
    expect(state.failureCount).toBe(2);
  });

  it("preserves a traceable evidence chain through analysis", () => {
    let state = createOpenCaseGameplayState();
    state = signOpenCaseEntryLog(state).state;
    state = photographOpenCaseFragment(state).state;
    state = collectOpenCaseFragment(state).state;
    state = bagOpenCaseFragment(state).state;
    expect(state.custodySealed).toBe(true);
    state = logOpenCaseCustody(state).state;
    expect(state.evidenceState).toBe("logged");
    state = analyseOpenCaseFragment(state).state;
    expect(state.evidenceState).toBe("analysed");
    expect(state.witnessQuestionUnlocked).toBe(true);
    expect(state.labRouteOpen).toBe(true);
  });

  it("does not expose the contradiction question before evidence earns it", () => {
    const blocked = askOpenCaseWitnessAboutWindow(createOpenCaseGameplayState());
    expect(blocked.failure?.id).toBe("ask-before-evidence");
    expect(blocked.state.contradictionEstablished).toBe(false);
  });

  it("completes the evidence-led interview and opens location progression without a quest objective", () => {
    let state = createOpenCaseGameplayState();
    state = signOpenCaseEntryLog(state).state;
    state = photographOpenCaseFragment(state).state;
    state = collectOpenCaseFragment(state).state;
    state = bagOpenCaseFragment(state).state;
    state = logOpenCaseCustody(state).state;
    state = analyseOpenCaseFragment(state).state;
    state = askOpenCaseWitnessAboutWindow(state).state;
    expect(state.contradictionEstablished).toBe(true);
    state = reviewOpenCaseBoard(state).state;
    expect(state.nextLocationOpen).toBe(true);
    expect(openCaseProofComplete(state)).toBe(true);
    expect(state.score).toBe(OPEN_CASE_MAX_SCORE);
  });

  it("keeps one-shot score stable when completed actions are revisited", () => {
    let state = createOpenCaseGameplayState();
    state = signOpenCaseEntryLog(state).state;
    state = signOpenCaseEntryLog(state).state;
    state = photographOpenCaseFragment(state).state;
    state = photographOpenCaseFragment(state).state;
    expect(state.score).toBe(5);
    expect(state.awardedScoreIds).toHaveLength(2);
  });
});
