import { describe, expect, it } from "vitest";
import {
  createAdventureRpgState,
  practiceAdventureRpgSkill,
  type AdventureRpgManifest,
} from "../src/rpg.js";
import {
  advanceAdventureRpgBoundCombat,
  createAdventureRpgBoundCombatState,
  deriveAdventureRpgCombatDefinition,
  issueAdventureRpgBoundCombatAction,
  type AdventureRpgCombatBinding,
} from "../src/rpg-combat-integration.js";

const manifest: AdventureRpgManifest = {
  manifestVersion: 1,
  minutesPerDay: 1440,
  startMinuteOfDay: 480,
  classes: [
    {
      id: "fighter",
      startingStatBonuses: { strength: 10, agility: 5 },
      startingSkillBonuses: { weapon: 10, parry: 10 },
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
      practiceThreshold: 2,
      practiceGain: 2,
    },
    {
      id: "parry",
      governingStatId: "agility",
      minimum: 0,
      maximum: 100,
      startingValue: 20,
      practiceThreshold: 2,
      practiceGain: 2,
    },
    {
      id: "dodge",
      governingStatId: "agility",
      minimum: 0,
      maximum: 100,
      startingValue: 15,
      practiceThreshold: 2,
      practiceGain: 2,
    },
  ],
  resources: [
    { id: "health", minimum: 0, maximum: 100, startingValue: 80 },
    { id: "stamina", minimum: 0, maximum: 100, startingValue: 50 },
  ],
};

const binding: AdventureRpgCombatBinding = {
  id: "rpg-combat.goblin",
  healthResourceId: "health",
  staminaResourceId: "stamina",
  attackSkillId: "weapon",
  defenseSkillId: "parry",
  dodgeSkillId: "dodge",
  agilityStatId: "agility",
  enemy: {
    maximumHealth: 30,
    maximumStamina: 40,
    attackPower: 40,
    defensePower: 20,
    agility: 20,
    attackIntervalTicks: 6,
    telegraphTicks: 2,
    recoveryTicks: 1,
  },
  attackStaminaCost: 5,
  guardStaminaCost: 2,
  dodgeStaminaCost: 4,
  staminaRecoveryPerTick: 1,
  fleeDifficulty: 50,
  attackPractice: 1,
  defensePractice: 1,
  dodgePractice: 1,
};

describe("RPG-bound combat", () => {
  it("derives combat strength from trained character stats and skills", () => {
    const initial = createAdventureRpgState(manifest, "fighter");
    const before = deriveAdventureRpgCombatDefinition(manifest, initial, binding);
    const trained = practiceAdventureRpgSkill(manifest, initial, "weapon", 4).state;
    const after = deriveAdventureRpgCombatDefinition(manifest, trained, binding);
    expect(trained.skills.weapon).toBeGreaterThan(initial.skills.weapon ?? 0);
    expect(after.player.attackPower).toBeGreaterThan(before.player.attackPower);
  });

  it("writes stamina, health and practice back into the persistent RPG character", () => {
    const initial = createAdventureRpgBoundCombatState(
      manifest,
      createAdventureRpgState(manifest, "fighter"),
      binding,
    );
    const attacked = issueAdventureRpgBoundCombatAction(manifest, initial, binding, "attack");
    expect(attacked.rpg.resources.stamina).toBe(45);
    expect(attacked.rpg.practice.weapon).toBe(1);
    expect(attacked.combat.enemyHealth).toBeLessThan(binding.enemy.maximumHealth);

    const advanced = advanceAdventureRpgBoundCombat(manifest, attacked, binding, 6);
    expect(advanced.rpg.resources.health).toBeLessThan(80);
    expect(advanced.rpg.resources.stamina).toBeGreaterThanOrEqual(attacked.rpg.resources.stamina ?? 0);
  });

  it("turns player timing choices into defensive practice and deterministic outcomes", () => {
    let state = createAdventureRpgBoundCombatState(
      manifest,
      createAdventureRpgState(manifest, "fighter"),
      binding,
    );
    state = issueAdventureRpgBoundCombatAction(manifest, state, binding, "guard");
    const guarded = advanceAdventureRpgBoundCombat(manifest, state, binding, 6);
    expect(guarded.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "enemy-attacked", guarded: true, dodged: false }),
      ]),
    );
    expect(guarded.rpg.practice.parry).toBeGreaterThanOrEqual(1);

    let dodging = createAdventureRpgBoundCombatState(manifest, guarded.rpg, binding);
    dodging = issueAdventureRpgBoundCombatAction(manifest, dodging, binding, "dodge");
    const dodged = advanceAdventureRpgBoundCombat(manifest, dodging, binding, 6);
    expect(dodged.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "enemy-attacked", damage: 0, dodged: true }),
      ]),
    );
    expect(dodged.rpg.practice.dodge).toBeGreaterThanOrEqual(1);
  });
});
