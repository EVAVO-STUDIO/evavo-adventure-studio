import { describe, expect, it } from "vitest";
import {
  runtimeInvestigationBindingManifestSchema,
  validateRuntimeInvestigationBindings,
  type RuntimeInvestigationManifest,
} from "../src/index.js";

const investigation: RuntimeInvestigationManifest = {
  manifestVersion: 1,
  projectId: "project.binding-validation",
  facts: [{ id: "fact.alias", label: "Alias", description: "Alias discovered." }],
  topics: [{ id: "topic.alias", label: "Alias" }],
  researchSources: [{
    id: "source.registry",
    label: "Registry",
    availableChapterIds: ["chapter.day-1"],
    revealFactIds: ["fact.alias"],
  }],
  chapters: [{ id: "chapter.day-1", label: "Day 1", order: 1, objectives: [] }],
};

const context = {
  investigation,
  interactionIds: new Set(["interaction.once", "interaction.repeat"]),
  dialogueChoiceIds: new Set(["dialogue-choice.once", "dialogue-choice.repeat"]),
  oneShotInteractionIds: new Set(["interaction.once"]),
  oneShotDialogueChoiceIds: new Set(["dialogue-choice.once"]),
};

describe("runtime investigation bindings", () => {
  it("accepts one-shot sources and real semantic references", () => {
    const manifest = runtimeInvestigationBindingManifestSchema.parse({
      manifestVersion: 1,
      projectId: "project.binding-validation",
      interactions: [{
        interactionId: "interaction.once",
        effects: [{ kind: "use-research-source", sourceId: "source.registry" }],
      }],
      dialogueChoices: [{
        choiceId: "dialogue-choice.once",
        effects: [{ kind: "use-topic", topicId: "topic.alias", speakerId: "actor.clerk" }],
      }],
    });
    expect(validateRuntimeInvestigationBindings(manifest, context)).toEqual([]);
  });

  it("rejects repeatable or unknown automatic binding sources", () => {
    const manifest = runtimeInvestigationBindingManifestSchema.parse({
      manifestVersion: 1,
      projectId: "project.binding-validation",
      interactions: [
        {
          interactionId: "interaction.repeat",
          effects: [{ kind: "discover-facts", factIds: ["fact.alias"], discoveryKind: "evidence", sourceId: "desk" }],
        },
        {
          interactionId: "interaction.unknown",
          effects: [{ kind: "set-flag", flag: "seen", value: true }],
        },
      ],
      dialogueChoices: [{
        choiceId: "dialogue-choice.repeat",
        effects: [{ kind: "use-topic", topicId: "topic.alias", speakerId: "actor.clerk" }],
      }],
    });
    expect(validateRuntimeInvestigationBindings(manifest, context)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "non-once-interaction-binding" }),
        expect.objectContaining({ code: "unknown-interaction" }),
        expect.objectContaining({ code: "non-once-dialogue-choice-binding" }),
      ]),
    );
  });
});
