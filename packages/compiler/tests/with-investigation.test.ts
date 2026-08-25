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
  topicPanel: {
    region: { x: 8, y: 150, width: 304, height: 42 },
    gap: 1,
    maximumVisibleTopics: 8,
    dialogues: [
      {
        dialogueId: "dialogue.case.b" as never,
        speakerId: "actor.case.b" as never,
        responses: [
          { topicId: "topic.case.b", dialogueChoiceId: "dialogue-choice.case.b" as never },
          { topicId: "topic.case.a", dialogueChoiceId: "dialogue-choice.case.a" as never },
        ],
      },
      {
        dialogueId: "dialogue.case.a" as never,
        speakerId: "actor.case.a" as never,
        responses: [
          { topicId: "topic.case.b", dialogueChoiceId: "dialogue-choice.case.ab" as never },
        ],
      },
    ],
  },
});

describe("investigation compiler attachment", () => {
  it("canonicalises investigation arrays, panel mappings and nested references deterministically", () => {
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
      topicPanel: reversedInput.topicPanel
        ? {
            ...reversedInput.topicPanel,
            dialogues: [...reversedInput.topicPanel.dialogues].reverse().map((dialogue) => ({
              ...dialogue,
              responses: [...dialogue.responses].reverse(),
            })),
          }
        : undefined,
    });
    expect(second).toEqual(first);
    expect(first.facts.map((entry) => entry.id)).toEqual(["fact.case.a", "fact.case.b"]);
    expect(first.chapters.map((entry) => entry.id)).toEqual([
      "chapter.case.day-1",
      "chapter.case.day-2",
    ]);
    expect(first.topicPanel?.dialogues.map((entry) => entry.dialogueId)).toEqual([
      "dialogue.case.a",
      "dialogue.case.b",
    ]);
    expect(first.topicPanel?.dialogues[1]?.responses.map((entry) => entry.topicId)).toEqual([
      "topic.case.a",
      "topic.case.b",
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
