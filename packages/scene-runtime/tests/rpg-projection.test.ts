import { evaluateCondition, type RuntimeState } from "@evavo/adventure-core";
import type { RuntimeAdventureRpgManifest } from "@evavo/adventure-runtime-bundle/rpg";
import { describe, expect, it } from "vitest";
import { createAdventureRpgState, advanceAdventureRpgTime, practiceAdventureRpgSkill } from "../src/rpg.js";
import { projectAdventureRpgIntoStory } from "../src/rpg-projection.js";

const manifest: RuntimeAdventureRpgManifest = {
  manifestVersion: 1,
  projectId: "project.rpg-projection" as never,
  classes: [
    { id: "fighter", tags: ["fighter"] },
    { id: "thief", tags: ["thief", "stealth"] },
  ],
  stats: [{ id: "agility", minimum: 0, maximum: 100, startingValue: 40 }],
  skills: [{ id: "climb", governingStatId: "agility", minimum: 0, maximum: 100, startingValue: 30, practiceThreshold: 2, practiceGain: 5 }],
  resources: [{ id: "stamina", minimum: 0, maximum: 100, startingValue: 75 }],
  minutesPerDay: 1440,
  startMinuteOfDay: 480,
};

const story: RuntimeState = {
  schemaVersion: 1,
  projectId: "project.rpg-projection" as never,
  tick: 0,
  currentSceneId: "scene.town" as never,
  currentEntranceId: "entrance.town" as never,
  flags: { ordinaryFlag: true, "rpg.class-tag.old": true },
  variables: { ordinaryValue: 9, "rpg.skill.old": 99 },
  inventory: [],
  awardedScoreIds: [],
  consumedInteractionIds: [],
  consumedDialogueChoiceIds: [],
  activeDialogue: null,
  activeSequences: [],
  objectStates: {},
  randomStreams: { main: 1 },
  score: 0,
};

describe("RPG projection into generic adventure conditions", () => {
  it("projects class tags, time, stats, skills and resources while preserving ordinary story state", () => {
    const rpg = createAdventureRpgState(manifest, "thief");
    const projected = projectAdventureRpgIntoStory(manifest, rpg, story);
    expect(projected.flags.ordinaryFlag).toBe(true);
    expect(projected.flags["rpg.class-tag.thief"]).toBe(true);
    expect(projected.flags["rpg.class-tag.stealth"]).toBe(true);
    expect(projected.flags["rpg.class-tag.old"]).toBeUndefined();
    expect(projected.variables).toMatchObject({
      ordinaryValue: 9,
      "rpg.day": 1,
      "rpg.minute": 480,
      "rpg.class": "thief",
      "rpg.stat.agility": 40,
      "rpg.skill.climb": 30,
      "rpg.resource.stamina": 75,
    });
    expect(projected.variables["rpg.skill.old"]).toBeUndefined();
  });

  it("makes RPG state available to the normal condition evaluator", () => {
    let rpg = createAdventureRpgState(manifest, "thief");
    rpg = advanceAdventureRpgTime(manifest, rpg, 120);
    rpg = practiceAdventureRpgSkill(manifest, rpg, "climb", 2).state;
    const projected = projectAdventureRpgIntoStory(manifest, rpg, story);
    expect(evaluateCondition({ kind: "flag", flag: "rpg.class-tag.thief", equals: true }, projected)).toBe(true);
    expect(evaluateCondition({ kind: "variable", variable: "rpg.minute", operator: "gte", value: 600 }, projected)).toBe(true);
    expect(evaluateCondition({ kind: "variable", variable: "rpg.skill.climb", operator: "gte", value: 35 }, projected)).toBe(true);
  });
});
