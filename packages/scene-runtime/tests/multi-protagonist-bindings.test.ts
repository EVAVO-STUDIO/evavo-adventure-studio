import type { RuntimeMultiProtagonistBindingManifest } from "@evavo/adventure-runtime-bundle/multi-protagonist-bindings";
import { describe, expect, it } from "vitest";
import { applyNewMultiProtagonistBindings } from "../src/multi-protagonist-bindings.js";
import { createMultiProtagonistState } from "../src/multi-protagonist.js";

const manifest: RuntimeMultiProtagonistBindingManifest = {
  manifestVersion: 1,
  projectId: "project.cross-time" as never,
  bindings: [
    {
      id: "multi-binding.past.power-grid",
      source: { kind: "item-combination-used", recipeId: "item-combination.power-machine" },
      effects: [
        { kind: "set-shared-flag", flag: "machinePowered", value: true },
        { kind: "add-shared-fact", factId: "fact.machine-powered" },
        {
          kind: "set-protagonist-flag",
          protagonistId: "actor.future" as never,
          flag: "cellUnlocked",
          value: true,
        },
        {
          kind: "move-protagonist",
          protagonistId: "actor.future" as never,
          sceneId: "scene.future-hall" as never,
          entranceId: "entrance.future-hall" as never,
        },
        {
          kind: "transfer-item",
          fromProtagonistId: "actor.present" as never,
          toProtagonistId: "actor.past" as never,
          itemId: "item.plan" as never,
        },
      ],
    },
  ],
};

const initial = () =>
  createMultiProtagonistState(
    [
      {
        protagonistId: "actor.present" as never,
        startSceneId: "scene.present" as never,
        startEntranceId: "entrance.present" as never,
        startingInventory: ["item.plan" as never],
      },
      {
        protagonistId: "actor.past" as never,
        startSceneId: "scene.past" as never,
        startEntranceId: "entrance.past" as never,
      },
      {
        protagonistId: "actor.future" as never,
        startSceneId: "scene.future-cell" as never,
        startEntranceId: "entrance.future-cell" as never,
      },
    ],
    "actor.present" as never,
  );

describe("cross-protagonist bindings", () => {
  it("applies a newly completed recipe across shared and protagonist-local state exactly once", () => {
    const previous = {
      consumedInteractionIds: [],
      consumedDialogueChoiceIds: [],
      usedItemCombinationRecipeIds: [],
    };
    const current = {
      ...previous,
      usedItemCombinationRecipeIds: ["item-combination.power-machine"],
    };
    const first = applyNewMultiProtagonistBindings(manifest, initial(), previous, current);
    expect(first.firedBindingIds).toEqual(["multi-binding.past.power-grid"]);
    expect(first.state.sharedFlags.machinePowered).toBe(true);
    expect(first.state.sharedFacts).toContain("fact.machine-powered");
    expect(first.state.protagonists["actor.future"]?.flags.cellUnlocked).toBe(true);
    expect(first.state.protagonists["actor.future"]?.location).toEqual({
      sceneId: "scene.future-hall",
      entranceId: "entrance.future-hall",
    });
    expect(first.state.protagonists["actor.present"]?.inventory).not.toContain("item.plan");
    expect(first.state.protagonists["actor.past"]?.inventory).toContain("item.plan");

    const repeated = applyNewMultiProtagonistBindings(manifest, first.state, current, current);
    expect(repeated.firedBindingIds).toEqual([]);
    expect(repeated.state).toBe(first.state);
  });
});
