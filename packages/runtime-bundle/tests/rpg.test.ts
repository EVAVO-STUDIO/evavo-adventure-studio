import { describe, expect, it } from "vitest";
import {
  runtimeAdventureRpgManifestSchema,
  validateRuntimeAdventureRpg,
} from "../src/rpg.js";

const manifest = () =>
  runtimeAdventureRpgManifestSchema.parse({
    manifestVersion: 1,
    projectId: "project.rpg",
    minutesPerDay: 1440,
    startMinuteOfDay: 480,
    classes: [
      {
        id: "fighter",
        startingStatBonuses: { strength: 10, agility: 5 },
        startingSkillBonuses: { weapon: 15, parry: 10 },
        tags: ["martial"],
      },
    ],
    stats: [
      { id: "strength", minimum: 0, maximum: 100, startingValue: 30 },
      { id: "agility", minimum: 0, maximum: 100, startingValue: 25 },
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
        id: "parry",
        governingStatId: "agility",
        minimum: 0,
        maximum: 100,
        startingValue: 20,
        practiceThreshold: 3,
        practiceGain: 2,
      },
      {
        id: "dodge",
        governingStatId: "agility",
        minimum: 0,
        maximum: 100,
        startingValue: 15,
        practiceThreshold: 3,
        practiceGain: 2,
      },
    ],
    resources: [
      { id: "health", minimum: 0, maximum: 100, startingValue: 100 },
      { id: "stamina", minimum: 0, maximum: 100, startingValue: 60 },
    ],
    combatEncounters: [
      {
        id: "goblin-road",
        healthResourceId: "health",
        staminaResourceId: "stamina",
        attackSkillId: "weapon",
        defenseSkillId: "parry",
        dodgeSkillId: "dodge",
        agilityStatId: "agility",
        enemy: {
          maximumHealth: 30,
          maximumStamina: 40,
          attackPower: 35,
          defensePower: 20,
          agility: 20,
          attackIntervalTicks: 8,
          telegraphTicks: 2,
          recoveryTicks: 2,
        },
        attackStaminaCost: 5,
        guardStaminaCost: 2,
        dodgeStaminaCost: 4,
        staminaRecoveryPerTick: 1,
        fleeDifficulty: 45,
      },
    ],
  });

describe("runtime RPG manifest", () => {
  it("accepts coherent classes, skills, resources, combat encounters and day timing", () => {
    expect(validateRuntimeAdventureRpg(manifest())).toEqual([]);
    expect(manifest().combatEncounters[0]?.id).toBe("goblin-road");
  });

  it("rejects missing governing stats and unknown class bonus targets", () => {
    const invalid = manifest();
    const issues = validateRuntimeAdventureRpg({
      ...invalid,
      skills: [{ ...invalid.skills[0]!, governingStatId: "missing-stat" }, ...invalid.skills.slice(1)],
      classes: [{ ...invalid.classes[0]!, startingSkillBonuses: { missingSkill: 5 } }],
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unknown-governing-stat" }),
        expect.objectContaining({ code: "unknown-bonus-target" }),
      ]),
    );
  });

  it("rejects combat encounters with stale RPG references", () => {
    const valid = manifest();
    const combat = valid.combatEncounters[0]!;
    const issues = validateRuntimeAdventureRpg({
      ...valid,
      combatEncounters: [
        {
          ...combat,
          healthResourceId: "missing-health",
          attackSkillId: "missing-attack",
          agilityStatId: "missing-agility",
        },
      ],
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unknown-combat-resource" }),
        expect.objectContaining({ code: "unknown-combat-skill" }),
        expect.objectContaining({ code: "unknown-combat-stat" }),
      ]),
    );
  });

  it("rejects duplicated combat encounter ids", () => {
    const valid = manifest();
    expect(
      validateRuntimeAdventureRpg({
        ...valid,
        combatEncounters: [valid.combatEncounters[0]!, { ...valid.combatEncounters[0]! }],
      }),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ code: "duplicate-combat" })]));
  });

  it("rejects a start time outside the configured day", () => {
    expect(
      validateRuntimeAdventureRpg({ ...manifest(), startMinuteOfDay: 1440 }),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-start-time" })]));
  });
});
