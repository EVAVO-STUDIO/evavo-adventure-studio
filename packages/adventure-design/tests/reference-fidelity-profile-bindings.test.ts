import { describe, expect, it } from "vitest";
import { gk1ReferenceTitlePack } from "../src/reference-fidelity-gk1.js";
import { pq4ReferenceTitlePack } from "../src/reference-fidelity-pq4.js";
import { qfg4ReferenceTitlePack } from "../src/reference-fidelity-qfg4.js";
import { validateAdventureReferenceTitlePack } from "../src/reference-fidelity-validation.js";

const packs = [qfg4ReferenceTitlePack, gk1ReferenceTitlePack, pq4ReferenceTitlePack] as const;

describe("specialist title reference bindings", () => {
  it("keeps RPG, narrative investigation and police procedure on separate profiles", () => {
    expect(qfg4ReferenceTitlePack.profileId).toBe("gothic-rpg-vga");
    expect(qfg4ReferenceTitlePack.originalProof).toMatchObject({
      title: "The Hollow Vale",
      profileId: "gothic-rpg-vga",
      originalAssetsOnly: true,
    });

    expect(gk1ReferenceTitlePack.profileId).toBe("gothic-investigation-vga");
    expect(gk1ReferenceTitlePack.originalProof).toMatchObject({
      title: "The Red Ledger",
      profileId: "gothic-investigation-vga",
      originalAssetsOnly: true,
    });

    expect(pq4ReferenceTitlePack.profileId).toBe("procedural-investigation-vga");
    expect(pq4ReferenceTitlePack.originalProof).toMatchObject({
      title: "Open Case",
      profileId: "procedural-investigation-vga",
      originalAssetsOnly: true,
    });

    expect(new Set(packs.map((pack) => pack.profileId)).size).toBe(3);
  });

  it("accepts every specialist pack through the fail-closed pack validator", () => {
    for (const pack of packs) {
      expect(validateAdventureReferenceTitlePack(pack)).toEqual([]);
    }
  });

  it("retains distinct executable capability coverage", () => {
    expect(qfg4ReferenceTitlePack.capabilities.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "rpg-attributes",
        "class-specific-solutions",
        "health-stamina-mana",
        "combat-system",
        "day-night-schedule",
      ]),
    );
    expect(gk1ReferenceTitlePack.capabilities.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "chapter-structure",
        "topic-dialogue",
        "evidence-research",
        "portrait-conversation",
      ]),
    );
    expect(pq4ReferenceTitlePack.capabilities.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "procedure-checks",
        "evidence-chain",
        "case-state",
        "interrogation-flow",
        "procedural-failure",
      ]),
    );
  });
});
