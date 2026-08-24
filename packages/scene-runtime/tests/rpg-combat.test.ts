import { describe, expect, it } from "vitest";
import {
  advanceAdventureRpgCombat,
  createAdventureRpgCombatState,
  issueAdventureRpgCombatAction,
  type AdventureRpgCombatDefinition,
} from "../src/rpg-combat.js";

const definition: AdventureRpgCombatDefinition = {
  id: "combat.goblin-road",
  player: {
    maximumHealth: 60,
    maximumStamina: 40,
    attackPower: 18,
    defensePower: 10,
    agility: 35,
  },
  enemy: {
    maximumHealth: 36,
    maximumStamina: 30,
    attackPower: 14,
    defensePower: 7,
    agility: 20,
    attackIntervalTicks: 12,
    telegraphTicks: 4,
    recoveryTicks: 3,
  },
  attackStaminaCost: 8,
  dodgeStaminaCost: 6,
  guardStaminaCost: 4,
  staminaRecoveryPerTick: 1,
  fleeDifficulty: 40,
};

describe("deterministic RPG combat mode", () => {
  it("telegraphs enemy attacks and guarding reduces incoming damage", () => {
    let state = createAdventureRpgCombatState(definition);
    let advanced = advanceAdventureRpgCombat(definition, state, 8);
    expect(advanced.events).toContainEqual({ kind: "enemy-telegraph" });
    state = issueAdventureRpgCombatAction(definition, advanced.state, "guard").state;
    advanced = advanceAdventureRpgCombat(definition, state, 4);
    const attack = advanced.events.find((event) => event.kind === "enemy-attacked");
    expect(attack).toMatchObject({ kind: "enemy-attacked", guarded: true, dodged: false });
    if (attack?.kind !== "enemy-attacked") return;
    expect(attack.damage).toBeLessThan(14);
  });

  it("allows a timed dodge to avoid a telegraphed attack completely", () => {
    let state = advanceAdventureRpgCombat(definition, createAdventureRpgCombatState(definition), 8).state;
    state = issueAdventureRpgCombatAction(definition, state, "dodge").state;
    const advanced = advanceAdventureRpgCombat(definition, state, 4);
    expect(advanced.events).toContainEqual({
      kind: "enemy-attacked",
      damage: 0,
      guarded: false,
      dodged: true,
    });
    expect(advanced.state.playerHealth).toBe(definition.player.maximumHealth);
  });

  it("uses stamina and recovery windows for player attacks", () => {
    const initial = createAdventureRpgCombatState(definition);
    const first = issueAdventureRpgCombatAction(definition, initial, "attack");
    expect(first.events[0]).toMatchObject({ kind: "player-attacked" });
    expect(first.state.playerStamina).toBe(32);
    const blocked = issueAdventureRpgCombatAction(definition, first.state, "attack");
    expect(blocked.state).toBe(first.state);
    const recovered = advanceAdventureRpgCombat(definition, first.state, 6).state;
    const second = issueAdventureRpgCombatAction(definition, recovered, "attack");
    expect(second.events[0]).toMatchObject({ kind: "player-attacked" });
  });

  it("supports agility/stamina-gated flee outcomes", () => {
    const state = createAdventureRpgCombatState(definition);
    const escaped = issueAdventureRpgCombatAction(definition, state, "flee");
    expect(escaped.state.phase).toBe("fled");
    expect(escaped.events).toEqual([{ kind: "player-fled" }]);
  });

  it("is deterministic for the same fixed-tick command schedule", () => {
    const run = () => {
      let state = createAdventureRpgCombatState(definition);
      state = issueAdventureRpgCombatAction(definition, state, "attack").state;
      state = advanceAdventureRpgCombat(definition, state, 8).state;
      state = issueAdventureRpgCombatAction(definition, state, "guard").state;
      state = advanceAdventureRpgCombat(definition, state, 10).state;
      state = issueAdventureRpgCombatAction(definition, state, "attack").state;
      return advanceAdventureRpgCombat(definition, state, 20).state;
    };
    expect(run()).toEqual(run());
  });
});
