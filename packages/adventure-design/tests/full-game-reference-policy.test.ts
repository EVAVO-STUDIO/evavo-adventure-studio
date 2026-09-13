import { describe, expect, it } from "vitest";
import {
  adventureFullGameReferenceProfiles,
  evaluateAdventureFullGameReference,
  validateAdventureFullGameReferencePolicy,
} from "../src/full-game-reference-policy.js";

describe("full-game reference policy", () => {
  it("keeps the requested eight reference pressures available", () => {
    expect(validateAdventureFullGameReferencePolicy()).toEqual([]);
    expect(adventureFullGameReferenceProfiles).toHaveLength(8);
  });

  it("models Quest for Glory VGA as SCI icon interaction plus RPG systems, not parser-era input", () => {
    const qfg = adventureFullGameReferenceProfiles.find((profile) => profile.id === "quest-for-glory-vga")!;
    expect(qfg.required).toContain("verb-icon-interface");
    expect(qfg.required).not.toContain("parser-intent");
    expect(qfg.required).toEqual(
      expect.arrayContaining([
        "character-stats",
        "skills-and-practice",
        "character-classes",
        "real-time-combat",
        "time-of-day-clock",
      ]),
    );
  });

  it("still refuses full-game-ready status while required capabilities remain unproofed", () => {
    for (const profile of adventureFullGameReferenceProfiles) {
      expect(evaluateAdventureFullGameReference(profile.id).ready).toBe(false);
    }
  });
});
