import type { RuntimeInvestigationManifest } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  attachRuntimeInvestigation,
  canonicaliseRuntimeInvestigationManifest,
} from "../src/with-investigation.js";

const manifest = (): RuntimeInvestigationManifest => ({
  manifestVersion: 1,
  projectId: "project.investigation-compile" as never,
  facts: [
    { id: "fact.case.b", label: "B", description: "B" },
    { id: "fact.case.a", label: "A", description: "A", unlockTopicIds: ["topic.case.b", "topic.case.a"] },
  ],
  topics: [
    { id: "topic.case.b", label: "B", requiresFactIds: ["fact.case.b", "fact.case.a"] },
    { id: "topic.case.a", label: "A", initiallyAvailable: true },
  ],
  researchSources: [
    {
      id: "source.case.b",
      label: "B",
      availableChapterIds: ["chapter.case.day-2", "chapter.case.day-1"],
      revealFactIds: ["fact.case.b", "fact.case.a"],
    },
    {
      id: "source.case.a",
      label: "A",
      availableChapterIds: ["chapter.case.day-1"],
    },
  ],
  chapters: [
    { id: "chapter.case.day-2", label: "Day Two", order: 2, objectives: [] },
    {
      id: "chapter.case.day-1",
      label: "Day One",
      order: 1,
      nextChapterId: "chapter.case.day-2",
      objectives: [
        {
          id: "objective.case.b",
          label: "B",
          required: false,
          requirements: [{ kind: "fact", factId: "fact.case.b" }],
        },
        {
          id: "objective.case.a",
          label: "A",
          required: true,
          requirements: [
            { kind: "source-used", sourceId: "source.case.a" },
            { kind: "fact", factId: "fact.case.a" },
          ],
        },
      ],
    },
  ],
  presenceVariants: [
    {
      id: "presence.case.b",
      chapterIds: ["chapter.case.day-2", "chapter.case.day-1"],
      locationId: "location.b",
      present: true,
    },
    {
      id: "presence.case.a",
      chapterIds: ["chapter.case.day-1"],
      locationId: "location.a",
      present: true,
    },
  ],
});

describe("investigation compiler attachment", () => {
  it("canonicalises investigation arrays and nested references deterministically", () => {
    const first = canonicaliseRuntimeInvestigationManifest(manifest());
    const reversedInput = manifest();
    const second = canonicaliseRuntimeInvestigationManifest({
      ...reversedInput,
      facts: [...reversedInput.facts].reverse(),
      topics: [...reversedInput.topics].reverse(),
      researchSources: [...reversedInput.researchSources].reverse(),
      chapters: [...reversedInput.chapters].reverse().map((chapter) => ({
        ...chapter,
        objectives: [...chapter.objectives].reverse(),
      })),
      presenceVariants: [...(reversedInput.presenceVariants ?? [])].reverse(),
    });
    expect(second).toEqual(first);
    expect(first.facts.map((entry) => entry.id)).toEqual(["fact.case.a", "fact.case.b"]);
    expect(first.chapters.map((entry) => entry.id)).toEqual([
      "chapter.case.day-1",
      "chapter.case.day-2",
    ]);
  });

  it("rejects project mismatch before attempting bundle parsing", () => {
    const compiled = {
      bundle: { projectId: "project.other" },
      canonicalJson: "{}",
      fingerprint: "fnv1a64:0000000000000000",
      warnings: [],
    } as never;
    expect(() => attachRuntimeInvestigation(compiled, manifest())).toThrow(/does not match investigation project/u);
  });
});
