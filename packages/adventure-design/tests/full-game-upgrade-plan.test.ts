import { describe, expect, it } from "vitest";
import {
  adventureFullGameUpgradePlan,
  validateAdventureFullGameUpgradePlan,
} from "../src/full-game-upgrade-plan.js";

describe("full-game cross-family upgrade plan", () => {
  it("defines eight distinct implementation epics with concrete proofs", () => {
    expect(validateAdventureFullGameUpgradePlan()).toEqual([]);
    expect(adventureFullGameUpgradePlan).toHaveLength(8);
    expect(new Set(adventureFullGameUpgradePlan.map((epic) => epic.priority)).size).toBe(8);
    expect(adventureFullGameUpgradePlan.every((epic) => epic.proofScenes.length >= 3)).toBe(true);
  });

  it("prioritises scene grammar before title-specific simulation", () => {
    const scene = adventureFullGameUpgradePlan.find((epic) => epic.id === "scene-camera-elevation")!;
    const rpg = adventureFullGameUpgradePlan.find((epic) => epic.id === "rpg-simulation-kernel")!;
    expect(scene.priority).toBeLessThan(rpg.priority);
    expect(scene.unlocksReferenceGames).toEqual(
      expect.arrayContaining([
        "kings-quest-v",
        "quest-for-glory-vga",
        "day-of-the-tentacle",
        "indiana-jones-fate-of-atlantis",
      ]),
    );
  });

  it("keeps Sierra investigation, SCUMM and QFG simulation as separate engine epics", () => {
    const investigation = adventureFullGameUpgradePlan.find(
      (epic) => epic.id === "investigation-chapter-knowledge",
    )!;
    const scumm = adventureFullGameUpgradePlan.find(
      (epic) => epic.id === "scumm-sentence-object-scripting",
    )!;
    const rpg = adventureFullGameUpgradePlan.find((epic) => epic.id === "rpg-simulation-kernel")!;
    expect(investigation.capabilities).toContain("topic-dialogue");
    expect(scumm.capabilities).toContain("verb-sentence-grammar");
    expect(rpg.capabilities).toContain("real-time-combat");
    expect(rpg.capabilities).toContain("skills-and-practice");
  });

  it("uses a common specialized-mode contract for DGDS/action work", () => {
    const cinematic = adventureFullGameUpgradePlan.find(
      (epic) => epic.id === "cinematic-travel-action-modes",
    )!;
    expect(cinematic.deliverables.join(" ")).toMatch(/input, tick, render, save, outcome and return-state/u);
    expect(cinematic.capabilities).toEqual(
      expect.arrayContaining([
        "cinematic-insets",
        "travel-map",
        "vehicle-scene",
        "action-minigame",
      ]),
    );
  });

  it("does not call the engine full-game ready until all earlier epics feed the proof harness", () => {
    const harness = adventureFullGameUpgradePlan.find((epic) => epic.id === "full-game-proof-harness")!;
    expect(harness.priority).toBe(8);
    expect(harness.dependsOn).toEqual(
      expect.arrayContaining([
        "scene-camera-elevation",
        "investigation-chapter-knowledge",
        "scumm-sentence-object-scripting",
        "multi-protagonist-world-state",
        "rpg-simulation-kernel",
        "cinematic-travel-action-modes",
        "whole-game-branch-orchestration",
      ]),
    );
  });
});
