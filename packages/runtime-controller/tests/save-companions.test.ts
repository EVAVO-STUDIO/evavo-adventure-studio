import type { SaveGame } from "@evavo/adventure-save-game";
import { describe, expect, it } from "vitest";
import { featureSaveCompanionOptions } from "../src/save-companions.js";

describe("feature save companion preservation", () => {
  it("carries every optional whole-game companion through internal save reconstruction", () => {
    const save = {
      interface: {
        profiledCamera: { profileId: "classic-balanced" },
        sentence: { verbId: null, primary: null, secondary: null },
      },
      audio: { tick: 1 },
      investigation: { currentChapterId: "day-1" },
      itemCombinations: { usedRecipeIds: [] },
      multiProtagonist: { activeProtagonistId: "actor.a" },
      roomScripts: { sceneId: "scene.a" },
      routeTopology: { currentNodeId: "route-node.a" },
      rpg: { classId: "fighter" },
      rpgEconomy: { balances: { silver: 42 }, equippedBySlot: {}, stockByShopItem: {} },
      specializedModes: { active: null },
    } as unknown as SaveGame;

    expect(featureSaveCompanionOptions(save)).toMatchObject({
      profiledCamera: save.interface.profiledCamera,
      sentence: save.interface.sentence,
      audio: save.audio,
      investigation: save.investigation,
      itemCombinations: save.itemCombinations,
      multiProtagonist: save.multiProtagonist,
      roomScripts: save.roomScripts,
      routeTopology: save.routeTopology,
      rpg: save.rpg,
      rpgEconomy: save.rpgEconomy,
      specializedModes: save.specializedModes,
    });
  });
});
