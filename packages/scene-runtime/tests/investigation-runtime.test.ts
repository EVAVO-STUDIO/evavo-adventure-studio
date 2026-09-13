import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  advanceRuntimeInvestigationChapter,
  awardRuntimeInvestigationObjectives,
  createRuntimeInvestigationState,
  evaluateRuntimeInvestigationChapter,
  runtimeInvestigationPresence,
  useRuntimeInvestigationResearchSource,
  useRuntimeInvestigationTopic,
} from "../src/investigation-runtime.js";

const bundle = {
  projectId: "project.investigation-runtime",
  investigation: {
    manifestVersion: 1,
    projectId: "project.investigation-runtime",
    facts: [
      {
        id: "fact.case.mark",
        label: "Mark",
        description: "Repeated freight mark.",
        unlockTopicIds: ["topic.case.mark"],
      },
      {
        id: "fact.case.alias",
        label: "Alias",
        description: "Archive alias.",
        unlockTopicIds: ["topic.case.alias"],
      },
      {
        id: "fact.case.contradiction",
        label: "Contradiction",
        description: "Witness contradiction.",
      },
    ],
    topics: [
      { id: "topic.case.mark", label: "Mark", oneShot: true },
      {
        id: "topic.case.alias",
        label: "Alias",
        requiresFactIds: ["fact.case.alias"],
        revealFactIds: ["fact.case.contradiction"],
        oneShot: true,
      },
    ],
    researchSources: [
      {
        id: "source.case.registry",
        label: "Registry",
        availableChapterIds: ["chapter.case.day-1"],
        revealFactIds: ["fact.case.mark"],
        oneShot: true,
      },
      {
        id: "source.case.lease",
        label: "Lease",
        availableChapterIds: ["chapter.case.day-1"],
        requiresFactIds: ["fact.case.mark"],
        revealFactIds: ["fact.case.alias"],
        oneShot: true,
      },
    ],
    chapters: [
      {
        id: "chapter.case.day-1",
        label: "Day One",
        order: 1,
        nextChapterId: "chapter.case.day-2",
        objectives: [
          {
            id: "objective.case.lease",
            label: "Trace the alias",
            required: true,
            score: 4,
            requirements: [
              { kind: "source-used", sourceId: "source.case.lease" },
              { kind: "fact", factId: "fact.case.alias" },
            ],
          },
          {
            id: "objective.case.contradiction",
            label: "Challenge the witness",
            required: true,
            score: 5,
            requirements: [
              { kind: "topic-used", topicId: "topic.case.alias" },
              { kind: "fact", factId: "fact.case.contradiction" },
            ],
          },
        ],
      },
      { id: "chapter.case.day-2", label: "Day Two", order: 2, objectives: [] },
    ],
    presenceVariants: [
      {
        id: "presence.case.witness.day-1",
        chapterIds: ["chapter.case.day-1"],
        locationId: "location.case.archive",
        present: true,
        state: "guarded",
      },
      {
        id: "presence.case.witness.day-2",
        chapterIds: ["chapter.case.day-2"],
        locationId: "location.case.archive",
        present: false,
      },
    ],
  },
} as unknown as RuntimeBundle;

describe("packaged investigation runtime", () => {
  it("returns null for bundles without an investigation sidecar", () => {
    expect(createRuntimeInvestigationState({ projectId: "project.plain" } as RuntimeBundle)).toBeNull();
  });

  it("executes the research/topic/day chain deterministically", () => {
    let state = createRuntimeInvestigationState(bundle);
    if (!state) throw new Error("Expected investigation state.");
    expect(state.chapterId).toBe("chapter.case.day-1");
    expect(state.availableTopicIds).toEqual([]);

    state = useRuntimeInvestigationResearchSource(bundle, state, "source.case.registry");
    expect(state.discoveredFactIds).toContain("fact.case.mark");
    expect(state.availableTopicIds).toContain("topic.case.mark");

    state = useRuntimeInvestigationResearchSource(bundle, state, "source.case.lease");
    state = awardRuntimeInvestigationObjectives(bundle, state);
    expect(state.score).toBe(4);
    expect(state.availableTopicIds).toContain("topic.case.alias");
    expect(evaluateRuntimeInvestigationChapter(bundle, state).ready).toBe(false);

    state = useRuntimeInvestigationTopic(bundle, state, "topic.case.alias", "npc.case.witness");
    state = awardRuntimeInvestigationObjectives(bundle, state);
    expect(state.score).toBe(9);
    expect(state.discovery["fact.case.contradiction"]).toEqual([
      {
        kind: "dialogue",
        sourceId: "npc.case.witness",
        chapterId: "chapter.case.day-1",
      },
    ]);
    expect(evaluateRuntimeInvestigationChapter(bundle, state).ready).toBe(true);

    state = advanceRuntimeInvestigationChapter(bundle, state);
    expect(state.chapterId).toBe("chapter.case.day-2");
    expect(runtimeInvestigationPresence(bundle, state)).toEqual([
      expect.objectContaining({ id: "presence.case.witness.day-2", present: false }),
    ]);
  });

  it("keeps one-shot source and topic operations idempotent", () => {
    let state = createRuntimeInvestigationState(bundle)!;
    state = useRuntimeInvestigationResearchSource(bundle, state, "source.case.registry");
    const afterSource = state;
    state = useRuntimeInvestigationResearchSource(bundle, state, "source.case.registry");
    expect(state).toEqual(afterSource);

    state = useRuntimeInvestigationResearchSource(bundle, state, "source.case.lease");
    state = useRuntimeInvestigationTopic(bundle, state, "topic.case.alias", "npc.case.witness");
    const afterTopic = state;
    state = useRuntimeInvestigationTopic(bundle, state, "topic.case.alias", "npc.case.witness");
    expect(state).toEqual(afterTopic);
  });
});
