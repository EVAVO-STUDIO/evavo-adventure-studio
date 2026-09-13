import {
  canonicalPlayerSystemText,
  extractPlayerSystemLocalisableText,
  formatPlayerSystemText,
  localisationPlaceholders,
  playerSystemLocalisationFields,
  playerSystemLocalisationKey,
} from "@evavo/adventure-project-schema/localisation";
import { describe, expect, it } from "vitest";

describe("player system localisation", () => {
  it("extracts a stable governed catalogue for menus, loading and transient status", () => {
    const entries = extractPlayerSystemLocalisableText("project.system-text");

    expect(entries).toHaveLength(playerSystemLocalisationFields.length);
    expect(entries.map((entry) => entry.key)).toEqual(
      [...entries.map((entry) => entry.key)].sort((left, right) => left.localeCompare(right)),
    );
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: playerSystemLocalisationKey("heading.paused"),
          role: "player-system-heading",
          text: "GAME PAUSED",
        }),
        expect.objectContaining({
          key: playerSystemLocalisationKey("aria.gameCanvas"),
          role: "player-system-heading",
        }),
        expect.objectContaining({
          key: playerSystemLocalisationKey("label.language"),
          role: "player-system-menu-label",
          text: "LANGUAGE",
        }),
        expect.objectContaining({
          key: playerSystemLocalisationKey("menu.save"),
          role: "player-system-menu-label",
          text: "SAVE GAME",
        }),
        expect.objectContaining({
          key: playerSystemLocalisationKey("description.load"),
          role: "player-system-description",
        }),
        expect.objectContaining({
          key: playerSystemLocalisationKey("loading.game"),
          role: "player-system-status",
        }),
        expect.objectContaining({
          key: playerSystemLocalisationKey("status.replayRecorded"),
          role: "player-system-status",
        }),
        expect.objectContaining({
          key: playerSystemLocalisationKey("status.saveSlotWritten"),
          role: "player-system-status",
        }),
        expect.objectContaining({
          key: playerSystemLocalisationKey("footer.controls"),
          role: "player-system-footer",
        }),
      ]),
    );
  });

  it("retains deterministic placeholders and interpolates only supplied values", () => {
    const source = extractPlayerSystemLocalisableText("project.system-text").find(
      (entry) => entry.key === playerSystemLocalisationKey("slot.valid"),
    );
    if (!source) throw new Error("Expected the valid save-slot source entry.");

    expect(localisationPlaceholders(source.text)).toEqual(["scene", "tick", "title"]);
    expect(
      formatPlayerSystemText(source.text, {
        title: "SAVE SLOT 03",
        scene: "Municipal Archive",
        tick: 9137,
      }),
    ).toBe("SAVE SLOT 03 — Municipal Archive TICK 9137");
    expect(formatPlayerSystemText("LOAD FAILED — {error}")).toBe("LOAD FAILED — {error}");
  });

  it("governs replay counts, cutscene hints and startup errors through stable placeholders", () => {
    const entries = extractPlayerSystemLocalisableText("project.system-text");
    const replay = entries.find(
      (entry) => entry.key === playerSystemLocalisationKey("status.replayRecorded"),
    );
    const cutscene = entries.find(
      (entry) => entry.key === playerSystemLocalisationKey("status.cutsceneNameSkippable"),
    );
    const startup = entries.find(
      (entry) => entry.key === playerSystemLocalisationKey("error.playerCouldNotStart"),
    );

    expect(replay && localisationPlaceholders(replay.text)).toEqual(["count", "eventLabel"]);
    expect(cutscene && localisationPlaceholders(cutscene.text)).toEqual(["name"]);
    expect(startup && localisationPlaceholders(startup.text)).toEqual(["error"]);
  });

  it("provides canonical text through the same resolver contract used by the Player", () => {
    expect(canonicalPlayerSystemText("slot.numbered", { slot: "07" })).toBe("SAVE SLOT 07");
    expect(
      canonicalPlayerSystemText("slot.detail", {
        score: 42,
        count: 3,
        itemLabel: canonicalPlayerSystemText("slot.itemPlural"),
      }),
    ).toBe("SCORE 42 • 3 ITEMS");
    expect(
      canonicalPlayerSystemText("status.replayRecorded", {
        count: 1,
        eventLabel: canonicalPlayerSystemText("status.replayEventSingular"),
      }),
    ).toBe("REPLAY RECORDED • 1 EVENT");
  });
});
