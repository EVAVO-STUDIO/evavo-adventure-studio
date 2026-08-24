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
        startingStatBonuses: { strength: 10 },
        startingSkillBonuses: { weapon: 15 },
        tags: ["martial"],
      },
    ],
    stats: [
      { id: "strength", minimum: 0, maximum: 100, startingValue: 30 },
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
    ],
    resources: [
      { id: "stamina", minimum: 0, maximum: 100, startingValue: 60 },
    ],
  });

describe("runtime RPG manifest", () => {
  it("accepts coherent classes, skills, resources and day timing", () => {
    expect(validateRuntimeAdventureRpg(manifest())).toEqual([]);
  });

  it("rejects missing governing stats and unknown class bonus targets", () => {
    const invalid = manifest();
    const issues = validateRuntimeAdventureRpg({
      ...invalid,
      skills: [{ ...invalid.skills[0]!, governingStatId: "missing-stat" }],
      classes: [{ ...invalid.classes[0]!, startingSkillBonuses: { missingSkill: 5 } }],
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unknown-governing-stat" }),
        expect.objectContaining({ code: "unknown-bonus-target" }),
      ]),
    );
  });

  it("rejects a start time outside the configured day", () => {
    expect(
      validateRuntimeAdventureRpg({ ...manifest(), startMinuteOfDay: 1440 }),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-start-time" })]));
  });
});
