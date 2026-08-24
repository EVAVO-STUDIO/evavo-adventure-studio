import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "../src/schema.js";
import { describe, expect, it } from "vitest";
import { validateSavedAdventureRpg } from "../src/rpg-compatibility.js";

const bundle = {
  rpg: {
    manifestVersion: 1,
    projectId: "project.rpg-save",
    minutesPerDay: 1440,
    startMinuteOfDay: 480,
    classes: [{ id: "thief" }],
    stats: [{ id: "agility" }],
    skills: [{ id: "stealth" }],
    resources: [{ id: "stamina" }],
  },
} as unknown as RuntimeBundle;

const save = {
  rpg: {
    classId: "thief",
    stats: { agility: 45 },
    skills: { stealth: 32 },
    resources: { stamina: 50 },
    practice: { stealth: 1 },
    day: 2,
    minuteOfDay: 720,
  },
} as unknown as SaveGame;

describe("RPG save compatibility", () => {
  it("accepts state whose semantic IDs still exist", () => {
    expect(validateSavedAdventureRpg(bundle, save)).toEqual([]);
  });

  it("rejects stale class/stat/skill/resource IDs and invalid time", () => {
    const stale = {
      ...save,
      rpg: {
        ...save.rpg!,
        classId: "missing-class",
        stats: { missingStat: 10 },
        skills: { missingSkill: 10 },
        practice: { missingSkill: 1 },
        resources: { missingResource: 10 },
        minuteOfDay: 1440,
      },
    } as SaveGame;
    expect(validateSavedAdventureRpg(bundle, stale)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "rpg-class-missing" }),
        expect.objectContaining({ code: "rpg-stat-missing" }),
        expect.objectContaining({ code: "rpg-skill-missing" }),
        expect.objectContaining({ code: "rpg-resource-missing" }),
        expect.objectContaining({ code: "rpg-time-invalid" }),
      ]),
    );
  });

  it("rejects RPG state when the bundle no longer defines RPG systems", () => {
    expect(validateSavedAdventureRpg({} as RuntimeBundle, save)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "rpg-state-without-runtime-manifest" }),
      ]),
    );
  });
});
