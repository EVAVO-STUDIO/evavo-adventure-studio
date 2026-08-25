import { describe, expect, it } from "vitest";
import {
  advanceInvestigationChapter,
  awardInvestigationObjectives,
  createInvestigationState,
  discoverInvestigationFacts,
  evaluateInvestigationChapter,
  investigationPresenceForChapter,
  useInvestigationResearchSource,
  useInvestigationTopic,
  validateInvestigationManifest,
} from "../src/investigation-kernel.js";
import { openCaseInvestigationProof } from "../src/open-case-investigation-proof.js";

describe("Open Case investigation proof", () => {
  it("keeps the witness question hidden until a traceable lab result unlocks it", () => {
    let state = createInvestigationState(openCaseInvestigationProof);
    expect(state.availableTopicIds).not.toContain("topic.open-case.window-condition");

    state = discoverInvestigationFacts(
      openCaseInvestigationProof,
      state,
      ["fact.open-case.custody-logged"],
      {
        kind: "evidence",
        sourceId: "interaction.open-case.log-custody",
        chapterId: state.chapterId,
      },
    );
    state = useInvestigationResearchSource(
      openCaseInvestigationProof,
      state,
      "source.open-case.lab-report",
    );
    expect(state.discoveredFactIds).toContain("fact.open-case.lab-window-match");
    expect(state.availableTopicIds).toContain("topic.open-case.window-condition");
    expect(state.discovery["fact.open-case.lab-window-match"]?.[0]).toMatchObject({
      kind: "research",
      sourceId: "source.open-case.lab-report",
    });
  });

  it("records the contradiction as dialogue provenance rather than an arbitrary flag", () => {
    let state = createInvestigationState(openCaseInvestigationProof);
    state = discoverInvestigationFacts(
      openCaseInvestigationProof,
      state,
      ["fact.open-case.custody-logged"],
      { kind: "evidence", sourceId: "interaction.open-case.log-custody", chapterId: state.chapterId },
    );
    state = useInvestigationResearchSource(openCaseInvestigationProof, state, "source.open-case.lab-report");
    state = useInvestigationTopic(
      openCaseInvestigationProof,
      state,
      "topic.open-case.window-condition",
      "actor.open-case.witness",
    );
    expect(state.discoveredFactIds).toContain("fact.open-case.witness-contradiction");
    expect(state.usedTopicIds).toContain("topic.open-case.window-condition");
    expect(state.discovery["fact.open-case.witness-contradiction"]?.[0]).toMatchObject({
      kind: "dialogue",
      sourceId: "actor.open-case.witness",
    });
  });

  it("requires documentation, custody, evidence-led testimony and caseboard correlation before advancing", () => {
    let state = createInvestigationState(openCaseInvestigationProof);
    state = discoverInvestigationFacts(
      openCaseInvestigationProof,
      state,
      ["fact.open-case.fragment-position", "fact.open-case.custody-logged"],
      { kind: "evidence", sourceId: "scene.open-case.apartment", chapterId: state.chapterId },
    );
    expect(evaluateInvestigationChapter(openCaseInvestigationProof, state).ready).toBe(false);

    state = useInvestigationResearchSource(openCaseInvestigationProof, state, "source.open-case.lab-report");
    state = useInvestigationTopic(
      openCaseInvestigationProof,
      state,
      "topic.open-case.window-condition",
      "actor.open-case.witness",
    );
    state = useInvestigationResearchSource(openCaseInvestigationProof, state, "source.open-case.caseboard");
    state = awardInvestigationObjectives(openCaseInvestigationProof, state);
    const readiness = evaluateInvestigationChapter(openCaseInvestigationProof, state);
    expect(readiness.ready).toBe(true);
    expect(readiness.completedRequiredObjectiveIds).toHaveLength(4);
    expect(state.score).toBe(14);

    state = advanceInvestigationChapter(openCaseInvestigationProof, state);
    expect(state.chapterId).toBe("chapter.open-case.case-two");
    expect(investigationPresenceForChapter(openCaseInvestigationProof, state.chapterId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "presence.open-case.witness.case-two",
          present: false,
        }),
      ]),
    );
  });

  it("keeps the authored investigation graph structurally valid", () => {
    expect(validateInvestigationManifest(openCaseInvestigationProof)).toEqual([]);
  });
});
