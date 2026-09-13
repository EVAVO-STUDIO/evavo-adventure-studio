import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "../src/schema.js";
import { describe, expect, it } from "vitest";
import { validateSavedItemCombinations } from "../src/item-combination-compatibility.js";

const bundle = {
  itemCombinations: {
    manifestVersion: 1,
    projectId: "project.combinations",
    recipes: [{
      id: "item-combination.power-radio",
      verb: "use",
      primaryItemId: "item.battery",
      secondaryItemId: "item.radio",
      actions: [],
    }],
  },
} as unknown as RuntimeBundle;

const saveWith = (itemCombinations: SaveGame["itemCombinations"]): SaveGame =>
  ({ itemCombinations } as unknown as SaveGame);

describe("saved item combination compatibility", () => {
  it("allows legacy saves without combination companion state", () => {
    expect(validateSavedItemCombinations(bundle, saveWith(undefined))).toEqual([]);
  });

  it("accepts retained recipe IDs", () => {
    expect(validateSavedItemCombinations(bundle, saveWith({
      usedRecipeIds: ["item-combination.power-radio"],
    }))).toEqual([]);
  });

  it("rejects stale recipe IDs", () => {
    expect(validateSavedItemCombinations(bundle, saveWith({
      usedRecipeIds: ["item-combination.missing"],
    }))).toEqual([
      expect.objectContaining({ code: "item-combination-recipe-missing" }),
    ]);
  });
});
