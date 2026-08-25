import type { InvestigationManifest } from "./investigation-kernel.js";

export const openCaseInvestigationProof: InvestigationManifest = {
  manifestVersion: 1,
  facts: [
    {
      id: "fact.open-case.fragment-position",
      label: "Fragment original position",
      description: "The glass fragment was documented in place relative to the witness-side window before collection.",
    },
    {
      id: "fact.open-case.custody-logged",
      label: "Custody chain retained",
      description: "The sealed fragment has a traceable collection and transfer record.",
    },
    {
      id: "fact.open-case.lab-window-match",
      label: "Lab window match",
      description: "Analysis links the retained fragment to the witness-side window composition.",
      unlockTopicIds: ["topic.open-case.window-condition"],
    },
    {
      id: "fact.open-case.witness-contradiction",
      label: "Witness contradiction",
      description: "The witness revises the earlier account after the evidence-backed window question.",
    },
    {
      id: "fact.open-case.location-justified",
      label: "Next location justified",
      description: "Physical evidence and revised testimony jointly justify opening the next investigation location.",
    },
  ],
  topics: [
    {
      id: "topic.open-case.window-condition",
      label: "Window condition",
      requiresFactIds: ["fact.open-case.lab-window-match"],
      revealFactIds: ["fact.open-case.witness-contradiction"],
      oneShot: true,
    },
  ],
  researchSources: [
    {
      id: "source.open-case.lab-report",
      label: "Glass analysis report",
      availableChapterIds: ["chapter.open-case.case-one"],
      requiresFactIds: ["fact.open-case.custody-logged"],
      revealFactIds: ["fact.open-case.lab-window-match"],
      oneShot: true,
    },
    {
      id: "source.open-case.caseboard",
      label: "Caseboard correlation",
      availableChapterIds: ["chapter.open-case.case-one"],
      requiresFactIds: [
        "fact.open-case.lab-window-match",
        "fact.open-case.witness-contradiction",
      ],
      revealFactIds: ["fact.open-case.location-justified"],
      oneShot: true,
    },
  ],
  chapters: [
    {
      id: "chapter.open-case.case-one",
      label: "Case One · Apartment and witness",
      order: 1,
      objectives: [
        {
          id: "objective.open-case.document-scene",
          label: "Document the fragile evidence in place",
          required: true,
          score: 3,
          requirements: [
            { kind: "fact", factId: "fact.open-case.fragment-position" },
          ],
        },
        {
          id: "objective.open-case.custody",
          label: "Retain a traceable custody chain",
          required: true,
          score: 4,
          requirements: [
            { kind: "fact", factId: "fact.open-case.custody-logged" },
          ],
        },
        {
          id: "objective.open-case.interview",
          label: "Test testimony against retained evidence",
          required: true,
          score: 5,
          requirements: [
            { kind: "topic-used", topicId: "topic.open-case.window-condition" },
            { kind: "fact", factId: "fact.open-case.witness-contradiction" },
          ],
        },
        {
          id: "objective.open-case.open-route",
          label: "Justify the next investigation location",
          required: true,
          score: 2,
          requirements: [
            { kind: "source-used", sourceId: "source.open-case.caseboard" },
            { kind: "fact", factId: "fact.open-case.location-justified" },
          ],
        },
      ],
      nextChapterId: "chapter.open-case.case-two",
    },
    {
      id: "chapter.open-case.case-two",
      label: "Case Two · New location",
      order: 2,
      objectives: [],
    },
  ],
  presenceVariants: [
    {
      id: "presence.open-case.witness.case-one",
      chapterIds: ["chapter.open-case.case-one"],
      locationId: "location.open-case.interview-room",
      present: true,
      state: "account-initial",
    },
    {
      id: "presence.open-case.witness.case-two",
      chapterIds: ["chapter.open-case.case-two"],
      locationId: "location.open-case.interview-room",
      present: false,
      state: "released-from-room",
    },
  ],
};
