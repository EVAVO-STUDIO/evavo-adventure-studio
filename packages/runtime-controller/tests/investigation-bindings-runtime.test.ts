import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import { createRuntimeInvestigationState } from "@evavo/adventure-scene-runtime/investigation-runtime";
import { describe, expect, it } from "vitest";
import { applyConsumedRuntimeInvestigationBindings } from "../src/investigation-bindings-runtime.js";

const bundle = {
  projectId: "project.binding-test",
  investigation: {
    manifestVersion: 1,
    projectId: "project.binding-test",
    facts: [
      {
        id: "fact.alias",
        label: "Alias",
        description: "Registry alias.",
        unlockTopicIds: ["topic.alias"],
      },
      {
        id: "fact.contradiction",
        label: "Contradiction",
        description: "Witness contradiction.",
      },
    ],
    topics: [
      {
        id: "topic.alias",
        label: "Alias",
        revealFactIds: ["fact.contradiction"],
        oneShot: true,
      },
    ],
    researchSources: [
      {
        id: "source.registry",
        label: "Registry",
        availableChapterIds: ["chapter.day-1"],
        revealFactIds: ["fact.alias"],
        oneShot: true,
      },
    ],
    chapters: [
      {
        id: "chapter.day-1",
        label: "Day 1",
        order: 1,
        nextChapterId: "chapter.day-2",
        objectives: [
          {
            id: "objective.contradiction",
            label: "Find contradiction",
            required: true,
            score: 5,
            requirements: [{ kind: "fact", factId: "fact.contradiction" }],
          },
        ],
      },
      { id: "chapter.day-2", label: "Day 2", order: 2, objectives: [] },
    ],
  },
  investigationBindings: {
    manifestVersion: 1,
    projectId: "project.binding-test",
    interactions: [
      {
        interactionId: "interaction.read-registry",
        effects: [{ kind: "use-research-source", sourceId: "source.registry" }],
      },
    ],
    dialogueChoices: [
      {
        choiceId: "dialogue-choice.ask-alias",
        effects: [{ kind: "use-topic", topicId: "topic.alias", speakerId: "actor.clerk" }],
      },
      {
        choiceId: "dialogue-choice.end-day",
        effects: [{ kind: "advance-chapter" }],
      },
    ],
  },
} as unknown as RuntimeBundle;

const world = (
  interactions: readonly string[],
  choices: readonly string[],
): InteractiveRuntimeWorldState => ({
  story: {
    consumedInteractionIds: interactions,
    consumedDialogueChoiceIds: choices,
  },
} as unknown as InteractiveRuntimeWorldState);

describe("runtime investigation semantic bindings", () => {
  it("applies newly consumed room and dialogue bindings exactly once", () => {
    const initial = createRuntimeInvestigationState(bundle);
    if (!initial) throw new Error("Expected investigation state.");

    const afterResearch = applyConsumedRuntimeInvestigationBindings(
      bundle,
      initial,
      world([], []),
      world(["interaction.read-registry"], []),
    );
    expect(afterResearch.discoveredFactIds).toEqual(["fact.alias"]);
    expect(afterResearch.availableTopicIds).toEqual(["topic.alias"]);

    const unchanged = applyConsumedRuntimeInvestigationBindings(
      bundle,
      afterResearch,
      world(["interaction.read-registry"], []),
      world(["interaction.read-registry"], []),
    );
    expect(unchanged).toEqual(afterResearch);

    const afterTopic = applyConsumedRuntimeInvestigationBindings(
      bundle,
      afterResearch,
      world(["interaction.read-registry"], []),
      world(["interaction.read-registry"], ["dialogue-choice.ask-alias"]),
    );
    expect(afterTopic.discoveredFactIds).toEqual(["fact.alias", "fact.contradiction"]);
    expect(afterTopic.score).toBe(5);
    expect(afterTopic.awardedObjectiveIds).toEqual(["objective.contradiction"]);

    const afterAdvance = applyConsumedRuntimeInvestigationBindings(
      bundle,
      afterTopic,
      world(["interaction.read-registry"], ["dialogue-choice.ask-alias"]),
      world(
        ["interaction.read-registry"],
        ["dialogue-choice.ask-alias", "dialogue-choice.end-day"],
      ),
    );
    expect(afterAdvance.chapterId).toBe("chapter.day-2");
    expect(afterAdvance.score).toBe(5);
  });
});
