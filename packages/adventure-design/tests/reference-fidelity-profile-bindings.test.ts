import { describe, expect, it } from "vitest";
import { gk1ReferenceTitlePack } from "../src/reference-fidelity-gk1.js";
import { pq1VgaReferenceTitlePack } from "../src/reference-fidelity-pq1-vga.js";
import { pq4ReferenceTitlePack } from "../src/reference-fidelity-pq4.js";
import { qfg4ReferenceTitlePack } from "../src/reference-fidelity-qfg4.js";
import { validateAdventureReferenceTitlePack } from "../src/reference-fidelity-validation.js";

const packs = [
  qfg4ReferenceTitlePack,
  gk1ReferenceTitlePack,
  pq1VgaReferenceTitlePack,
  pq4ReferenceTitlePack,
] as const;

describe("specialist title reference bindings", () => {
  it("keeps RPG, narrative investigation, early procedure and later procedure on separate profiles", () => {
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

    expect(pq1VgaReferenceTitlePack.profileId).toBe("early-procedural-icon-vga");
    expect(pq1VgaReferenceTitlePack.engineDialectId).toBe("sierra-sci1-vga");
    expect(pq1VgaReferenceTitlePack.originalProof).toMatchObject({
      title: "Night Shift",
      profileId: "early-procedural-icon-vga",
      originalAssetsOnly: true,
    });

    expect(pq4ReferenceTitlePack.profileId).toBe("procedural-investigation-vga");
    expect(pq4ReferenceTitlePack.engineDialectId).toBe("sierra-sci32-vga");
    expect(pq4ReferenceTitlePack.originalProof).toMatchObject({
      title: "Open Case",
      profileId: "procedural-investigation-vga",
      originalAssetsOnly: true,
    });

    expect(new Set(packs.map((pack) => pack.profileId)).size).toBe(4);
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
    expect(pq1VgaReferenceTitlePack.capabilities.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "temporary-icon-bar",
        "narration-feedback",
        "score-counter",
        "procedure-checks",
        "death-restart-flow",
      ]),
    );
    expect(pq1VgaReferenceTitlePack.capabilities.map((entry) => entry.id)).not.toContain(
      "case-state",
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
