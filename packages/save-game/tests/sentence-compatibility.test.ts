import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "../src/schema.js";
import { describe, expect, it } from "vitest";
import { validateSavedSentence } from "../src/sentence-compatibility.js";

const bundle = {
  inventoryItems: [{ id: "item.key" }],
  sceneInstances: {
    scenes: [
      {
        objectInstances: [{ id: "object.door" }],
      },
    ],
  },
  uiSkins: {
    defaultSkinId: "ui-skin.scumm",
    skins: [
      {
        id: "ui-skin.scumm",
        verbs: [{ id: "ui-verb.use" }],
      },
    ],
  },
} as unknown as RuntimeBundle;

const save = {
  interface: {
    sentence: {
      verbId: "ui-verb.use",
      primary: { kind: "inventory-item", itemId: "item.key", label: "Key" },
      secondary: { kind: "scene-object", objectId: "object.door", label: "Door" },
    },
  },
} as unknown as SaveGame;

describe("saved classic sentence compatibility", () => {
  it("accepts sentence targets that still exist", () => {
    expect(validateSavedSentence(bundle, save)).toEqual([]);
  });

  it("rejects stale verbs, items and object instances", () => {
    const stale = structuredClone(save) as SaveGame;
    stale.interface.sentence = {
      verbId: "ui-verb.missing" as never,
      primary: { kind: "inventory-item", itemId: "item.missing" as never, label: "Missing" },
      secondary: { kind: "scene-object", objectId: "object.missing" as never, label: "Missing" },
    };
    expect(validateSavedSentence(bundle, stale)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "sentence-verb-missing" }),
        expect.objectContaining({ code: "sentence-item-missing" }),
        expect.objectContaining({ code: "sentence-object-missing" }),
      ]),
    );
  });
});
