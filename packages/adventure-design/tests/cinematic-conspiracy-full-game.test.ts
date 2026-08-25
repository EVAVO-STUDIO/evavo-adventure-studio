import { describe, expect, it } from "vitest";
import {
  cinematicConspiracyFullGameProfile,
  evaluateCinematicConspiracyFullGame,
  validateCinematicConspiracyFullGameProfile,
} from "../src/cinematic-conspiracy-full-game.js";

describe("cinematic hand-drawn conspiracy whole-game lane", () => {
  it("binds the Broken Sword / Templar-style pressure to the original Ninth Reliquary proof", () => {
    expect(cinematicConspiracyFullGameProfile).toMatchObject({
      id: "broken-sword-templar-style",
      productionProfileId: "cinematic-handdrawn-conspiracy",
      originalProofId: "the-ninth-reliquary",
    });
    expect(cinematicConspiracyFullGameProfile.required).toEqual(
      expect.arrayContaining([
        "point-click-context",
        "topic-dialogue",
        "research-investigation-loop",
        "npc-schedules",
        "travel-map",
        "room-cutaways",
        "closeup-inset",
        "production-evidence",
      ]),
    );
  });

  it("does not inherit the classic native-VGA gate", () => {
    expect(cinematicConspiracyFullGameProfile.required).not.toContain("native-vga-audit");
    expect(validateCinematicConspiracyFullGameProfile()).toEqual([]);
  });

  it("reports remaining whole-game gaps from the shared capability coverage", () => {
    const readiness = evaluateCinematicConspiracyFullGame();
    expect(readiness.requiredCount).toBe(cinematicConspiracyFullGameProfile.required.length);
    expect(readiness.ready).toBe(false);
    expect(readiness.gaps.map((gap) => gap.id)).toEqual(
      expect.arrayContaining(["npc-schedules", "travel-map"]),
    );
  });

  it("requires cross-studio creative-production evidence and deterministic NPC autonomy", () => {
    expect(cinematicConspiracyFullGameProfile.productionRules.join("\n")).toMatch(/Creative Production v3/u);
    expect(cinematicConspiracyFullGameProfile.productionRules.join("\n")).toMatch(/decoded alpha/u);
    expect(cinematicConspiracyFullGameProfile.productionRules.join("\n")).toMatch(/Independent frame regeneration is forbidden/u);
    expect(cinematicConspiracyFullGameProfile.productionRules.join("\n")).toMatch(/NPC autonomy/u);
  });
});
