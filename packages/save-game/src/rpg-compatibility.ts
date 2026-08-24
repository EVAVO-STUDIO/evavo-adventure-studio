import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "./schema.js";
import { addSaveGameIssue, type SaveGameCompatibilityIssue } from "./errors.js";

export const validateSavedAdventureRpg = (
  bundle: RuntimeBundle,
  save: SaveGame,
): readonly SaveGameCompatibilityIssue[] => {
  const state = save.rpg;
  if (!state) return [];
  const issues: SaveGameCompatibilityIssue[] = [];
  const manifest = bundle.rpg;
  if (!manifest) {
    addSaveGameIssue(
      issues,
      "rpg-state-without-runtime-manifest",
      "rpg",
      "Save contains RPG state but the runtime bundle has no RPG manifest.",
    );
    return issues;
  }
  const classIds = new Set(manifest.classes.map((entry) => entry.id));
  const statIds = new Set(manifest.stats.map((entry) => entry.id));
  const skillIds = new Set(manifest.skills.map((entry) => entry.id));
  const resourceIds = new Set(manifest.resources.map((entry) => entry.id));
  if (!classIds.has(state.classId)) {
    addSaveGameIssue(issues, "rpg-class-missing", "rpg.classId", `Saved RPG class '${state.classId}' is missing.`);
  }
  const validateKeys = (
    values: Readonly<Record<string, number>>,
    known: ReadonlySet<string>,
    code: "rpg-stat-missing" | "rpg-skill-missing" | "rpg-resource-missing",
    path: string,
  ): void => {
    for (const key of Object.keys(values)) {
      if (!known.has(key)) addSaveGameIssue(issues, code, `${path}.${key}`, `Saved RPG value '${key}' is missing from the runtime manifest.`);
    }
  };
  validateKeys(state.stats, statIds, "rpg-stat-missing", "rpg.stats");
  validateKeys(state.skills, skillIds, "rpg-skill-missing", "rpg.skills");
  validateKeys(state.practice, skillIds, "rpg-skill-missing", "rpg.practice");
  validateKeys(state.resources, resourceIds, "rpg-resource-missing", "rpg.resources");
  if (state.minuteOfDay < 0 || state.minuteOfDay >= manifest.minutesPerDay) {
    addSaveGameIssue(
      issues,
      "rpg-time-invalid",
      "rpg.minuteOfDay",
      `Saved RPG minute ${state.minuteOfDay} is outside the configured day length ${manifest.minutesPerDay}.`,
    );
  }
  return issues;
};
