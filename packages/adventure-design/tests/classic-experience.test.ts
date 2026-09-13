import { describe, expect, it } from "vitest";
import { auditClassicExperience, classicExperienceContractByFamily } from "../src/classic-experience.js";
import { classicAdventureCreatorProjects } from "../src/classic-game-creator-presets.js";
import type { ClassicAdventureCreatorProject } from "../src/classic-game-creator-types.js";

const mutable = (project: ClassicAdventureCreatorProject): ClassicAdventureCreatorProject =>
  structuredClone(project);

const mutableProjectAt = (index: number): ClassicAdventureCreatorProject => {
  const project = classicAdventureCreatorProjects[index];
  if (!project) {
    throw new Error(`Classic experience fixture ${index} is missing.`);
  }
  return mutable(project);
};

const firstPuzzle = (
  project: ClassicAdventureCreatorProject,
): ClassicAdventureCreatorProject["puzzles"][number] => {
  const puzzle = project.puzzles[0];
  if (!puzzle) {
    throw new Error(`Classic experience project '${project.id}' has no puzzle.`);
  }
  return puzzle;
};

describe("classic adventure experience contract", () => {
  it("keeps every flagship family ready and deterministic", () => {
    const first = classicAdventureCreatorProjects.map(auditClassicExperience);
    const second = classicAdventureCreatorProjects.map(auditClassicExperience);

    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    for (const report of first) {
      expect(report.status).toBe("ready");
      expect(report.score).toBe(100);
      expect(report.principles).toHaveLength(12);
      expect(report.principles.every((principle) => principle.passed)).toBe(true);
    }
  });

  it("defines materially different input and timing contracts", () => {
    const storybook = classicExperienceContractByFamily("storybook-icon");
    const investigation = classicExperienceContractByFamily("gothic-investigation");
    const comedy = classicExperienceContractByFamily("verb-panel-comedy");

    expect(storybook.maximumWrongActionHoldTicks).not.toBe(comedy.maximumWrongActionHoldTicks);
    expect(investigation.puzzleDoctrine).not.toBe(storybook.puzzleDoctrine);
    expect(comedy.maximumHoverCommitTicks).toBe(1);
  });

  it("blocks destructive required-item progression", () => {
    const project = mutableProjectAt(0);
    const puzzle = firstPuzzle(project);
    const broken = {
      ...project,
      puzzles: [
        {
          ...puzzle,
          irreversibleFailure: true as never,
          recovery: "No recovery.",
        },
      ],
    } as ClassicAdventureCreatorProject;

    const report = auditClassicExperience(broken);
    expect(report.status).toBe("blocked");
    expect(report.findings.map((finding) => finding.code)).toContain("unsafe-puzzle-state");
  });

  it("detects solutions introduced before their problems", () => {
    const project = mutableProjectAt(1);
    const puzzle = firstPuzzle(project);
    const broken = {
      ...project,
      puzzles: [
        {
          ...puzzle,
          steps: ["Use the key immediately.", ...puzzle.steps.slice(1)],
        },
      ],
    } as ClassicAdventureCreatorProject;

    const report = auditClassicExperience(broken);
    expect(report.status).toBe("attention");
    expect(report.findings.map((finding) => finding.code)).toContain("solution-before-problem");
  });
});
