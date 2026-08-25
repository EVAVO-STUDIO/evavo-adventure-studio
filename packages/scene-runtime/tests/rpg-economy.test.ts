import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeAdventureRpgEconomyManifest } from "@evavo/adventure-runtime-bundle/rpg-economy";
import { describe, expect, it } from "vitest";
import type { InteractiveRuntimeWorldState } from "../src/commands.js";
import {
  adventureRpgEquipmentModifiers,
  buyAdventureRpgItem,
  createAdventureRpgEconomyState,
  equipAdventureRpgItem,
  sellAdventureRpgItem,
  unequipAdventureRpgSlot,
} from "../src/rpg-economy.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const manifest: RuntimeAdventureRpgEconomyManifest = {
  manifestVersion: 1,
  projectId: id<"project">("project.qfg-economy"),
  currencies: [{ id: "silver", label: "Silver", startingBalance: 100 }],
  equipmentSlots: [
    { id: "weapon", label: "Weapon" },
    { id: "body", label: "Body" },
  ],
  equipment: [
    {
      id: "equipment.broadsword",
      itemId: id<"item">("item.broadsword"),
      slotId: "weapon",
      classTagsAny: ["fighter"],
      modifiers: { attack: 8 },
    },
    {
      id: "equipment.leather",
      itemId: id<"item">("item.leather"),
      slotId: "body",
      classTagsAny: [],
      modifiers: { defense: 3 },
    },
  ],
  shops: [
    {
      id: "shop.weapon-smith",
      label: "Weaponsmith",
      when: { kind: "flag", flag: "shopOpen", equals: true },
      stock: [
        {
          itemId: id<"item">("item.broadsword"),
          currencyId: "silver",
          buyPrice: 40,
          sellPrice: 20,
          quantity: 1,
        },
        {
          itemId: id<"item">("item.leather"),
          currencyId: "silver",
          buyPrice: 30,
          sellPrice: 15,
          quantity: null,
        },
      ],
    },
  ],
};

const world = (shopOpen = true): InteractiveRuntimeWorldState => ({
  story: {
    schemaVersion: 1,
    projectId: manifest.projectId,
    tick: 0,
    currentSceneId: id<"scene">("scene.shop"),
    currentEntranceId: id<"entrance">("entrance.shop"),
    flags: { shopOpen },
    variables: {},
    inventory: [],
    awardedScoreIds: [],
    consumedInteractionIds: [],
    consumedDialogueChoiceIds: [],
    activeDialogue: null,
    activeSequences: [],
    objectStates: {},
    randomStreams: { main: 1 },
    score: 0,
  },
  actorInstances: {},
  movements: {},
  pendingObjectCommands: {},
  activeInteractionChoreographies: {},
  activeEntryChoreographies: {},
});

describe("RPG economy", () => {
  it("buys finite stock, equips by class, exposes modifiers, and sells only after unequip", () => {
    let game = world();
    let economy = createAdventureRpgEconomyState(manifest);

    const bought = buyAdventureRpgItem(manifest, game, economy, "shop.weapon-smith", id<"item">("item.broadsword"));
    expect(bought.kind).toBe("success");
    if (bought.kind !== "success") return;
    game = bought.world;
    economy = bought.economy;
    expect(game.story.inventory).toContain("item.broadsword");
    expect(economy.balances.silver).toBe(60);
    expect(economy.stockByShopItem["shop.weapon-smith\u0000item.broadsword"]).toBe(0);

    expect(
      buyAdventureRpgItem(manifest, game, economy, "shop.weapon-smith", id<"item">("item.broadsword")),
    ).toMatchObject({ kind: "failure", reason: "out-of-stock" });

    expect(
      equipAdventureRpgItem(manifest, game, economy, id<"item">("item.broadsword"), ["mage"]),
    ).toMatchObject({ kind: "failure", reason: "class-restricted" });

    const equipped = equipAdventureRpgItem(
      manifest,
      game,
      economy,
      id<"item">("item.broadsword"),
      ["fighter"],
    );
    expect(equipped.kind).toBe("success");
    if (equipped.kind !== "success") return;
    economy = equipped.economy;
    expect(economy.equippedBySlot.weapon).toBe("item.broadsword");
    expect(adventureRpgEquipmentModifiers(manifest, economy)).toEqual({ attack: 8 });

    expect(
      sellAdventureRpgItem(manifest, game, economy, "shop.weapon-smith", id<"item">("item.broadsword")),
    ).toMatchObject({ kind: "failure", reason: "already-equipped" });

    economy = unequipAdventureRpgSlot(economy, "weapon");
    const sold = sellAdventureRpgItem(
      manifest,
      game,
      economy,
      "shop.weapon-smith",
      id<"item">("item.broadsword"),
    );
    expect(sold.kind).toBe("success");
    if (sold.kind !== "success") return;
    expect(sold.world.story.inventory).not.toContain("item.broadsword");
    expect(sold.economy.balances.silver).toBe(80);
    expect(sold.economy.stockByShopItem["shop.weapon-smith\u0000item.broadsword"]).toBe(1);
  });

  it("respects shop conditions and unlimited stock", () => {
    const economy = createAdventureRpgEconomyState(manifest);
    expect(
      buyAdventureRpgItem(manifest, world(false), economy, "shop.weapon-smith", id<"item">("item.leather")),
    ).toMatchObject({ kind: "failure", reason: "shop-unavailable" });
    const bought = buyAdventureRpgItem(
      manifest,
      world(true),
      economy,
      "shop.weapon-smith",
      id<"item">("item.leather"),
    );
    expect(bought.kind).toBe("success");
    if (bought.kind !== "success") return;
    expect(bought.economy.stockByShopItem["shop.weapon-smith\u0000item.leather"]).toBeNull();
  });
});
