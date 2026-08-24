import { idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

const rpgIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);

export const runtimeAdventureRpgStatSchema = z
  .object({
    id: rpgIdSchema,
    minimum: z.number().finite(),
    maximum: z.number().finite(),
    startingValue: z.number().finite(),
  })
  .strict();

export const runtimeAdventureRpgSkillSchema = z
  .object({
    id: rpgIdSchema,
    governingStatId: rpgIdSchema,
    minimum: z.number().finite(),
    maximum: z.number().finite(),
    startingValue: z.number().finite(),
    practiceThreshold: z.number().finite().positive(),
    practiceGain: z.number().finite().positive(),
  })
  .strict();

export const runtimeAdventureRpgResourceSchema = z
  .object({
    id: rpgIdSchema,
    minimum: z.number().finite(),
    maximum: z.number().finite(),
    startingValue: z.number().finite(),
  })
  .strict();

export const runtimeAdventureRpgClassSchema = z
  .object({
    id: rpgIdSchema,
    startingStatBonuses: z.record(rpgIdSchema, z.number().finite()).optional(),
    startingSkillBonuses: z.record(rpgIdSchema, z.number().finite()).optional(),
    startingResourceBonuses: z.record(rpgIdSchema, z.number().finite()).optional(),
    tags: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const runtimeAdventureRpgManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    classes: z.array(runtimeAdventureRpgClassSchema).min(1),
    stats: z.array(runtimeAdventureRpgStatSchema),
    skills: z.array(runtimeAdventureRpgSkillSchema),
    resources: z.array(runtimeAdventureRpgResourceSchema),
    minutesPerDay: z.number().int().positive(),
    startMinuteOfDay: z.number().int().nonnegative(),
  })
  .strict();
export type RuntimeAdventureRpgManifest = z.infer<typeof runtimeAdventureRpgManifestSchema>;

export type RuntimeAdventureRpgIssueCode =
  | "duplicate-class"
  | "duplicate-stat"
  | "duplicate-skill"
  | "duplicate-resource"
  | "invalid-range"
  | "invalid-start-time"
  | "unknown-governing-stat"
  | "unknown-bonus-target";

export interface RuntimeAdventureRpgIssue {
  readonly severity: "error";
  readonly code: RuntimeAdventureRpgIssueCode;
  readonly path: string;
  readonly message: string;
}

const duplicateIssues = (
  values: readonly { readonly id: string }[],
  code: RuntimeAdventureRpgIssueCode,
  path: string,
  label: string,
): RuntimeAdventureRpgIssue[] => {
  const seen = new Set<string>();
  const issues: RuntimeAdventureRpgIssue[] = [];
  values.forEach((value, index) => {
    if (seen.has(value.id)) {
      issues.push({ severity: "error", code, path: `${path}[${index}].id`, message: `${label} '${value.id}' is duplicated.` });
    }
    seen.add(value.id);
  });
  return issues;
};

export const validateRuntimeAdventureRpg = (
  manifest: RuntimeAdventureRpgManifest,
): readonly RuntimeAdventureRpgIssue[] => {
  const issues: RuntimeAdventureRpgIssue[] = [
    ...duplicateIssues(manifest.classes, "duplicate-class", "classes", "RPG class"),
    ...duplicateIssues(manifest.stats, "duplicate-stat", "stats", "RPG stat"),
    ...duplicateIssues(manifest.skills, "duplicate-skill", "skills", "RPG skill"),
    ...duplicateIssues(manifest.resources, "duplicate-resource", "resources", "RPG resource"),
  ];
  const statIds = new Set(manifest.stats.map((entry) => entry.id));
  const skillIds = new Set(manifest.skills.map((entry) => entry.id));
  const resourceIds = new Set(manifest.resources.map((entry) => entry.id));
  const validateRange = (
    entry: { readonly id: string; readonly minimum: number; readonly maximum: number; readonly startingValue: number },
    path: string,
  ): void => {
    if (entry.minimum > entry.maximum || entry.startingValue < entry.minimum || entry.startingValue > entry.maximum) {
      issues.push({ severity: "error", code: "invalid-range", path, message: `RPG value '${entry.id}' has an invalid range or starting value.` });
    }
  };
  manifest.stats.forEach((entry, index) => validateRange(entry, `stats[${index}]`));
  manifest.skills.forEach((entry, index) => {
    validateRange(entry, `skills[${index}]`);
    if (!statIds.has(entry.governingStatId)) {
      issues.push({ severity: "error", code: "unknown-governing-stat", path: `skills[${index}].governingStatId`, message: `Skill '${entry.id}' references unknown stat '${entry.governingStatId}'.` });
    }
  });
  manifest.resources.forEach((entry, index) => validateRange(entry, `resources[${index}]`));
  if (manifest.startMinuteOfDay >= manifest.minutesPerDay) {
    issues.push({ severity: "error", code: "invalid-start-time", path: "startMinuteOfDay", message: "RPG startMinuteOfDay must fall inside minutesPerDay." });
  }
  const validateBonusKeys = (
    values: Readonly<Record<string, number>> | undefined,
    known: ReadonlySet<string>,
    path: string,
  ): void => {
    for (const key of Object.keys(values ?? {})) {
      if (!known.has(key)) {
        issues.push({ severity: "error", code: "unknown-bonus-target", path: `${path}.${key}`, message: `Class bonus references unknown RPG value '${key}'.` });
      }
    }
  };
  manifest.classes.forEach((entry, index) => {
    validateBonusKeys(entry.startingStatBonuses, statIds, `classes[${index}].startingStatBonuses`);
    validateBonusKeys(entry.startingSkillBonuses, skillIds, `classes[${index}].startingSkillBonuses`);
    validateBonusKeys(entry.startingResourceBonuses, resourceIds, `classes[${index}].startingResourceBonuses`);
  });
  return issues.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
};

export class RuntimeAdventureRpgValidationError extends Error {
  readonly issues: readonly RuntimeAdventureRpgIssue[];

  constructor(issues: readonly RuntimeAdventureRpgIssue[]) {
    super(`Runtime adventure RPG manifest is invalid (${issues.length} issue(s)).`);
    this.name = "RuntimeAdventureRpgValidationError";
    this.issues = issues;
  }
}
