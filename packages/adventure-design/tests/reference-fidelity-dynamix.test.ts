import { describe, expect, it } from "vitest";
import { heartOfChinaReferenceTitlePack } from "../src/reference-fidelity-heart-of-china.js";
import {
  adventureReferenceEngineDialectById,
  adventureReferenceTitlePackByTitleId,
} from "../src/reference-fidelity-presets.js";
import { riseOfTheDragonReferenceTitlePack } from "../src/reference-fidelity-rise-of-the-dragon.js";
import { validateAdventureReferenceTitlePack } from "../src/reference-fidelity-validation.js";

describe("Dynamix DGDS title reference bindings", () => {
  it("keeps DGDS separate from Sierra SCI and LucasArts SCUMM", () => {
    const dialect = adventureReferenceEngineDialectById("dynamix-dgds-vga");
    expect(dialect).toMatchObject({
      id: "dynamix-dgds-vga",
      nativeSize: { width: 320, height: 200 },
      paletteMode: "indexed-8-bit",
      logicalTicksPerSecond: 60,
    });
    expect(dialect.id).not.toContain("sierra");
    expect(dialect.id).not.toContain("lucasarts");
  });

  it("accepts separate Heart of China and Rise of the Dragon packs", () => {
    expect(validateAdventureReferenceTitlePack(heartOfChinaReferenceTitlePack)).toEqual([]);
    expect(validateAdventureReferenceTitlePack(riseOfTheDragonReferenceTitlePack)).toEqual([]);
    expect(heartOfChinaReferenceTitlePack.engineDialectId).toBe("dynamix-dgds-vga");
    expect(riseOfTheDragonReferenceTitlePack.engineDialectId).toBe("dynamix-dgds-vga");
    expect(heartOfChinaReferenceTitlePack.profileId).toBe("cinematic-pulp-vga");
    expect(riseOfTheDragonReferenceTitlePack.profileId).toBe("cinematic-pulp-vga");
  });

  it("keeps editorial travel and clock-driven cyber-noir materially different", () => {
    const heart = new Set(heartOfChinaReferenceTitlePack.capabilities.map((entry) => entry.id));
    const rise = new Set(riseOfTheDragonReferenceTitlePack.capabilities.map((entry) => entry.id));

    for (const id of [
      "protagonist-switching",
      "route-time-costs",
      "editorial-travel-montage",
      "knowledge-separation",
    ] as const) {
      expect(heart.has(id)).toBe(true);
    }
    expect(heart.has("visible-game-clock")).toBe(false);

    for (const id of [
      "visible-game-clock",
      "scheduled-contact-windows",
      "time-costed-actions",
      "deadline-outcomes",
    ] as const) {
      expect(rise.has(id)).toBe(true);
    }
    expect(rise.has("protagonist-switching")).toBe(false);

    for (const id of [
      "full-screen-cinematic-panels",
      "relationship-state",
      "action-sequence-windows",
      "action-telegraph-timing",
      "safe-action-retry",
    ] as const) {
      expect(heart.has(id)).toBe(true);
      expect(rise.has(id)).toBe(true);
    }
  });

  it("binds both commercial references to original EVAVO proof identities", () => {
    expect(adventureReferenceTitlePackByTitleId("heart-of-china").originalProof).toEqual(
      expect.objectContaining({
        showcaseId: "showcase.jade-horizon",
        title: "Jade Horizon",
        originalAssetsOnly: true,
      }),
    );
    expect(adventureReferenceTitlePackByTitleId("rise-of-the-dragon").originalProof).toEqual(
      expect.objectContaining({
        showcaseId: "showcase.dead-channel",
        title: "Dead Channel",
        originalAssetsOnly: true,
      }),
    );
  });
});
