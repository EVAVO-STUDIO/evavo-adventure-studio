import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import { createMultiProtagonistState } from "@evavo/adventure-scene-runtime/multi-protagonist";
import { applyNewMultiProtagonistBindings } from "../src/multi-protagonist-bindings-runtime.js";

const world = (
  consumedInteractionIds: readonly string[] = [],
  consumedDialogueChoiceIds: readonly string[] = [],
) =>
  ({
    story: {
      consumedInteractionIds,
      consumedDialogueChoiceIds,
    },
  }) as unknown as InteractiveRuntimeWorldState;

const bundle = {
  multiProtagonistBindings: {
    manifestVersion: 1,
    projectId: "project.cross-state",
    bindings: [
      {
        id: "multi-binding.power-future-door",
        source: {
          kind: "item-combination-used",
          recipeId: "item-combination.battery-radio",
        },
        effects: [
          { kind: "set-shared-flag", flag: "powerRestored", value: true },
          { kind: "add-shared-fact", factId: "fact.power-restored" },
          {
            kind: "set-protagonist-flag",
            protagonistId: "actor.future",
            flag: "cellDoorPowered",
            value: true,
          },
        ],
      },
    ],
  },
} as unknown as RuntimeBundle;

const initial = createMultiProtagonistState(
  [
    {
      protagonistId: "actor.present" as never,
      startSceneId: "scene.present" as never,
      startEntranceId: "entrance.present" as never,
      startingInventory: ["item.battery" as never, "item.radio" as never],
    },
    {
      protagonistId: "actor.future" as never,
      startSceneId: "scene.future" as never,
      startEntranceId: "entrance.future" as never,
    },
  ],
  "actor.present" as never,
);

describe("cross-protagonist gameplay bindings", () => {
  it("applies a newly used combination to shared and remote protagonist state exactly once", () => {
    const first = applyNewMultiProtagonistBindings(
      bundle,
      { world: world(), usedRecipeIds: [] },
      { world: world(), usedRecipeIds: ["item-combination.battery-radio"] },
      initial,
    );

    expect(first.firedBindingIds).toEqual(["multi-binding.power-future-door"]);
    expect(first.state.sharedFlags.powerRestored).toBe(true);
    expect(first.state.sharedFacts).toContain("fact.power-restored");
    expect(first.state.protagonists["actor.future"]?.flags.cellDoorPowered).toBe(true);

    const repeated = applyNewMultiProtagonistBindings(
      bundle,
      { world: world(), usedRecipeIds: ["item-combination.battery-radio"] },
      { world: world(), usedRecipeIds: ["item-combination.battery-radio"] },
      first.state,
    );
    expect(repeated.firedBindingIds).toEqual([]);
    expect(repeated.state).toBe(first.state);
  });
});
