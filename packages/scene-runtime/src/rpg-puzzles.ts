import { applyActions, evaluateCondition, type RuntimeEvent, type RuntimeState } from "@evavo/adventure-core";
import type { RuntimeAdventureRpgPuzzleManifest, RuntimeAdventureRpgPuzzleSolution } from "@evavo/adventure-runtime-bundle/rpg-puzzles";
import type { RuntimeAdventureRpgManifest } from "@evavo/adventure-runtime-bundle/rpg";
import {
  practiceAdventureRpgSkill,
  resolveAdventureRpgCheck,
  type AdventureRpgState,
} from "./rpg.js";

const classDefinition = (manifest: RuntimeAdventureRpgManifest, classId: string) => {
  const definition = manifest.classes.find((candidate) => candidate.id === classId);
  if (!definition) throw new Error(`Unknown RPG class '${classId}'.`);
  return definition;
};

const solutionClassEligible = (
  tags: readonly string[],
  solution: RuntimeAdventureRpgPuzzleSolution,
): boolean => {
  if (solution.classTagsAll.some((tag) => !tags.includes(tag))) return false;
  if (solution.classTagsAny.length > 0 && !solution.classTagsAny.some((tag) => tags.includes(tag))) return false;
  return true;
};

export interface AdventureRpgPuzzleCoverageIssue {
  readonly severity: "error";
  readonly code: "class-without-solution";
  readonly puzzleId: string;
  readonly classId: string;
  readonly message: string;
}

export const auditAdventureRpgPuzzleCoverage = (
  rpg: RuntimeAdventureRpgManifest,
  puzzles: RuntimeAdventureRpgPuzzleManifest,
): readonly AdventureRpgPuzzleCoverageIssue[] => {
  const issues: AdventureRpgPuzzleCoverageIssue[] = [];
  for (const puzzle of puzzles.puzzles) {
    for (const playableClass of rpg.classes) {
      const tags = playableClass.tags ?? [];
      if (!puzzle.solutions.some((solution) => solutionClassEligible(tags, solution))) {
        issues.push({
          severity: "error",
          code: "class-without-solution",
          puzzleId: puzzle.id,
          classId: playableClass.id,
          message: `RPG puzzle '${puzzle.id}' has no authored solution available to class '${playableClass.id}'.`,
        });
      }
    }
  }
  return issues.sort(
    (left, right) =>
      left.puzzleId.localeCompare(right.puzzleId) || left.classId.localeCompare(right.classId),
  );
};

export type AdventureRpgPuzzleFailureReason =
  | "puzzle-missing"
  | "solution-missing"
  | "class-ineligible"
  | "item-missing"
  | "condition-failed"
  | "skill-check-failed";

export type AdventureRpgPuzzleResolution =
  | {
      readonly kind: "success";
      readonly puzzleId: string;
      readonly solutionId: string;
      readonly story: RuntimeState;
      readonly rpg: AdventureRpgState;
      readonly events: readonly RuntimeEvent[];
      readonly checkMargin: number | null;
    }
  | {
      readonly kind: "failure";
      readonly puzzleId: string;
      readonly solutionId: string | null;
      readonly reason: AdventureRpgPuzzleFailureReason;
      readonly text: string;
      readonly story: RuntimeState;
      readonly rpg: AdventureRpgState;
      readonly checkMargin: number | null;
    };

export const resolveAdventureRpgPuzzleSolution = (
  rpgManifest: RuntimeAdventureRpgManifest,
  puzzleManifest: RuntimeAdventureRpgPuzzleManifest,
  story: RuntimeState,
  rpg: AdventureRpgState,
  puzzleId: string,
  solutionId: string,
): AdventureRpgPuzzleResolution => {
  const puzzle = puzzleManifest.puzzles.find((candidate) => candidate.id === puzzleId);
  if (!puzzle) {
    return {
      kind: "failure",
      puzzleId,
      solutionId: null,
      reason: "puzzle-missing",
      text: "That obstacle is not defined.",
      story,
      rpg,
      checkMargin: null,
    };
  }
  const solution = puzzle.solutions.find((candidate) => candidate.id === solutionId);
  if (!solution) {
    return {
      kind: "failure",
      puzzleId,
      solutionId: null,
      reason: "solution-missing",
      text: puzzle.fallbackText,
      story,
      rpg,
      checkMargin: null,
    };
  }

  const playableClass = classDefinition(rpgManifest, rpg.classId);
  if (!solutionClassEligible(playableClass.tags ?? [], solution)) {
    return {
      kind: "failure",
      puzzleId,
      solutionId,
      reason: "class-ineligible",
      text: solution.failureText ?? puzzle.fallbackText,
      story,
      rpg,
      checkMargin: null,
    };
  }
  if (solution.requiredItemIds.some((itemId) => !story.inventory.includes(itemId))) {
    return {
      kind: "failure",
      puzzleId,
      solutionId,
      reason: "item-missing",
      text: solution.failureText ?? puzzle.fallbackText,
      story,
      rpg,
      checkMargin: null,
    };
  }
  if (solution.when && !evaluateCondition(solution.when, story)) {
    return {
      kind: "failure",
      puzzleId,
      solutionId,
      reason: "condition-failed",
      text: solution.failureText ?? puzzle.fallbackText,
      story,
      rpg,
      checkMargin: null,
    };
  }

  let nextRpg = rpg;
  let checkMargin: number | null = null;
  if (solution.practice) {
    nextRpg = practiceAdventureRpgSkill(
      rpgManifest,
      nextRpg,
      solution.practice.skillId,
      solution.practice.amount,
    ).state;
  }
  if (solution.check) {
    const check = resolveAdventureRpgCheck(rpgManifest, nextRpg, solution.check);
    checkMargin = check.margin;
    if (!check.success) {
      return {
        kind: "failure",
        puzzleId,
        solutionId,
        reason: "skill-check-failed",
        text: solution.failureText ?? puzzle.fallbackText,
        story,
        rpg: nextRpg,
        checkMargin,
      };
    }
  }

  const transition = applyActions(story, solution.actions);
  return {
    kind: "success",
    puzzleId,
    solutionId,
    story: transition.state,
    rpg: nextRpg,
    events: transition.events,
    checkMargin,
  };
};
