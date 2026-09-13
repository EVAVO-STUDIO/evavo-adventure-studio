import type { Id } from "@evavo/adventure-project-schema";

export type AdventureRpgClassId = string;
export type AdventureRpgStatId = string;
export type AdventureRpgSkillId = string;
export type AdventureRpgResourceId = string;

export interface AdventureRpgStatDefinition {
  readonly id: AdventureRpgStatId;
  readonly minimum: number;
  readonly maximum: number;
  readonly startingValue: number;
}

export interface AdventureRpgSkillDefinition {
  readonly id: AdventureRpgSkillId;
  readonly governingStatId: AdventureRpgStatId;
  readonly minimum: number;
  readonly maximum: number;
  readonly startingValue: number;
  readonly practiceThreshold: number;
  readonly practiceGain: number;
}

export interface AdventureRpgResourceDefinition {
  readonly id: AdventureRpgResourceId;
  readonly minimum: number;
  readonly maximum: number;
  readonly startingValue: number;
}

export interface AdventureRpgClassDefinition {
  readonly id: AdventureRpgClassId;
  readonly startingStatBonuses?: Readonly<Record<string, number>>;
  readonly startingSkillBonuses?: Readonly<Record<string, number>>;
  readonly startingResourceBonuses?: Readonly<Record<string, number>>;
  readonly tags?: readonly string[];
}

export interface AdventureRpgManifest {
  readonly manifestVersion: 1;
  readonly classes: readonly AdventureRpgClassDefinition[];
  readonly stats: readonly AdventureRpgStatDefinition[];
  readonly skills: readonly AdventureRpgSkillDefinition[];
  readonly resources: readonly AdventureRpgResourceDefinition[];
  readonly minutesPerDay: number;
  readonly startMinuteOfDay: number;
}

export interface AdventureRpgState {
  readonly classId: AdventureRpgClassId;
  readonly stats: Readonly<Record<string, number>>;
  readonly skills: Readonly<Record<string, number>>;
  readonly resources: Readonly<Record<string, number>>;
  readonly practice: Readonly<Record<string, number>>;
  readonly day: number;
  readonly minuteOfDay: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

const uniqueIds = (values: readonly { readonly id: string }[], label: string): void => {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.id)) throw new Error(`${label} '${value.id}' is duplicated.`);
    seen.add(value.id);
  }
};

export const validateAdventureRpgManifest = (manifest: AdventureRpgManifest): readonly string[] => {
  const issues: string[] = [];
  try {
    uniqueIds(manifest.classes, "RPG class");
    uniqueIds(manifest.stats, "RPG stat");
    uniqueIds(manifest.skills, "RPG skill");
    uniqueIds(manifest.resources, "RPG resource");
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
  if (!Number.isSafeInteger(manifest.minutesPerDay) || manifest.minutesPerDay <= 0) {
    issues.push("RPG minutesPerDay must be a positive safe integer.");
  }
  if (
    !Number.isSafeInteger(manifest.startMinuteOfDay) ||
    manifest.startMinuteOfDay < 0 ||
    manifest.startMinuteOfDay >= manifest.minutesPerDay
  ) {
    issues.push("RPG startMinuteOfDay must fall inside the configured day.");
  }
  const statIds = new Set(manifest.stats.map((stat) => stat.id));
  for (const stat of manifest.stats) {
    if (stat.minimum > stat.maximum || stat.startingValue < stat.minimum || stat.startingValue > stat.maximum) {
      issues.push(`RPG stat '${stat.id}' has invalid range/starting value.`);
    }
  }
  for (const skill of manifest.skills) {
    if (!statIds.has(skill.governingStatId)) {
      issues.push(`RPG skill '${skill.id}' references missing governing stat '${skill.governingStatId}'.`);
    }
    if (
      skill.minimum > skill.maximum ||
      skill.startingValue < skill.minimum ||
      skill.startingValue > skill.maximum ||
      !Number.isFinite(skill.practiceThreshold) ||
      skill.practiceThreshold <= 0 ||
      !Number.isFinite(skill.practiceGain) ||
      skill.practiceGain <= 0
    ) {
      issues.push(`RPG skill '${skill.id}' has invalid range/practice configuration.`);
    }
  }
  for (const resource of manifest.resources) {
    if (
      resource.minimum > resource.maximum ||
      resource.startingValue < resource.minimum ||
      resource.startingValue > resource.maximum
    ) {
      issues.push(`RPG resource '${resource.id}' has invalid range/starting value.`);
    }
  }
  return issues.sort((left, right) => left.localeCompare(right));
};

const bonusValue = (bonuses: Readonly<Record<string, number>> | undefined, id: string): number =>
  bonuses?.[id] ?? 0;

export const createAdventureRpgState = (
  manifest: AdventureRpgManifest,
  classId: AdventureRpgClassId,
): AdventureRpgState => {
  const issues = validateAdventureRpgManifest(manifest);
  if (issues.length > 0) throw new Error(issues.join("\n"));
  const classDefinition = manifest.classes.find((candidate) => candidate.id === classId);
  if (!classDefinition) throw new Error(`Unknown RPG class '${classId}'.`);
  const stats = Object.fromEntries(
    manifest.stats.map((stat) => [
      stat.id,
      clamp(
        stat.startingValue + bonusValue(classDefinition.startingStatBonuses, stat.id),
        stat.minimum,
        stat.maximum,
      ),
    ]),
  );
  const skills = Object.fromEntries(
    manifest.skills.map((skill) => [
      skill.id,
      clamp(
        skill.startingValue + bonusValue(classDefinition.startingSkillBonuses, skill.id),
        skill.minimum,
        skill.maximum,
      ),
    ]),
  );
  const resources = Object.fromEntries(
    manifest.resources.map((resource) => [
      resource.id,
      clamp(
        resource.startingValue + bonusValue(classDefinition.startingResourceBonuses, resource.id),
        resource.minimum,
        resource.maximum,
      ),
    ]),
  );
  return {
    classId,
    stats,
    skills,
    resources,
    practice: {},
    day: 1,
    minuteOfDay: manifest.startMinuteOfDay,
  };
};

const statDefinition = (manifest: AdventureRpgManifest, statId: string): AdventureRpgStatDefinition => {
  const definition = manifest.stats.find((candidate) => candidate.id === statId);
  if (!definition) throw new Error(`Unknown RPG stat '${statId}'.`);
  return definition;
};

const skillDefinition = (manifest: AdventureRpgManifest, skillId: string): AdventureRpgSkillDefinition => {
  const definition = manifest.skills.find((candidate) => candidate.id === skillId);
  if (!definition) throw new Error(`Unknown RPG skill '${skillId}'.`);
  return definition;
};

const resourceDefinition = (
  manifest: AdventureRpgManifest,
  resourceId: string,
): AdventureRpgResourceDefinition => {
  const definition = manifest.resources.find((candidate) => candidate.id === resourceId);
  if (!definition) throw new Error(`Unknown RPG resource '${resourceId}'.`);
  return definition;
};

export const advanceAdventureRpgTime = (
  manifest: AdventureRpgManifest,
  state: AdventureRpgState,
  minutes: number,
): AdventureRpgState => {
  if (!Number.isSafeInteger(minutes) || minutes < 0) {
    throw new RangeError("RPG time advancement must be a non-negative safe integer number of minutes.");
  }
  const total = state.minuteOfDay + minutes;
  return {
    ...state,
    day: state.day + Math.floor(total / manifest.minutesPerDay),
    minuteOfDay: total % manifest.minutesPerDay,
  };
};

export const adjustAdventureRpgResource = (
  manifest: AdventureRpgManifest,
  state: AdventureRpgState,
  resourceId: AdventureRpgResourceId,
  delta: number,
): AdventureRpgState => {
  const definition = resourceDefinition(manifest, resourceId);
  const current = state.resources[resourceId] ?? definition.startingValue;
  return {
    ...state,
    resources: {
      ...state.resources,
      [resourceId]: clamp(current + delta, definition.minimum, definition.maximum),
    },
  };
};

export const adjustAdventureRpgStat = (
  manifest: AdventureRpgManifest,
  state: AdventureRpgState,
  statId: AdventureRpgStatId,
  delta: number,
): AdventureRpgState => {
  const definition = statDefinition(manifest, statId);
  const current = state.stats[statId] ?? definition.startingValue;
  return {
    ...state,
    stats: {
      ...state.stats,
      [statId]: clamp(current + delta, definition.minimum, definition.maximum),
    },
  };
};

export interface AdventureRpgPracticeResult {
  readonly state: AdventureRpgState;
  readonly skillId: AdventureRpgSkillId;
  readonly previousSkillValue: number;
  readonly nextSkillValue: number;
  readonly improved: boolean;
}

export const practiceAdventureRpgSkill = (
  manifest: AdventureRpgManifest,
  state: AdventureRpgState,
  skillId: AdventureRpgSkillId,
  amount = 1,
): AdventureRpgPracticeResult => {
  if (!Number.isFinite(amount) || amount <= 0) throw new RangeError("RPG practice amount must be positive.");
  const definition = skillDefinition(manifest, skillId);
  const previousSkillValue = state.skills[skillId] ?? definition.startingValue;
  let accumulated = (state.practice[skillId] ?? 0) + amount;
  let nextSkillValue = previousSkillValue;
  while (accumulated >= definition.practiceThreshold && nextSkillValue < definition.maximum) {
    accumulated -= definition.practiceThreshold;
    nextSkillValue = clamp(
      nextSkillValue + definition.practiceGain,
      definition.minimum,
      definition.maximum,
    );
  }
  const nextState: AdventureRpgState = {
    ...state,
    skills: { ...state.skills, [skillId]: nextSkillValue },
    practice: { ...state.practice, [skillId]: accumulated },
  };
  return {
    state: nextState,
    skillId,
    previousSkillValue,
    nextSkillValue,
    improved: nextSkillValue > previousSkillValue,
  };
};

export interface AdventureRpgCheck {
  readonly skillId: AdventureRpgSkillId;
  readonly difficulty: number;
  readonly statWeight?: number;
  readonly skillWeight?: number;
  readonly minimumClassTag?: string;
}

export interface AdventureRpgCheckResult {
  readonly success: boolean;
  readonly score: number;
  readonly difficulty: number;
  readonly margin: number;
}

export const resolveAdventureRpgCheck = (
  manifest: AdventureRpgManifest,
  state: AdventureRpgState,
  check: AdventureRpgCheck,
): AdventureRpgCheckResult => {
  const skill = skillDefinition(manifest, check.skillId);
  const classDefinition = manifest.classes.find((candidate) => candidate.id === state.classId);
  if (!classDefinition) throw new Error(`Unknown RPG class '${state.classId}'.`);
  if (check.minimumClassTag && !classDefinition.tags?.includes(check.minimumClassTag)) {
    return { success: false, score: Number.NEGATIVE_INFINITY, difficulty: check.difficulty, margin: Number.NEGATIVE_INFINITY };
  }
  const stat = state.stats[skill.governingStatId] ?? 0;
  const skillValue = state.skills[skill.id] ?? 0;
  const statWeight = check.statWeight ?? 0.35;
  const skillWeight = check.skillWeight ?? 0.65;
  const score = stat * statWeight + skillValue * skillWeight;
  return {
    success: score >= check.difficulty,
    score,
    difficulty: check.difficulty,
    margin: score - check.difficulty,
  };
};

export interface AdventureRpgScheduleWindow {
  readonly startMinute: number;
  readonly endMinute: number;
  readonly days?: readonly number[];
}

export const adventureRpgScheduleActive = (
  manifest: AdventureRpgManifest,
  state: AdventureRpgState,
  window: AdventureRpgScheduleWindow,
): boolean => {
  if (window.days && !window.days.includes(state.day)) return false;
  const start = ((window.startMinute % manifest.minutesPerDay) + manifest.minutesPerDay) % manifest.minutesPerDay;
  const end = ((window.endMinute % manifest.minutesPerDay) + manifest.minutesPerDay) % manifest.minutesPerDay;
  if (start === end) return true;
  if (start < end) return state.minuteOfDay >= start && state.minuteOfDay < end;
  return state.minuteOfDay >= start || state.minuteOfDay < end;
};

export interface AdventureRpgRestRule {
  readonly minutes: number;
  readonly resourceRecovery: Readonly<Record<string, number>>;
}

export const restAdventureRpg = (
  manifest: AdventureRpgManifest,
  state: AdventureRpgState,
  rule: AdventureRpgRestRule,
): AdventureRpgState => {
  let next = advanceAdventureRpgTime(manifest, state, rule.minutes);
  for (const [resourceId, delta] of Object.entries(rule.resourceRecovery)) {
    next = adjustAdventureRpgResource(manifest, next, resourceId, delta);
  }
  return next;
};

export interface AdventureRpgImportSnapshot {
  readonly sourceGameId: string;
  readonly classId: AdventureRpgClassId;
  readonly stats: Readonly<Record<string, number>>;
  readonly skills: Readonly<Record<string, number>>;
  readonly resources: Readonly<Record<string, number>>;
  readonly tags?: readonly string[];
}

export const createAdventureRpgImportSnapshot = (
  sourceGameId: string,
  state: AdventureRpgState,
  tags: readonly string[] = [],
): AdventureRpgImportSnapshot => ({
  sourceGameId,
  classId: state.classId,
  stats: { ...state.stats },
  skills: { ...state.skills },
  resources: { ...state.resources },
  tags: [...new Set(tags)].sort((left, right) => left.localeCompare(right)),
});
