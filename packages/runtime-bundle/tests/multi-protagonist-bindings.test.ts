import { describe, expect, it } from "vitest";
import {
  runtimeMultiProtagonistBindingManifestSchema,
  validateRuntimeMultiProtagonistBindings,
} from "../src/multi-protagonist-bindings.js";

const context = {
  protagonistIds: new Set(["actor.present", "actor.past", "actor.future"]),
  itemIds: new Set(["item.plan"]),
  interactionIds: new Set(["interaction.clock.pull"]),
  oneShotInteractionIds: new Set(["interaction.clock.pull"]),
  dialogueChoiceIds: new Set(["dialogue-choice.answer"]),
  oneShotDialogueChoiceIds: new Set(["dialogue-choice.answer"]),
  recipeIds: new Set(["item-combination.power-machine"]),
  oneShotRecipeIds: new Set(["item-combination.power-machine"]),
  entrancesByScene: new Map([
    ["scene.future", new Set(["entrance.future"])],
  ]),
};

describe("runtime multi-protagonist bindings", () => {
  it("accepts one-shot gameplay sources and valid cross-character targets", () => {
    const manifest = runtimeMultiProtagonistBindingManifestSchema.parse({
      manifestVersion: 1,
      projectId: "project.cross-time",
      bindings: [
        {
          id: "multi-binding.power",
          source: { kind: "item-combination-used", recipeId: "item-combination.power-machine" },
          effects: [
            { kind: "set-shared-flag", flag: "powered", value: true },
            {
              kind: "move-protagonist",
              protagonistId: "actor.future",
              sceneId: "scene.future",
              entranceId: "entrance.future",
            },
            {
              kind: "transfer-item",
              fromProtagonistId: "actor.present",
              toProtagonistId: "actor.past",
              itemId: "item.plan",
            },
          ],
        },
      ],
    });
    expect(validateRuntimeMultiProtagonistBindings(manifest, context)).toEqual([]);
  });

  it("rejects repeatable sources and invalid target identities", () => {
    const manifest = runtimeMultiProtagonistBindingManifestSchema.parse({
      manifestVersion: 1,
      projectId: "project.cross-time",
      bindings: [
        {
          id: "multi-binding.bad",
          source: { kind: "interaction-consumed", interactionId: "interaction.clock.pull" },
          effects: [
            {
              kind: "give-protagonist-item",
              protagonistId: "actor.missing",
              itemId: "item.missing",
            },
          ],
        },
      ],
    });
    const issues = validateRuntimeMultiProtagonistBindings(manifest, {
      ...context,
      oneShotInteractionIds: new Set(),
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "source-not-one-shot" }),
        expect.objectContaining({ code: "unknown-protagonist" }),
        expect.objectContaining({ code: "unknown-item" }),
      ]),
    );
  });
});
