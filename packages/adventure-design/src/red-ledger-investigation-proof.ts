import type { InvestigationManifest } from "./investigation-kernel.js";

export const redLedgerInvestigationProof: InvestigationManifest = {
  manifestVersion: 1,
  facts: [
    {
      id: "fact.red-ledger.shipping-mark",
      label: "Repeated shipping mark",
      description: "The same hand-drawn mark appears on two unrelated freight records.",
      unlockTopicIds: ["topic.red-ledger.shipping-mark"],
    },
    {
      id: "fact.red-ledger.alias",
      label: "Ledger alias",
      description: "An archive index ties the initials R. Vale to an older warehouse lease.",
      unlockTopicIds: ["topic.red-ledger.r-vale"],
    },
    {
      id: "fact.red-ledger.witness-contradiction",
      label: "Witness contradiction",
      description: "The clerk's claim about never seeing R. Vale conflicts with the lease record.",
    },
    {
      id: "fact.red-ledger.optional-photo",
      label: "Optional photograph detail",
      description: "A background sign in an old photograph identifies a second loading entrance.",
    },
  ],
  topics: [
    {
      id: "topic.red-ledger.shipping-mark",
      label: "Shipping mark",
      revealFactIds: ["fact.red-ledger.shipping-mark"],
      oneShot: true,
    },
    {
      id: "topic.red-ledger.r-vale",
      label: "R. Vale",
      requiresFactIds: ["fact.red-ledger.alias"],
      revealFactIds: ["fact.red-ledger.witness-contradiction"],
      oneShot: true,
    },
  ],
  researchSources: [
    {
      id: "source.red-ledger.freight-book",
      label: "Freight registry",
      availableChapterIds: ["chapter.red-ledger.day-1"],
      revealFactIds: ["fact.red-ledger.shipping-mark"],
      oneShot: true,
    },
    {
      id: "source.red-ledger.lease-index",
      label: "Municipal lease index",
      availableChapterIds: ["chapter.red-ledger.day-1"],
      requiresFactIds: ["fact.red-ledger.shipping-mark"],
      revealFactIds: ["fact.red-ledger.alias"],
      revealTopicIds: ["topic.red-ledger.r-vale"],
      oneShot: true,
    },
    {
      id: "source.red-ledger.photo-box",
      label: "Old photograph box",
      availableChapterIds: ["chapter.red-ledger.day-1"],
      revealFactIds: ["fact.red-ledger.optional-photo"],
      oneShot: true,
    },
  ],
  chapters: [
    {
      id: "chapter.red-ledger.day-1",
      label: "Day One: The Mark",
      order: 1,
      nextChapterId: "chapter.red-ledger.day-2",
      objectives: [
        {
          id: "objective.red-ledger.trace-alias",
          label: "Trace the warehouse alias",
          required: true,
          score: 4,
          requirements: [
            { kind: "source-used", sourceId: "source.red-ledger.lease-index" },
            { kind: "fact", factId: "fact.red-ledger.alias" },
          ],
        },
        {
          id: "objective.red-ledger.challenge-clerk",
          label: "Challenge the clerk with the alias",
          required: true,
          score: 5,
          requirements: [
            { kind: "topic-used", topicId: "topic.red-ledger.r-vale" },
            { kind: "fact", factId: "fact.red-ledger.witness-contradiction" },
          ],
        },
        {
          id: "objective.red-ledger.inspect-photo",
          label: "Inspect the optional photograph box",
          required: false,
          score: 2,
          requirements: [{ kind: "fact", factId: "fact.red-ledger.optional-photo" }],
        },
      ],
    },
    {
      id: "chapter.red-ledger.day-2",
      label: "Day Two: Second Entrance",
      order: 2,
      objectives: [],
    },
  ],
  presenceVariants: [
    {
      id: "presence.red-ledger.clerk.day-1",
      chapterIds: ["chapter.red-ledger.day-1"],
      locationId: "location.red-ledger.archive-desk",
      present: true,
      state: "guarded",
    },
    {
      id: "presence.red-ledger.clerk.day-2",
      chapterIds: ["chapter.red-ledger.day-2"],
      locationId: "location.red-ledger.archive-desk",
      present: false,
    },
    {
      id: "presence.red-ledger.loading-yard.day-2",
      chapterIds: ["chapter.red-ledger.day-2"],
      locationId: "location.red-ledger.loading-yard",
      present: true,
      state: "open",
    },
  ],
};
