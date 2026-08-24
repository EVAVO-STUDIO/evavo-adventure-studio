import { describe, expect, it } from "vitest";
import {
  runtimeItemCombinationManifestSchema,
  validateRuntimeItemCombinations,
} from "../src/index.js";

const manifest = runtimeItemCombinationManifestSchema.parse({
  manifestVersion: 1,
  projectId: "project.combinations",
  recipes: [{
    id: "item-combination.power-radio",
    verb: "use",
    primaryItemId: "item.battery",
    secondaryItemId: "item.radio",
    commutative: true,
    actions: [
      { kind: "remove-item", itemId: "item.battery" },
      { kind: "remove-item", itemId: "item.radio" },
      { kind: "give-item", itemId: "item.powered-radio" },
    ],
  }],
});

describe("runtime item combination manifest", () => {
  it("validates all recipe and action item references", () => {
    expect(validateRuntimeItemCombinations(
      manifest,
      new Set(["item.battery", "item.radio", "item.powered-radio"]),
    )).toEqual([]);
  });

  it("rejects missing items and same-item recipes", () => {
    const invalid = runtimeItemCombinationManifestSchema.parse({
      ...manifest,
      recipes: [{
        id: "item-combination.bad",
        verb: "use",
        primaryItemId: "item.battery",
        secondaryItemId: "item.battery",
        actions: [{ kind: "give-item", itemId: "item.unknown" }],
      }],
    });
    expect(validateRuntimeItemCombinations(invalid, new Set(["item.battery"]))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "same-item-recipe" }),
        expect.objectContaining({ code: "unknown-item" }),
      ]),
    );
  });
});
