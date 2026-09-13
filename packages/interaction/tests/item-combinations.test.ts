import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeState } from "@evavo/adventure-core";
import { describe, expect, it } from "vitest";
import {
  createItemCombinationRuntimeState,
  resolveItemCombination,
  validateItemCombinationManifest,
  type ItemCombinationManifest,
} from "../src/item-combinations.js";

const item = (id: string) => id as Id<"item">;
const award = (id: string) => id as Id<"score-award">;

const story = (inventory: readonly Id<"item">[], flags: Readonly<Record<string, boolean>> = {}): RuntimeState => ({
  schemaVersion: 1,
  projectId: "project.combinations" as Id<"project">,
  tick: 0,
  currentSceneId: "scene.lab" as Id<"scene">,
  currentEntranceId: "entrance.lab" as Id<"entrance">,
  flags,
  variables: {},
  inventory,
  awardedScoreIds: [],
  consumedInteractionIds: [],
  consumedDialogueChoiceIds: [],
  activeDialogue: null,
  activeSequences: [],
  objectStates: {},
  randomStreams: { main: 1 },
  score: 0,
});

const manifest: ItemCombinationManifest = {
  manifestVersion: 1,
  fallbackText: "That combination makes no sense.",
  recipes: [
    {
      id: "item-combination.battery-radio",
      verb: "use",
      primaryItemId: item("item.battery"),
      secondaryItemId: item("item.radio"),
      commutative: true,
      once: true,
      actions: [
        { kind: "remove-item", itemId: item("item.battery") },
        { kind: "remove-item", itemId: item("item.radio") },
        { kind: "give-item", itemId: item("item.powered-radio") },
        { kind: "award-score", awardId: award("score.power-radio"), points: 3 },
        { kind: "set-flag", flag: "radioPowered", value: true },
      ],
    },
    {
      id: "item-combination.note-pencil",
      verb: "use",
      primaryItemId: item("item.note"),
      secondaryItemId: item("item.pencil"),
      commutative: false,
      when: { kind: "flag", flag: "deskReady", equals: true },
      fallbackText: "You need a proper surface first.",
      actions: [{ kind: "set-flag", flag: "noteMarked", value: true }],
    },
  ],
};

describe("item combination recipes", () => {
  it("executes commutative recipes and transforms inventory through normal story actions", () => {
    const initialStory = story([item("item.radio"), item("item.battery")]);
    const result = resolveItemCombination(
      manifest,
      initialStory,
      createItemCombinationRuntimeState(),
      { verb: "use", primaryItemId: item("item.radio"), secondaryItemId: item("item.battery") },
    );
    expect(result.kind).toBe("executed");
    if (result.kind !== "executed") return;
    expect(result.story.inventory).toEqual([item("item.powered-radio")]);
    expect(result.story.flags.radioPowered).toBe(true);
    expect(result.story.score).toBe(3);
    expect(result.combinations.usedRecipeIds).toEqual(["item-combination.battery-radio"]);
  });

  it("does not re-run a one-shot recipe", () => {
    const initialStory = story([item("item.radio"), item("item.battery")]);
    const first = resolveItemCombination(
      manifest,
      initialStory,
      createItemCombinationRuntimeState(),
      { verb: "use", primaryItemId: item("item.battery"), secondaryItemId: item("item.radio") },
    );
    if (first.kind !== "executed") throw new Error("Expected recipe execution.");
    const replayStory = story([item("item.radio"), item("item.battery")]);
    const second = resolveItemCombination(
      manifest,
      replayStory,
      first.combinations,
      { verb: "use", primaryItemId: item("item.battery"), secondaryItemId: item("item.radio") },
    );
    expect(second).toMatchObject({ kind: "fallback", reason: "already-used" });
  });

  it("respects ordering and conditions", () => {
    const inventory = [item("item.note"), item("item.pencil")];
    const reversed = resolveItemCombination(
      manifest,
      story(inventory, { deskReady: true }),
      createItemCombinationRuntimeState(),
      { verb: "use", primaryItemId: item("item.pencil"), secondaryItemId: item("item.note") },
    );
    expect(reversed).toMatchObject({ kind: "fallback", reason: "no-match" });

    const blocked = resolveItemCombination(
      manifest,
      story(inventory),
      createItemCombinationRuntimeState(),
      { verb: "use", primaryItemId: item("item.note"), secondaryItemId: item("item.pencil") },
    );
    expect(blocked).toMatchObject({
      kind: "fallback",
      reason: "condition-failed",
      text: "You need a proper surface first.",
    });

    const allowed = resolveItemCombination(
      manifest,
      story(inventory, { deskReady: true }),
      createItemCombinationRuntimeState(),
      { verb: "use", primaryItemId: item("item.note"), secondaryItemId: item("item.pencil") },
    );
    expect(allowed.kind).toBe("executed");
    if (allowed.kind === "executed") expect(allowed.story.flags.noteMarked).toBe(true);
  });

  it("requires both items to be held and validates referenced inventory IDs", () => {
    const missing = resolveItemCombination(
      manifest,
      story([item("item.note")], { deskReady: true }),
      createItemCombinationRuntimeState(),
      { verb: "use", primaryItemId: item("item.note"), secondaryItemId: item("item.pencil") },
    );
    expect(missing).toMatchObject({ kind: "fallback", reason: "item-not-held" });

    const known = new Set([
      "item.battery",
      "item.radio",
      "item.powered-radio",
      "item.note",
      "item.pencil",
    ]);
    expect(validateItemCombinationManifest(manifest, known)).toEqual([]);
  });
});
