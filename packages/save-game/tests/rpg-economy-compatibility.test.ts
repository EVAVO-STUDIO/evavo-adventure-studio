import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "../src/schema.js";
import { describe, expect, it } from "vitest";
import { saveGameAdventureRpgEconomyStateSchema } from "../src/rpg-economy.js";
import { validateSavedAdventureRpgEconomy } from "../src/rpg-economy-compatibility.js";

const bundle = {
  rpg: {
    economy: {
      manifestVersion: 1,
      projectId: "project.economy-save",
      currencies: [{ id: "silver", label: "Silver", startingBalance: 10 }],
      equipmentSlots: [{ id: "weapon", label: "Weapon" }],
      equipment: [
        {
          id: "equipment.sword",
          itemId: "item.sword",
          slotId: "weapon",
          classTagsAny: [],
          modifiers: { attack: 2 },
        },
      ],
      shops: [
        {
          id: "shop.smith",
          label: "Smith",
          stock: [
            {
              itemId: "item.sword",
              currencyId: "silver",
              buyPrice: 5,
              sellPrice: 2,
              quantity: 1,
            },
          ],
        },
      ],
    },
  },
} as unknown as RuntimeBundle;

const economy = saveGameAdventureRpgEconomyStateSchema.parse({
  balances: { silver: 5 },
  equippedBySlot: { weapon: "item.sword" },
  stockByShopItem: { "shop.smith\u0000item.sword": 0 },
});

const save = { rpgEconomy: economy } as unknown as SaveGame;

describe("RPG economy save compatibility", () => {
  it("accepts economy state against the matching manifest", () => {
    expect(validateSavedAdventureRpgEconomy(bundle, save)).toEqual([]);
  });

  it("rejects stale currencies, slots, equipment and shop stock", () => {
    const changed = {
      rpg: {
        economy: {
          manifestVersion: 1,
          projectId: "project.economy-save",
          currencies: [{ id: "gold", label: "Gold", startingBalance: 0 }],
          equipmentSlots: [{ id: "body", label: "Body" }],
          equipment: [],
          shops: [],
        },
      },
    } as unknown as RuntimeBundle;
    expect(validateSavedAdventureRpgEconomy(changed, save).map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "rpg-economy-currency-missing",
        "rpg-economy-slot-missing",
        "rpg-economy-item-missing",
        "rpg-economy-stock-missing",
      ]),
    );
  });

  it("rejects economy state when the runtime no longer defines economy", () => {
    expect(
      validateSavedAdventureRpgEconomy({ rpg: {} } as unknown as RuntimeBundle, save),
    ).toEqual([
      expect.objectContaining({ code: "rpg-economy-state-without-runtime-manifest" }),
    ]);
  });
});
