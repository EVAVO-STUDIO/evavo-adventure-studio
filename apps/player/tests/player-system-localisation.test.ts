import {
  extractPlayerSystemLocalisableText,
  playerSystemLocalisationKey,
} from "@evavo/adventure-project-schema/localisation";
import { parseRuntimeLocalisationPack } from "@evavo/adventure-runtime-bundle/localisation";
import { describe, expect, it } from "vitest";
import { createPlayerSystemText } from "../src/player-system-localisation.js";
import type { SaveGameSlotSnapshot } from "../src/save-storage.js";
import {
  classicSystemMenuItems,
  classicSystemMenuSlotLabel,
  createClassicSystemMenuState,
} from "../src/system-menu-state.js";

const projectId = "project.player-system";
const sources = extractPlayerSystemLocalisableText(projectId);
const pack = parseRuntimeLocalisationPack({
  packVersion: 1,
  projectId,
  sourceLocale: "en-AU",
  defaultLocale: "fr-FR",
  sourceEntries: sources,
  locales: [
    {
      locale: "fr-FR",
      label: "Français",
      status: "draft",
      entries: [
        {
          key: playerSystemLocalisationKey("menu.resume"),
          text: "REPRENDRE",
        },
        {
          key: playerSystemLocalisationKey("menu.save"),
          text: "SAUVEGARDER",
        },
        {
          key: playerSystemLocalisationKey("label.language"),
          text: "LANGUE",
        },
        {
          key: playerSystemLocalisationKey("aria.languageSelector"),
          text: "Langue du jeu",
        },
        {
          key: playerSystemLocalisationKey("loading.game"),
          text: "Chargement du jeu…",
        },
        {
          key: playerSystemLocalisationKey("slot.numbered"),
          text: "EMPLACEMENT {slot}",
        },
        {
          key: playerSystemLocalisationKey("slot.valid"),
          text: "{title} — {scene} TOUR {tick}",
        },
        {
          key: playerSystemLocalisationKey("slot.detail"),
          text: "SCORE {score} • {count} {itemLabel}",
        },
        {
          key: playerSystemLocalisationKey("slot.itemPlural"),
          text: "OBJETS",
        },
        {
          key: playerSystemLocalisationKey("status.replayRecorded"),
          text: "REPLAY ENREGISTRÉ • {count} {eventLabel}",
        },
        {
          key: playerSystemLocalisationKey("status.replayEventPlural"),
          text: "ÉVÉNEMENTS",
        },
        {
          key: playerSystemLocalisationKey("status.cutsceneNameSkippable"),
          text: "{name} • ÉCHAP POUR PASSER",
        },
      ],
    },
  ],
});

const validSlot: SaveGameSlotSnapshot = {
  slot: 3,
  status: "valid",
  tick: 9137,
  sceneId: "scene.archive",
  sceneName: "Archives municipales",
  score: 42,
  inventoryCount: 3,
  saveFingerprint: "fnv1a64:0123456789abcdef",
};

describe("Player system text", () => {
  it("uses canonical copy when the runtime bundle has no governed system catalogue", () => {
    const text = createPlayerSystemText(null, "fr-FR");
    expect(text("menu.resume")).toBe("RESUME GAME");
    expect(text("slot.numbered", { slot: "03" })).toBe("SAVE SLOT 03");
    expect(text("loading.runtimeBundle")).toBe("Loading runtime bundle…");
  });

  it("resolves authored translations and preserves source fallback", () => {
    const text = createPlayerSystemText({ localisation: pack }, "fr-FR");
    expect(text("menu.resume")).toBe("REPRENDRE");
    expect(text("heading.paused")).toBe("GAME PAUSED");
    expect(text("label.language")).toBe("LANGUE");
    expect(text("aria.languageSelector")).toBe("Langue du jeu");
    expect(text("loading.game")).toBe("Chargement du jeu…");
    expect(text("slot.numbered", { slot: "03" })).toBe("EMPLACEMENT 03");
  });

  it("formats replay and cutscene status with translated inflection and hints", () => {
    const text = createPlayerSystemText({ localisation: pack }, "fr-FR");
    const eventLabel = text("status.replayEventPlural");

    expect(text("status.replayRecorded", { count: 4, eventLabel })).toBe(
      "REPLAY ENREGISTRÉ • 4 ÉVÉNEMENTS",
    );
    expect(
      text("status.cutsceneNameSkippable", { name: "LE REGISTRE ROUGE" }),
    ).toBe("LE REGISTRE ROUGE • ÉCHAP POUR PASSER");
  });

  it("feeds translated labels and deterministic slot summaries into menu state", () => {
    const text = createPlayerSystemText({ localisation: pack }, "fr-FR");
    const root = classicSystemMenuItems(createClassicSystemMenuState(), [validSlot], text);

    expect(root[0]?.label).toBe("REPRENDRE");
    expect(root[1]?.label).toBe("SAUVEGARDER");
    expect(classicSystemMenuSlotLabel(validSlot, text)).toBe(
      "EMPLACEMENT 03 — Archives municipales TOUR 9137",
    );

    const saveItems = classicSystemMenuItems(
      { screen: "save", selectedIndex: 0 },
      [validSlot],
      text,
    );
    expect(saveItems[0]?.detail).toBe("SCORE 42 • 3 OBJETS");
  });
});
