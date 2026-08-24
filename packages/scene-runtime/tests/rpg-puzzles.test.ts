import type { RuntimeState } from "@evavo/adventure-core";
import type { RuntimeAdventureRpgPuzzleManifest } from "@evavo/adventure-runtime-bundle/rpg-puzzles";
import type { RuntimeAdventureRpgManifest } from "@evavo/adventure-runtime-bundle/rpg";
import { describe, expect, it } from "vitest";
import { createAdventureRpgState } from "../src/rpg.js";
import {
  auditAdventureRpgPuzzleCoverage,
  resolveAdventureRpgPuzzleSolution,
} from "../src/rpg-puzzles.js";

const rpg: RuntimeAdventureRpgManifest = {
  manifestVersion: 1,
  projectId: "project.qfg-proof" as never,
  classes: [
    { id: "fighter", tags: ["fighter"] },
    { id: "thief", tags: ["thief"] },
    { id: "mage", tags: ["mage"] },
  ],
  stats: [
    { id: "strength", minimum: 0, maximum: 100, startingValue: 45 },
    { id: "agility", minimum: 0, maximum: 100, startingValue: 45 },
    { id: "magic", minimum: 0, maximum: 100, startingValue: 45 },
  ],
  skills: [
    { id: "force", governingStatId: "strength", minimum: 0, maximum: 100, startingValue: 40, practiceThreshold: 2, practiceGain: 3 },
    { id: "climb", governingStatId: "agility", minimum: 0, maximum: 100, startingValue: 40, practiceThreshold: 2, practiceGain: 3 },
    { id: "open-spell", governingStatId: "magic", minimum: 0, maximum: 100, startingValue: 40, practiceThreshold: 2, practiceGain: 3 },
  ],
  resources: [],
  minutesPerDay: 1440,
  startMinuteOfDay: 480,
};

const puzzles: RuntimeAdventureRpgPuzzleManifest = {
  manifestVersion: 1,
  projectId: "project.qfg-proof" as never,
  puzzles: [
    {
      id: "rpg-puzzle.tower-gate",
      label: "Tower gate",
      fallbackText: "That will not open the gate.",
      solutions: [
        {
          id: "rpg-solution.tower-gate.force",
          label: "Force the gate",
          classTagsAll: ["fighter"],
          classTagsAny: [],
          requiredItemIds: [],
          check: { skillId: "force", difficulty: 35 },
          practice: { skillId: "force", amount: 2 },
          actions: [{ kind: "set-flag", flag: "towerGateOpen", value: true }],
          failureText: "The gate refuses to move.",
        },
        {
          id: "rpg-solution.tower-gate.climb",
          label: "Climb over",
          classTagsAll: ["thief"],
          classTagsAny: [],
          requiredItemIds: [],
          check: { skillId: "climb", difficulty: 35 },
          practice: { skillId: "climb", amount: 2 },
          actions: [{ kind: "set-flag", flag: "towerGateBypassed", value: true }],
        },
        {
          id: "rpg-solution.tower-gate.spell",
          label: "Cast opening spell",
          classTagsAll: ["mage"],
          classTagsAny: [],
          requiredItemIds: [],
          check: { skillId: "open-spell", difficulty: 35 },
          practice: { skillId: "open-spell", amount: 2 },
          actions: [{ kind: "set-flag", flag: "towerGateOpen", value: true }],
        },
      ],
    },
  ],
};

const story = (): RuntimeState => ({
  schemaVersion: 1,
  projectId: "project.qfg-proof" as never,
  tick: 0,
  currentSceneId: "scene.gate" as never,
  currentEntranceId: "entrance.gate" as never,
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
});

describe("class-specific RPG puzzle grammar", () => {
  it("proves every playable class has an authored route through the obstacle", () => {
    expect(auditAdventureRpgPuzzleCoverage(rpg, puzzles)).toEqual([]);
  });

  it("reports a class when a puzzle loses its only class-specific route", () => {
    const broken: RuntimeAdventureRpgPuzzleManifest = {
      ...puzzles,
      puzzles: [
        {
          ...puzzles.puzzles[0]!,
          solutions: puzzles.puzzles[0]!.solutions.filter((solution) => !solution.classTagsAll.includes("mage")),
        },
      ],
    };
    expect(auditAdventureRpgPuzzleCoverage(rpg, broken)).toEqual([
      expect.objectContaining({
        code: "class-without-solution",
        puzzleId: "rpg-puzzle.tower-gate",
        classId: "mage",
      }),
    ]);
  });

  it("uses practice before the deterministic skill check and applies normal story actions", () => {
    const initial = createAdventureRpgState(rpg, "fighter");
    const result = resolveAdventureRpgPuzzleSolution(
      rpg,
      puzzles,
      story(),
      initial,
      "rpg-puzzle.tower-gate",
      "rpg-solution.tower-gate.force",
    );
    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;
    expect(result.rpg.skills.force).toBe(43);
    expect(result.story.flags.towerGateOpen).toBe(true);
    expect(result.checkMargin).toBeGreaterThanOrEqual(0);
  });

  it("rejects a solution authored for a different class", () => {
    const result = resolveAdventureRpgPuzzleSolution(
      rpg,
      puzzles,
      story(),
      createAdventureRpgState(rpg, "thief"),
      "rpg-puzzle.tower-gate",
      "rpg-solution.tower-gate.force",
    );
    expect(result).toMatchObject({ kind: "failure", reason: "class-ineligible" });
  });
});
