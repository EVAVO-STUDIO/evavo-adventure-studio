import { describe, expect, it } from "vitest";
import {
  advanceInvestigationChapter,
  awardInvestigationObjectives,
  createInvestigationState,
  evaluateInvestigationChapter,
  investigationPresenceForChapter,
  useInvestigationResearchSource,
  useInvestigationTopic,
  validateInvestigationManifest,
} from "../src/investigation-kernel.js";
import { redLedgerInvestigationProof } from "../src/red-ledger-investigation-proof.js";

describe("investigation knowledge and chapter kernel", () => {
  it("validates the original Red Ledger investigation proof", () => {
    expect(validateInvestigationManifest(redLedgerInvestigationProof)).toEqual([]);
  });

  it("keeps hidden topics unavailable until research or facts reveal them", () => {
    let state = createInvestigationState(redLedgerInvestigationProof);
    expect(state.availableTopicIds).toEqual([]);

    state = useInvestigationResearchSource(
      redLedgerInvestigationProof,
      state,
      "source.red-ledger.freight-book",
    );
    expect(state.discoveredFactIds).toContain("fact.red-ledger.shipping-mark");
    expect(state.availableTopicIds).toContain("topic.red-ledger.shipping-mark");
    expect(state.availableTopicIds).not.toContain("topic.red-ledger.r-vale");

    state = useInvestigationResearchSource(
      redLedgerInvestigationProof,
      state,
      "source.red-ledger.lease-index",
    );
    expect(state.discoveredFactIds).toContain("fact.red-ledger.alias");
    expect(state.availableTopicIds).toContain("topic.red-ledger.r-vale");
  });

  it("records fact provenance from research and dialogue", () => {
    let state = createInvestigationState(redLedgerInvestigationProof);
    state = useInvestigationResearchSource(redLedgerInvestigationProof, state, "source.red-ledger.freight-book");
    state = useInvestigationResearchSource(redLedgerInvestigationProof, state, "source.red-ledger.lease-index");
    state = useInvestigationTopic(redLedgerInvestigationProof, state, "topic.red-ledger.r-vale", "npc.red-ledger.clerk");

    expect(state.discovery["fact.red-ledger.alias"]).toEqual([
      {
        kind: "research",
        sourceId: "source.red-ledger.lease-index",
        chapterId: "chapter.red-ledger.day-1",
      },
    ]);
    expect(state.discovery["fact.red-ledger.witness-contradiction"]).toEqual([
      {
        kind: "dialogue",
        sourceId: "npc.red-ledger.clerk",
        chapterId: "chapter.red-ledger.day-1",
      },
    ]);
  });

  it("blocks chapter advance until every required investigation objective is complete", () => {
    let state = createInvestigationState(redLedgerInvestigationProof);
    expect(evaluateInvestigationChapter(redLedgerInvestigationProof, state)).toMatchObject({
      ready: false,
      missingRequiredObjectiveIds: [
        "objective.red-ledger.trace-alias",
        "objective.red-ledger.challenge-clerk",
      ],
    });
    expect(advanceInvestigationChapter(redLedgerInvestigationProof, state).chapterId).toBe(
      "chapter.red-ledger.day-1",
    );

    state = useInvestigationResearchSource(redLedgerInvestigationProof, state, "source.red-ledger.freight-book");
    state = useInvestigationResearchSource(redLedgerInvestigationProof, state, "source.red-ledger.lease-index");
    state = awardInvestigationObjectives(redLedgerInvestigationProof, state);
    expect(state.score).toBe(4);
    expect(evaluateInvestigationChapter(redLedgerInvestigationProof, state).ready).toBe(false);

    state = useInvestigationTopic(redLedgerInvestigationProof, state, "topic.red-ledger.r-vale", "npc.red-ledger.clerk");
    state = awardInvestigationObjectives(redLedgerInvestigationProof, state);
    expect(state.score).toBe(9);
    expect(evaluateInvestigationChapter(redLedgerInvestigationProof, state).ready).toBe(true);
    expect(advanceInvestigationChapter(redLedgerInvestigationProof, state).chapterId).toBe(
      "chapter.red-ledger.day-2",
    );
  });

  it("keeps optional investigation scoring separate and one-shot", () => {
    let state = createInvestigationState(redLedgerInvestigationProof);
    state = useInvestigationResearchSource(redLedgerInvestigationProof, state, "source.red-ledger.photo-box");
    state = awardInvestigationObjectives(redLedgerInvestigationProof, state);
    expect(state.score).toBe(2);
    expect(evaluateInvestigationChapter(redLedgerInvestigationProof, state)).toMatchObject({
      ready: false,
      completedOptionalObjectiveIds: ["objective.red-ledger.inspect-photo"],
    });
    expect(awardInvestigationObjectives(redLedgerInvestigationProof, state).score).toBe(2);
  });

  it("changes authored NPC/location presence by chapter without ad-hoc day flags", () => {
    expect(investigationPresenceForChapter(redLedgerInvestigationProof, "chapter.red-ledger.day-1")).toEqual([
      expect.objectContaining({ id: "presence.red-ledger.clerk.day-1", present: true, state: "guarded" }),
    ]);
    expect(investigationPresenceForChapter(redLedgerInvestigationProof, "chapter.red-ledger.day-2")).toEqual([
      expect.objectContaining({ id: "presence.red-ledger.clerk.day-2", present: false }),
      expect.objectContaining({ id: "presence.red-ledger.loading-yard.day-2", present: true, state: "open" }),
    ]);
  });
});
