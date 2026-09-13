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

  const validateRange = (
    values: Readonly<Record<string, number>>,
    definitions: readonly { readonly id: string; readonly minimum: number; readonly maximum: number }[],
    path: string,
  ): void => {
    for (const definition of definitions) {
      const value = values[definition.id];
      if (value === undefined) continue;
      if (!Number.isFinite(value) || value < definition.minimum || value > definition.maximum) {
        addSaveGameIssue(
          issues,
          "rpg-value-invalid",
          `${path}.${definition.id}`,
          `Saved RPG value '${definition.id}'=${value} is outside ${definition.minimum}–${definition.maximum}.`,
        );
      }
    }
  };
  validateRange(state.stats, manifest.stats, "rpg.stats");
  validateRange(state.skills, manifest.skills, "rpg.skills");
  validateRange(state.resources, manifest.resources, "rpg.resources");
  for (const [skillId, practice] of Object.entries(state.practice)) {
    if (!Number.isFinite(practice) || practice < 0) {
      addSaveGameIssue(
        issues,
        "rpg-value-invalid",
        `rpg.practice.${skillId}`,
        `Saved RPG practice '${skillId}' must be a non-negative finite value.`,
      );
    }
  }
  if (state.day < 1) {
    addSaveGameIssue(issues, "rpg-time-invalid", "rpg.day", "Saved RPG day must be at least 1.");
  }
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
