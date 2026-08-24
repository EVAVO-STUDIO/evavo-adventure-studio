import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "../src/schema.js";
import { describe, expect, it } from "vitest";
import { validateSavedMultiProtagonist } from "../src/multi-protagonist-compatibility.js";

const bundle = {
  multiProtagonist: {
    manifestVersion: 1,
    projectId: "project.multi",
    activeProtagonistId: "actor.bernard",
    protagonists: [
      {
        protagonistId: "actor.bernard",
        startSceneId: "scene.present",
        startEntranceId: "entrance.present",
        startingInventory: [],
      },
      {
        protagonistId: "actor.laverne",
        startSceneId: "scene.future",
        startEntranceId: "entrance.future",
        startingInventory: [],
      },
    ],
  },
  inventoryItems: [{ id: "item.plan" }],
  scenes: [
    { id: "scene.present", entrances: [{ id: "entrance.present" }] },
    { id: "scene.future", entrances: [{ id: "entrance.future" }] },
  ],
} as unknown as RuntimeBundle;

const state = {
  activeProtagonistId: "actor.laverne",
  protagonists: {
    "actor.bernard": {
      protagonistId: "actor.bernard",
      location: { sceneId: "scene.present", entranceId: "entrance.present" },
      inventory: ["item.plan"],
      flags: {},
    },
    "actor.laverne": {
      protagonistId: "actor.laverne",
      location: { sceneId: "scene.future", entranceId: "entrance.future" },
      inventory: [],
      flags: { free: true },
    },
  },
  sharedFlags: { constitutionChanged: true },
  sharedFacts: ["fact.constitution-changed"],
};

describe("multi-protagonist save compatibility", () => {
  it("accepts complete saved protagonist state", () => {
    expect(
      validateSavedMultiProtagonist(bundle, { multiProtagonist: state } as unknown as SaveGame),
    ).toEqual([]);
  });

  it("rejects stale protagonist identity, location and inventory references", () => {
    const invalid = {
      ...state,
      activeProtagonistId: "actor.missing",
      protagonists: {
        ...state.protagonists,
        "actor.laverne": {
          ...state.protagonists["actor.laverne"],
          location: { sceneId: "scene.future", entranceId: "entrance.missing" },
          inventory: ["item.missing"],
        },
      },
    };
    expect(
      validateSavedMultiProtagonist(bundle, { multiProtagonist: invalid } as unknown as SaveGame),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "multi-protagonist-active-missing" }),
        expect.objectContaining({ code: "multi-protagonist-location-invalid" }),
        expect.objectContaining({ code: "multi-protagonist-item-missing" }),
      ]),
    );
  });
});
