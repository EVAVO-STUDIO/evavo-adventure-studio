import type { RuntimeAdventureRpgManifest } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  attachRuntimeAdventureRpg,
  canonicaliseRuntimeAdventureRpgManifest,
} from "../src/with-rpg.js";

const manifest = (): RuntimeAdventureRpgManifest => ({
  manifestVersion: 1,
  projectId: "project.rpg-compile" as never,
  minutesPerDay: 1440,
  startMinuteOfDay: 480,
  classes: [
    {
      id: "thief",
      startingStatBonuses: { agility: 10, strength: 2 },
      startingSkillBonuses: { stealth: 15, climbing: 10 },
      tags: ["subtle", "hero", "subtle"],
    },
  ],
  stats: [
    { id: "strength", minimum: 0, maximum: 100, startingValue: 30 },
    { id: "agility", minimum: 0, maximum: 100, startingValue: 30 },
  ],
  skills: [
    { id: "stealth", governingStatId: "agility", minimum: 0, maximum: 100, startingValue: 10, practiceThreshold: 2, practiceGain: 2 },
    { id: "climbing", governingStatId: "agility", minimum: 0, maximum: 100, startingValue: 10, practiceThreshold: 2, practiceGain: 3 },
  ],
  resources: [
    { id: "stamina", minimum: 0, maximum: 100, startingValue: 60 },
  ],
});

describe("RPG compiler attachment", () => {
  it("canonicalises IDs, bonus maps and class tags deterministically", () => {
    const first = canonicaliseRuntimeAdventureRpgManifest(manifest());
    const source = manifest();
    const second = canonicaliseRuntimeAdventureRpgManifest({
      ...source,
      stats: [...source.stats].reverse(),
      skills: [...source.skills].reverse(),
    });
    expect(second).toEqual(first);
    expect(first.stats.map((entry) => entry.id)).toEqual(["agility", "strength"]);
    expect(first.skills.map((entry) => entry.id)).toEqual(["climbing", "stealth"]);
    expect(first.classes[0]?.tags).toEqual(["hero", "subtle"]);
    expect(Object.keys(first.classes[0]?.startingSkillBonuses ?? {})).toEqual(["climbing", "stealth"]);
  });

  it("rejects project mismatch before bundle parsing", () => {
    const compiled = {
      bundle: { projectId: "project.other" },
      canonicalJson: "{}",
      fingerprint: "fnv1a64:0000000000000000",
      warnings: [],
    } as never;
    expect(() => attachRuntimeAdventureRpg(compiled, manifest())).toThrow(/does not match RPG project/u);
  });
});
