import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { createAdventureRpgPackagedRuntimeControllerWithFactory } from "../src/rpg-controller.js";
import type { PackagedSessionControllerFactory } from "../src/session-controller.js";

const bundle = {
  projectId: "project.rpg-controller",
  inventoryItems: [
    { id: "item.broadsword", name: "Broadsword", description: "A balanced steel sword." },
    { id: "item.leather", name: "Leather armour", description: "Light protective armour." },
  ],
  rpg: {
    manifestVersion: 1,
    projectId: "project.rpg-controller",
    minutesPerDay: 1440,
    startMinuteOfDay: 480,
    classes: [
      {
        id: "fighter",
        startingStatBonuses: { strength: 10, agility: 5 },
        startingSkillBonuses: { weapon: 10, parry: 10 },
        tags: ["martial"],
      },
      {
        id: "thief",
        startingStatBonuses: { agility: 10 },
        startingSkillBonuses: { climbing: 20, dodge: 10 },
        tags: ["subtle"],
      },
    ],
    stats: [
      { id: "strength", minimum: 0, maximum: 100, startingValue: 30 },
      { id: "agility", minimum: 0, maximum: 100, startingValue: 30 },
    ],
    skills: [
      { id: "weapon", governingStatId: "strength", minimum: 0, maximum: 100, startingValue: 20, practiceThreshold: 3, practiceGain: 2 },
      { id: "parry", governingStatId: "agility", minimum: 0, maximum: 100, startingValue: 20, practiceThreshold: 3, practiceGain: 2 },
      { id: "dodge", governingStatId: "agility", minimum: 0, maximum: 100, startingValue: 15, practiceThreshold: 3, practiceGain: 2 },
      { id: "climbing", governingStatId: "agility", minimum: 0, maximum: 100, startingValue: 10, practiceThreshold: 2, practiceGain: 3 },
    ],
    resources: [
      { id: "health", minimum: 0, maximum: 100, startingValue: 100 },
      { id: "stamina", minimum: 0, maximum: 100, startingValue: 60 },
    ],
    combatEncounters: [
      {
        id: "training-goblin",
        healthResourceId: "health",
        staminaResourceId: "stamina",
        attackSkillId: "weapon",
        defenseSkillId: "parry",
        dodgeSkillId: "dodge",
        agilityStatId: "agility",
        attackBase: 30,
        enemy: {
          maximumHealth: 2,
          maximumStamina: 20,
          attackPower: 20,
          defensePower: 0,
          agility: 15,
          attackIntervalTicks: 10,
          telegraphTicks: 2,
          recoveryTicks: 1,
        },
        attackStaminaCost: 5,
        guardStaminaCost: 2,
        dodgeStaminaCost: 4,
        staminaRecoveryPerTick: 1,
        fleeDifficulty: 40,
        attackPractice: 1,
        defensePractice: 1,
        dodgePractice: 1,
      },
    ],
    economy: {
      manifestVersion: 1,
      projectId: "project.rpg-controller",
      currencies: [{ id: "silver", label: "Silver", startingBalance: 100 }],
      equipmentSlots: [
        { id: "weapon", label: "Weapon" },
        { id: "body", label: "Body" },
      ],
      equipment: [
        {
          id: "equipment.broadsword",
          itemId: "item.broadsword",
          slotId: "weapon",
          classTagsAny: ["martial"],
          modifiers: { attack: 8 },
        },
        {
          id: "equipment.leather",
          itemId: "item.leather",
          slotId: "body",
          classTagsAny: [],
          modifiers: { defense: 3 },
        },
      ],
      shops: [
        {
          id: "shop.smith",
          label: "Smith",
          stock: [
            {
              itemId: "item.broadsword",
              currencyId: "silver",
              buyPrice: 40,
              sellPrice: 20,
              quantity: 1,
            },
            {
              itemId: "item.leather",
              currencyId: "silver",
              buyPrice: 30,
              sellPrice: 15,
              quantity: null,
            },
          ],
        },
      ],
    },
  },
} as unknown as RuntimeBundle;

const world = {
  story: {
    schemaVersion: 1,
    projectId: "project.rpg-controller",
    tick: 0,
    currentSceneId: "scene.shop",
    currentEntranceId: "entrance.shop",
    flags: {},
    variables: {},
    inventory: [],
    awardedScoreIds: [],
    consumedInteractionIds: [],
    consumedDialogueChoiceIds: [],
    activeDialogue: null,
    activeSequences: [],
    objectStates: {},
    randomStreams: { main: 1 },
    score: 0,
  },
  actorInstances: {},
  movements: {},
  pendingObjectCommands: {},
  activeInteractionChoreographies: {},
  activeEntryChoreographies: {},
};

const unusedFactory: PackagedSessionControllerFactory = () => {
  let currentWorld = world as never;
  return {
    selection: { kind: "none", reason: "no-walkable-actor", candidates: [] } as never,
    controlledActorInstanceId: () => null,
    worldState: () => currentWorld,
    createFrame: () => ({}) as never,
    setPointer: () => undefined,
    setPressed: () => undefined,
    activate: () => undefined,
    handleKey: () => false,
    createSaveGame: () => ({
      interface: {
        controlledActorInstanceId: null,
        selectedVerbId: null,
        selectedItemId: null,
        statusText: "",
        parser: { text: "", history: [] },
      },
    }) as never,
    restoreSaveGame: (save: unknown) => {
      currentWorld = (save as { world: never }).world;
      return 0;
    },
    statusText: () => "",
    cameraState: () => null,
    parserState: () => ({ text: "", history: [] }) as never,
    drainSceneAudioCueIds: () => [],
  };
};

describe("RPG packaged session controller", () => {
  it("supports class selection, practice, checks, time, resources and import snapshots", () => {
    const controller = createAdventureRpgPackagedRuntimeControllerWithFactory(
      bundle,
      { rpgClassId: "thief" },
      unusedFactory,
    );
    expect(controller.rpgState().classId).toBe("thief");
    expect(controller.rpgState().skills.climbing).toBe(30);

    controller.practiceSkill("climbing", 2);
    expect(controller.rpgState().skills.climbing).toBe(33);
    expect(
      controller.resolveSkillCheck({ skillId: "climbing", difficulty: 30, minimumClassTag: "subtle" }).success,
    ).toBe(true);

    controller.adjustResource("stamina", -50);
    expect(controller.rpgState().resources.stamina).toBe(10);
    controller.advanceRpgTime(15 * 60);
    expect(controller.rpgState()).toMatchObject({ day: 1, minuteOfDay: 1380 });
    expect(controller.scheduleActive({ startMinute: 22 * 60, endMinute: 5 * 60 })).toBe(true);

    controller.restRpg({ minutes: 8 * 60, resourceRecovery: { stamina: 70 } });
    expect(controller.rpgState()).toMatchObject({ day: 2, minuteOfDay: 420 });
    expect(controller.rpgState().resources.stamina).toBe(80);
    expect(controller.createRpgImportSnapshot("proof-one", ["hero", "hero"]).tags).toEqual(["hero"]);
  });

  it("supports authored currency, finite stock and class-restricted equipment", () => {
    const fighter = createAdventureRpgPackagedRuntimeControllerWithFactory(
      bundle,
      { rpgClassId: "fighter" },
      unusedFactory,
    );
    expect(fighter.rpgEconomyState()?.balances.silver).toBe(100);
    expect(fighter.buyRpgItem("shop.smith", "item.broadsword").kind).toBe("success");
    expect(fighter.worldState().story.inventory).toContain("item.broadsword");
    expect(fighter.rpgEconomyState()?.balances.silver).toBe(60);
    expect(fighter.buyRpgItem("shop.smith", "item.broadsword")).toMatchObject({
      kind: "failure",
      reason: "out-of-stock",
    });
    expect(fighter.equipRpgItem("item.broadsword").kind).toBe("success");
    expect(fighter.rpgEconomyState()?.equippedBySlot.weapon).toBe("item.broadsword");
    expect(fighter.rpgEquipmentModifiers()).toEqual({ attack: 8 });

    const thief = createAdventureRpgPackagedRuntimeControllerWithFactory(
      bundle,
      { rpgClassId: "thief" },
      unusedFactory,
    );
    expect(thief.buyRpgItem("shop.smith", "item.broadsword").kind).toBe("success");
    expect(thief.equipRpgItem("item.broadsword")).toMatchObject({
      kind: "failure",
      reason: "class-restricted",
    });
  });

  it("runs authored combat by encounter id and treats active fights as save boundaries", () => {
    const controller = createAdventureRpgPackagedRuntimeControllerWithFactory(
      bundle,
      { rpgClassId: "fighter" },
      unusedFactory,
    );
    const started = controller.startCombat("training-goblin");
    expect(started.phase).toBe("active");
    expect(controller.activeCombatState()?.enemyHealth).toBe(2);
    expect(() => controller.createSaveGame()).toThrow(/disabled during active RPG combat/u);

    const events = controller.issueCombatAction("attack");
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "player-attacked" }),
        expect.objectContaining({ kind: "victory" }),
      ]),
    );
    expect(controller.activeCombatState()?.phase).toBe("victory");
    expect(controller.rpgState().resources.stamina).toBe(55);
    expect(controller.rpgState().practice.weapon).toBe(1);
    expect(controller.finishCombat()).toBe("victory");
    expect(controller.activeCombatState()).toBeNull();
  });

  it("rejects overlapping combat encounters and unknown encounter ids", () => {
    const controller = createAdventureRpgPackagedRuntimeControllerWithFactory(
      bundle,
      { rpgClassId: "fighter" },
      unusedFactory,
    );
    expect(() => controller.startCombat("missing")).toThrow(/Unknown RPG combat encounter/u);
    controller.startCombat("training-goblin");
    expect(() => controller.startCombat("training-goblin")).toThrow(/already active/u);
  });
});
