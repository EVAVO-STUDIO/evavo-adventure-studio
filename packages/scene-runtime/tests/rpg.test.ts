import { describe, expect, it } from "vitest";
import {
  adventureRpgScheduleActive,
  createAdventureRpgImportSnapshot,
  createAdventureRpgState,
  practiceAdventureRpgSkill,
  resolveAdventureRpgCheck,
  restAdventureRpg,
  type AdventureRpgManifest,
} from "../src/rpg.js";

const manifest: AdventureRpgManifest = {
  manifestVersion: 1,
  minutesPerDay: 1440,
  startMinuteOfDay: 8 * 60,
  classes: [
    {
      id: "fighter",
      startingStatBonuses: { strength: 15 },
      startingSkillBonuses: { weapon: 20 },
      tags: ["martial"],
    },
    {
      id: "thief",
      startingStatBonuses: { agility: 15 },
      startingSkillBonuses: { climbing: 20, stealth: 20 },
      tags: ["subtle"],
    },
    {
      id: "mage",
      startingStatBonuses: { intelligence: 15 },
      startingSkillBonuses: { magic: 20 },
      tags: ["arcane"],
    },
  ],
  stats: [
    { id: "strength", minimum: 0, maximum: 100, startingValue: 30 },
    { id: "agility", minimum: 0, maximum: 100, startingValue: 30 },
    { id: "intelligence", minimum: 0, maximum: 100, startingValue: 30 },
  ],
  skills: [
    {
      id: "weapon",
      governingStatId: "strength",
      minimum: 0,
      maximum: 100,
      startingValue: 20,
      practiceThreshold: 3,
      practiceGain: 2,
    },
    {
      id: "climbing",
      governingStatId: "agility",
      minimum: 0,
      maximum: 100,
      startingValue: 10,
      practiceThreshold: 2,
      practiceGain: 3,
    },
    {
      id: "stealth",
      governingStatId: "agility",
      minimum: 0,
      maximum: 100,
      startingValue: 10,
      practiceThreshold: 2,
      practiceGain: 2,
    },
    {
      id: "magic",
      governingStatId: "intelligence",
      minimum: 0,
      maximum: 100,
      startingValue: 0,
      practiceThreshold: 2,
      practiceGain: 3,
    },
  ],
  resources: [
    { id: "health", minimum: 0, maximum: 100, startingValue: 100 },
    { id: "stamina", minimum: 0, maximum: 100, startingValue: 60 },
    { id: "mana", minimum: 0, maximum: 100, startingValue: 20 },
  ],
};

describe("adventure RPG simulation", () => {
  it("applies class-specific starting bonuses and tags", () => {
    const fighter = createAdventureRpgState(manifest, "fighter");
    const thief = createAdventureRpgState(manifest, "thief");
    expect(fighter.stats.strength).toBe(45);
    expect(fighter.skills.weapon).toBe(40);
    expect(thief.stats.agility).toBe(45);
    expect(thief.skills.climbing).toBe(30);
  });

  it("improves skills through repeated practice rather than direct level assignment", () => {
    let state = createAdventureRpgState(manifest, "thief");
    const first = practiceAdventureRpgSkill(manifest, state, "climbing", 1);
    state = first.state;
    expect(first.improved).toBe(false);
    expect(state.practice.climbing).toBe(1);

    const second = practiceAdventureRpgSkill(manifest, state, "climbing", 1);
    expect(second.improved).toBe(true);
    expect(second.previousSkillValue).toBe(30);
    expect(second.nextSkillValue).toBe(33);
    expect(second.state.practice.climbing).toBe(0);
  });

  it("supports deterministic alternate-solution checks with class tags", () => {
    const fighter = createAdventureRpgState(manifest, "fighter");
    const thief = createAdventureRpgState(manifest, "thief");
    expect(
      resolveAdventureRpgCheck(manifest, thief, {
        skillId: "climbing",
        difficulty: 30,
        minimumClassTag: "subtle",
      }).success,
    ).toBe(true);
    expect(
      resolveAdventureRpgCheck(manifest, fighter, {
        skillId: "climbing",
        difficulty: 1,
        minimumClassTag: "subtle",
      }).success,
    ).toBe(false);
  });

  it("handles overnight schedules and rest-driven resource recovery", () => {
    const state = {
      ...createAdventureRpgState(manifest, "mage"),
      day: 2,
      minuteOfDay: 23 * 60,
      resources: { health: 70, stamina: 10, mana: 5 },
    };
    expect(
      adventureRpgScheduleActive(manifest, state, { startMinute: 22 * 60, endMinute: 5 * 60 }),
    ).toBe(true);
    const rested = restAdventureRpg(manifest, state, {
      minutes: 8 * 60,
      resourceRecovery: { health: 20, stamina: 80, mana: 30 },
    });
    expect(rested.day).toBe(3);
    expect(rested.minuteOfDay).toBe(7 * 60);
    expect(rested.resources).toEqual({ health: 90, stamina: 90, mana: 35 });
  });

  it("exports deterministic character state for sequel/import workflows", () => {
    let state = createAdventureRpgState(manifest, "thief");
    state = practiceAdventureRpgSkill(manifest, state, "stealth", 4).state;
    expect(createAdventureRpgImportSnapshot("original-proof", state, ["hero", "hero"]))
      .toMatchObject({
        sourceGameId: "original-proof",
        classId: "thief",
        tags: ["hero"],
        skills: { stealth: 34 },
      });
  });
});
