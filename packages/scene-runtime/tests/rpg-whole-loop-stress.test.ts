import type { Id } from "@evavo/adventure-project-schema";
import type {
  RuntimeAdventureRpgManifest,
} from "@evavo/adventure-runtime-bundle/rpg";
import type { RuntimeAdventureRpgPuzzleManifest } from "@evavo/adventure-runtime-bundle/rpg-puzzles";
import { describe, expect, it } from "vitest";
import {
  adjustAdventureRpgResource,
  adventureRpgScheduleActive,
  createAdventureRpgImportSnapshot,
  createAdventureRpgState,
  practiceAdventureRpgSkill,
  restAdventureRpg,
} from "../src/rpg.js";
import {
  advanceAdventureRpgBoundCombat,
  createAdventureRpgBoundCombatState,
  issueAdventureRpgBoundCombatAction,
} from "../src/rpg-combat-integration.js";
import { resolveAdventureRpgPuzzleSolution } from "../src/rpg-puzzles.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const manifest: RuntimeAdventureRpgManifest = {
  manifestVersion: 1,
  projectId: id<"project">("project.hero-valley"),
  minutesPerDay: 1440,
  startMinuteOfDay: 8 * 60,
  classes: [
    {
      id: "fighter",
      tags: ["martial"],
      startingStatBonuses: { strength: 12 },
      startingSkillBonuses: { weapon: 12, parry: 8 },
    },
    {
      id: "thief",
      tags: ["subtle"],
      startingStatBonuses: { agility: 12 },
      startingSkillBonuses: { climbing: 18, dodge: 10 },
    },
    {
      id: "mage",
      tags: ["arcane"],
      startingStatBonuses: { intelligence: 12 },
      startingSkillBonuses: { magic: 18 },
    },
  ],
  stats: [
    { id: "strength", minimum: 0, maximum: 100, startingValue: 30 },
    { id: "agility", minimum: 0, maximum: 100, startingValue: 30 },
    { id: "intelligence", minimum: 0, maximum: 100, startingValue: 30 },
  ],
  skills: [
    { id: "weapon", governingStatId: "strength", minimum: 0, maximum: 100, startingValue: 18, practiceThreshold: 3, practiceGain: 2 },
    { id: "parry", governingStatId: "agility", minimum: 0, maximum: 100, startingValue: 16, practiceThreshold: 3, practiceGain: 2 },
    { id: "dodge", governingStatId: "agility", minimum: 0, maximum: 100, startingValue: 14, practiceThreshold: 3, practiceGain: 2 },
    { id: "climbing", governingStatId: "agility", minimum: 0, maximum: 100, startingValue: 12, practiceThreshold: 2, practiceGain: 3 },
    { id: "magic", governingStatId: "intelligence", minimum: 0, maximum: 100, startingValue: 12, practiceThreshold: 2, practiceGain: 3 },
  ],
  resources: [
    { id: "health", minimum: 0, maximum: 100, startingValue: 100 },
    { id: "stamina", minimum: 0, maximum: 100, startingValue: 70 },
    { id: "mana", minimum: 0, maximum: 100, startingValue: 45 },
  ],
  combatEncounters: [
    {
      id: "encounter.training-brigand",
      healthResourceId: "health",
      staminaResourceId: "stamina",
      attackSkillId: "weapon",
      defenseSkillId: "parry",
      dodgeSkillId: "dodge",
      agilityStatId: "agility",
      attackBase: 26,
      defenseBase: 8,
      enemy: {
        maximumHealth: 24,
        maximumStamina: 30,
        attackPower: 20,
        defensePower: 8,
        agility: 20,
        attackIntervalTicks: 10,
        telegraphTicks: 3,
        recoveryTicks: 2,
      },
      attackStaminaCost: 6,
      dodgeStaminaCost: 5,
      guardStaminaCost: 3,
      staminaRecoveryPerTick: 1,
      fleeDifficulty: 55,
      attackPractice: 1,
      defensePractice: 1,
      dodgePractice: 1,
    },
  ],
};

const puzzles: RuntimeAdventureRpgPuzzleManifest = {
  manifestVersion: 1,
  projectId: manifest.projectId,
  puzzles: [
    {
      id: "rpg-puzzle.closed-aqueduct-gate",
      label: "Closed aqueduct gate",
      fallbackText: "The gate does not yield to that approach.",
      solutions: [
        {
          id: "rpg-solution.force-gate",
          label: "Force the warped gate",
          classTagsAll: ["martial"],
          classTagsAny: [],
          requiredItemIds: [],
          practice: { skillId: "weapon", amount: 3 },
          check: { skillId: "weapon", difficulty: 30 },
          actions: [
            { kind: "set-flag", flag: "aqueductGateOpen", value: true },
            { kind: "award-score", id: id<"score-award">("score.aqueduct.fighter"), points: 4 },
          ],
        },
        {
          id: "rpg-solution.climb-wall",
          label: "Climb the retaining wall",
          classTagsAll: ["subtle"],
          classTagsAny: [],
          requiredItemIds: [],
          practice: { skillId: "climbing", amount: 2 },
          check: { skillId: "climbing", difficulty: 32 },
          actions: [
            { kind: "set-flag", flag: "aqueductGateBypassed", value: true },
            { kind: "award-score", id: id<"score-award">("score.aqueduct.thief"), points: 4 },
          ],
        },
        {
          id: "rpg-solution.unseal-runes",
          label: "Unseal the old ward",
          classTagsAll: ["arcane"],
          classTagsAny: [],
          requiredItemIds: [id<"item">("item.chalk")],
          practice: { skillId: "magic", amount: 2 },
          check: { skillId: "magic", difficulty: 31 },
          actions: [
            { kind: "set-flag", flag: "aqueductWardBroken", value: true },
            { kind: "remove-item", itemId: id<"item">("item.chalk") },
            { kind: "award-score", id: id<"score-award">("score.aqueduct.mage"), points: 4 },
          ],
        },
      ],
    },
  ],
};

const baseStory = (inventory: readonly Id<"item">[] = []) => ({
  schemaVersion: 1 as const,
  projectId: manifest.projectId,
  tick: 0,
  currentSceneId: id<"scene">("scene.valley-road"),
  currentEntranceId: id<"entrance">("entrance.valley-road"),
  flags: {},
  variables: {},
  inventory,
  awardedScoreIds: [] as Id<"score-award">[],
  consumedInteractionIds: [] as Id<"interaction">[],
  consumedDialogueChoiceIds: [] as Id<"dialogue-choice">[],
  activeDialogue: null,
  activeSequences: [],
  objectStates: {},
  randomStreams: { main: 1 },
  score: 0,
});

describe("Quest-for-Glory-style whole-loop stress", () => {
  it("supports distinct class solutions to the same adventure obstacle", () => {
    const fighter = createAdventureRpgState(manifest, "fighter");
    const fighterResult = resolveAdventureRpgPuzzleSolution(
      manifest,
      puzzles,
      baseStory(),
      fighter,
      "rpg-puzzle.closed-aqueduct-gate",
      "rpg-solution.force-gate",
    );
    expect(fighterResult.kind).toBe("success");
    if (fighterResult.kind === "success") {
      expect(fighterResult.story.flags.aqueductGateOpen).toBe(true);
      expect(fighterResult.story.score).toBe(4);
      expect(fighterResult.rpg.skills.weapon).toBeGreaterThan(fighter.skills.weapon);
    }

    const thief = createAdventureRpgState(manifest, "thief");
    const thiefResult = resolveAdventureRpgPuzzleSolution(
      manifest,
      puzzles,
      baseStory(),
      thief,
      "rpg-puzzle.closed-aqueduct-gate",
      "rpg-solution.climb-wall",
    );
    expect(thiefResult.kind).toBe("success");
    if (thiefResult.kind === "success") {
      expect(thiefResult.story.flags.aqueductGateBypassed).toBe(true);
      expect(thiefResult.rpg.skills.climbing).toBeGreaterThan(thief.skills.climbing);
    }

    const mage = createAdventureRpgState(manifest, "mage");
    const missingChalk = resolveAdventureRpgPuzzleSolution(
      manifest,
      puzzles,
      baseStory(),
      mage,
      "rpg-puzzle.closed-aqueduct-gate",
      "rpg-solution.unseal-runes",
    );
    expect(missingChalk).toMatchObject({ kind: "failure", reason: "item-missing" });
    const mageResult = resolveAdventureRpgPuzzleSolution(
      manifest,
      puzzles,
      baseStory([id<"item">("item.chalk")]),
      mage,
      "rpg-puzzle.closed-aqueduct-gate",
      "rpg-solution.unseal-runes",
    );
    expect(mageResult.kind).toBe("success");
    if (mageResult.kind === "success") {
      expect(mageResult.story.flags.aqueductWardBroken).toBe(true);
      expect(mageResult.story.inventory).not.toContain("item.chalk");
    }
  });

  it("chains practice, schedule timing, resource pressure, combat, rest and import snapshot", () => {
    let rpg = createAdventureRpgState(manifest, "fighter");
    const initialWeapon = rpg.skills.weapon ?? 0;
    rpg = practiceAdventureRpgSkill(manifest, rpg, "weapon", 6).state;
    expect(rpg.skills.weapon).toBe(initialWeapon + 4);

    expect(
      adventureRpgScheduleActive(manifest, rpg, { startMinute: 8 * 60, endMinute: 12 * 60 }),
    ).toBe(true);
    rpg = adjustAdventureRpgResource(manifest, rpg, "stamina", -20);
    expect(rpg.resources.stamina).toBe(50);

    const encounter = manifest.combatEncounters[0]!;
    let bound = createAdventureRpgBoundCombatState(manifest, rpg, encounter);
    const telegraph = advanceAdventureRpgBoundCombat(manifest, bound, encounter, 7);
    bound = telegraph;
    expect(telegraph.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "enemy-telegraph" })]),
    );
    const guarded = issueAdventureRpgBoundCombatAction(manifest, bound, encounter, "guard");
    bound = guarded;
    expect(guarded.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "player-guarded" })]),
    );
    const enemyStrike = advanceAdventureRpgBoundCombat(manifest, bound, encounter, 3);
    bound = enemyStrike;
    expect(enemyStrike.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "enemy-attacked", guarded: true })]),
    );

    for (let attempt = 0; attempt < 8 && bound.combat.phase === "active"; attempt += 1) {
      const ready = advanceAdventureRpgBoundCombat(manifest, bound, encounter, 6);
      bound = ready;
      if (bound.combat.phase !== "active") break;
      bound = issueAdventureRpgBoundCombatAction(manifest, bound, encounter, "attack");
    }
    expect(bound.combat.phase).toBe("victory");
    expect(bound.rpg.practice.weapon).toBeGreaterThan(0);
    expect(bound.rpg.practice.parry).toBeGreaterThan(0);

    rpg = restAdventureRpg(manifest, bound.rpg, {
      minutes: 5 * 60,
      resourceRecovery: { health: 30, stamina: 60 },
    });
    expect(rpg.minuteOfDay).toBe(13 * 60);
    expect(rpg.resources.stamina).toBeGreaterThan(bound.rpg.resources.stamina ?? 0);
    expect(
      adventureRpgScheduleActive(manifest, rpg, { startMinute: 8 * 60, endMinute: 12 * 60 }),
    ).toBe(false);

    const snapshot = createAdventureRpgImportSnapshot("hero-valley-one", rpg, ["hero", "fighter", "hero"]);
    expect(snapshot).toMatchObject({ sourceGameId: "hero-valley-one", classId: "fighter" });
    expect(snapshot.tags).toEqual(["fighter", "hero"]);
    expect(snapshot.skills.weapon).toBe(rpg.skills.weapon);
  });
});
