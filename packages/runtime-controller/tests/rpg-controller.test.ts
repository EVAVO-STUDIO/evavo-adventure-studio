import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { createAdventureRpgPackagedRuntimeControllerWithFactory } from "../src/rpg-controller.js";
import type { PackagedSessionControllerFactory } from "../src/session-controller.js";

const bundle = {
  projectId: "project.rpg-controller",
  rpg: {
    manifestVersion: 1,
    projectId: "project.rpg-controller",
    minutesPerDay: 1440,
    startMinuteOfDay: 480,
    classes: [
      { id: "fighter", startingStatBonuses: { strength: 10 }, startingSkillBonuses: { weapon: 10 }, tags: ["martial"] },
      { id: "thief", startingStatBonuses: { agility: 10 }, startingSkillBonuses: { climbing: 20 }, tags: ["subtle"] },
    ],
    stats: [
      { id: "strength", minimum: 0, maximum: 100, startingValue: 30 },
      { id: "agility", minimum: 0, maximum: 100, startingValue: 30 },
    ],
    skills: [
      { id: "weapon", governingStatId: "strength", minimum: 0, maximum: 100, startingValue: 20, practiceThreshold: 3, practiceGain: 2 },
      { id: "climbing", governingStatId: "agility", minimum: 0, maximum: 100, startingValue: 10, practiceThreshold: 2, practiceGain: 3 },
    ],
    resources: [
      { id: "stamina", minimum: 0, maximum: 100, startingValue: 60 },
    ],
  },
} as unknown as RuntimeBundle;

const unusedFactory: PackagedSessionControllerFactory = () =>
  ({
    controlledActorInstanceId: () => null,
    worldState: () => ({}) as never,
    createFrame: () => ({}) as never,
    setPointer: () => undefined,
    setPressed: () => undefined,
    activate: () => undefined,
    handleKey: () => false,
    createSaveGame: () => ({}) as never,
    restoreSaveGame: () => 0,
    statusText: () => "",
    cameraState: () => null,
    parserState: () => ({ text: "", history: [] }) as never,
    drainSceneAudioCueIds: () => [],
  });

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
});
