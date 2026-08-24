import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "../src/schema.js";
import { describe, expect, it } from "vitest";
import { validateSavedInvestigation } from "../src/investigation-compatibility.js";

const bundle = {
  investigation: {
    manifestVersion: 1,
    projectId: "project.case",
    facts: [{ id: "fact.alias", label: "Alias", description: "Alias." }],
    topics: [{ id: "topic.alias", label: "Alias" }],
    researchSources: [{
      id: "source.registry",
      label: "Registry",
      availableChapterIds: ["chapter.day-1"],
    }],
    chapters: [{
      id: "chapter.day-1",
      label: "Day 1",
      order: 1,
      objectives: [{
        id: "objective.alias",
        label: "Find alias",
        required: true,
        requirements: [{ kind: "fact", factId: "fact.alias" }],
      }],
    }],
  },
} as unknown as RuntimeBundle;

const saveWith = (investigation: SaveGame["investigation"]): SaveGame => ({ investigation } as unknown as SaveGame);

describe("saved investigation compatibility", () => {
  it("allows legacy save payloads that predate investigation state", () => {
    expect(validateSavedInvestigation(bundle, saveWith(undefined))).toEqual([]);
  });

  it("accepts semantic state whose IDs still exist", () => {
    expect(validateSavedInvestigation(bundle, saveWith({
      chapterId: "chapter.day-1",
      discoveredFactIds: ["fact.alias"],
      availableTopicIds: ["topic.alias"],
      usedTopicIds: ["topic.alias"],
      usedSourceIds: ["source.registry"],
      discovery: {
        "fact.alias": [{ kind: "research", sourceId: "source.registry", chapterId: "chapter.day-1" }],
      },
      flags: {},
      score: 1,
      awardedObjectiveIds: ["objective.alias"],
    }))).toEqual([]);
  });

  it("rejects stale semantic IDs instead of silently dropping case state", () => {
    const issues = validateSavedInvestigation(bundle, saveWith({
      chapterId: "chapter.missing",
      discoveredFactIds: ["fact.missing"],
      availableTopicIds: ["topic.missing"],
      usedTopicIds: [],
      usedSourceIds: ["source.missing"],
      discovery: {
        "fact.missing": [{ kind: "event", sourceId: "event.bad", chapterId: "chapter.missing" }],
      },
      flags: {},
      score: 0,
      awardedObjectiveIds: ["objective.missing"],
    }));
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "investigation-chapter-missing" }),
      expect.objectContaining({ code: "investigation-fact-missing" }),
      expect.objectContaining({ code: "investigation-topic-missing" }),
      expect.objectContaining({ code: "investigation-source-missing" }),
      expect.objectContaining({ code: "investigation-objective-missing" }),
      expect.objectContaining({ code: "investigation-provenance-chapter-missing" }),
    ]));
  });
});
