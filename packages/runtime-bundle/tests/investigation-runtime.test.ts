import { describe, expect, it } from "vitest";
import {
  runtimeInvestigationManifestSchema,
  validateRuntimeInvestigation,
} from "../src/investigation.js";

const valid = () => ({
  manifestVersion: 1 as const,
  projectId: "project.investigation-runtime",
  facts: [
    {
      id: "fact.case.mark",
      label: "Repeated mark",
      description: "A repeated freight mark.",
      unlockTopicIds: ["topic.case.mark"],
    },
    {
      id: "fact.case.alias",
      label: "Alias",
      description: "An alias from the archive.",
    },
  ],
  topics: [
    {
      id: "topic.case.mark",
      label: "Shipping mark",
      initiallyAvailable: false,
      revealFactIds: ["fact.case.alias"],
      oneShot: true,
    },
  ],
  researchSources: [
    {
      id: "source.case.archive",
      label: "Archive index",
      availableChapterIds: ["chapter.case.day-1"],
      revealFactIds: ["fact.case.mark"],
      revealTopicIds: ["topic.case.mark"],
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
          id: "objective.case.archive",
          label: "Read the archive",
          required: true,
          score: 4,
          requirements: [
            { kind: "source-used" as const, sourceId: "source.case.archive" },
            { kind: "fact" as const, factId: "fact.case.mark" },
          ],
        },
      ],
    },
    {
      id: "chapter.case.day-2",
      label: "Day Two",
      order: 2,
      objectives: [],
    },
  ],
  presenceVariants: [
    {
      id: "presence.case.clerk.day-2",
      chapterIds: ["chapter.case.day-2"],
      locationId: "location.case.archive",
      present: false,
    },
  ],
});

describe("Runtime Bundle investigation sidecar", () => {
  it("parses hidden-topic, research, chapter and presence structures", () => {
    const manifest = runtimeInvestigationManifestSchema.parse(valid());
    expect(validateRuntimeInvestigation(manifest)).toEqual([]);
    expect(manifest.topics[0]).toMatchObject({
      id: "topic.case.mark",
      initiallyAvailable: false,
      oneShot: true,
    });
  });

  it("rejects structurally invalid investigation IDs", () => {
    const malformed = valid();
    malformed.facts[0]!.id = "bad-id" as never;
    expect(() => runtimeInvestigationManifestSchema.parse(malformed)).toThrow();
  });

  it("reports unknown semantic references before runtime", () => {
    const malformed = runtimeInvestigationManifestSchema.parse({
      ...valid(),
      topics: [
        {
          id: "topic.case.mark",
          label: "Shipping mark",
          revealFactIds: ["fact.case.missing"],
        },
      ],
    });
    expect(validateRuntimeInvestigation(malformed)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unknown-fact",
          severity: "error",
          message: expect.stringContaining("fact.case.missing"),
        }),
      ]),
    );
  });

  it("reports duplicate chapter order independently from duplicate IDs", () => {
    const malformed = runtimeInvestigationManifestSchema.parse({
      ...valid(),
      chapters: valid().chapters.map((chapter) => ({ ...chapter, order: 1 })),
    });
    expect(validateRuntimeInvestigation(malformed)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate-chapter-order" }),
      ]),
    );
  });
});
