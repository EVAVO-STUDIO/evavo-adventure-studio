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
  it("extracts a stable governed catalogue for pause, save and load presentation", () => {
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
          key: playerSystemLocalisationKey("menu.save"),
          role: "player-system-menu-label",
          text: "SAVE GAME",
        }),
        expect.objectContaining({
          key: playerSystemLocalisationKey("description.load"),
          role: "player-system-description",
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

  it("provides canonical text through the same resolver contract used by the Player", () => {
    expect(canonicalPlayerSystemText("slot.numbered", { slot: "07" })).toBe("SAVE SLOT 07");
    expect(
      canonicalPlayerSystemText("slot.detail", {
        score: 42,
        count: 3,
        itemLabel: canonicalPlayerSystemText("slot.itemPlural"),
      }),
    ).toBe("SCORE 42 • 3 ITEMS");
  });
});
