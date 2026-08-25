import { conditionSchema, idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

const scheduleIdSchema = z.string().regex(/^world-schedule\.[A-Za-z0-9._-]+$/u);
const windowIdSchema = z.string().regex(/^world-schedule-window\.[A-Za-z0-9._-]+$/u);

export const runtimeWorldScheduleWindowSchema = z
  .object({
    id: windowIdSchema,
    startMinute: z.number().int().nonnegative(),
    endMinute: z.number().int().nonnegative(),
    days: z.array(z.number().int().positive()).optional(),
    sceneId: idSchema("scene"),
    entranceId: idSchema("entrance"),
    priority: z.number().int().default(0),
    animationState: z.string().min(1).optional(),
    when: conditionSchema.optional(),
  })
  .strict();
export type RuntimeWorldScheduleWindow = z.infer<typeof runtimeWorldScheduleWindowSchema>;

export const runtimeWorldNpcScheduleSchema = z
  .object({
    id: scheduleIdSchema,
    actorId: idSchema("actor"),
    actorInstanceId: idSchema("actor-instance"),
    windows: z.array(runtimeWorldScheduleWindowSchema).min(1),
  })
  .strict();
export type RuntimeWorldNpcSchedule = z.infer<typeof runtimeWorldNpcScheduleSchema>;

export const runtimeWorldScheduleManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    ticksPerMinute: z.number().int().positive(),
    minutesPerDay: z.number().int().positive().default(1440),
    schedules: z.array(runtimeWorldNpcScheduleSchema),
  })
  .strict();
export type RuntimeWorldScheduleManifest = z.infer<typeof runtimeWorldScheduleManifestSchema>;

export type RuntimeWorldScheduleIssueCode =
  | "duplicate-id"
  | "unknown-actor"
  | "unknown-actor-instance"
  | "actor-instance-mismatch"
  | "unknown-scene"
  | "unknown-entrance"
  | "unknown-animation-state"
  | "invalid-minute-window"
  | "ambiguous-overlap";

export interface RuntimeWorldScheduleIssue {
  readonly severity: "error";
  readonly code: RuntimeWorldScheduleIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface RuntimeWorldScheduleValidationContext {
  readonly actorsById: ReadonlyMap<string, { readonly animationStates: ReadonlySet<string> }>;
  readonly actorInstancesById: ReadonlyMap<string, { readonly actorId: string }>;
  readonly entrancesByScene: ReadonlyMap<string, ReadonlySet<string>>;
}

const windowsOverlap = (
  left: RuntimeWorldScheduleWindow,
  right: RuntimeWorldScheduleWindow,
  minutesPerDay: number,
): boolean => {
  const expand = (window: RuntimeWorldScheduleWindow): readonly [number, number][] => {
    const start = window.startMinute % minutesPerDay;
    const end = window.endMinute % minutesPerDay;
    if (start === end) return [[0, minutesPerDay]];
    return start < end ? [[start, end]] : [[start, minutesPerDay], [0, end]];
  };
  return expand(left).some(([leftStart, leftEnd]) =>
    expand(right).some(([rightStart, rightEnd]) => leftStart < rightEnd && rightStart < leftEnd),
  );
};

const daysCanOverlap = (
  left: RuntimeWorldScheduleWindow,
  right: RuntimeWorldScheduleWindow,
): boolean => {
  if (!left.days || !right.days) return true;
  return left.days.some((day) => right.days!.includes(day));
};

export const validateRuntimeWorldSchedules = (
  manifest: RuntimeWorldScheduleManifest,
  context: RuntimeWorldScheduleValidationContext,
): readonly RuntimeWorldScheduleIssue[] => {
  const issues: RuntimeWorldScheduleIssue[] = [];
  const push = (code: RuntimeWorldScheduleIssueCode, path: string, message: string): void => {
    issues.push({ severity: "error", code, path, message });
  };
  const scheduleIds = new Set<string>();
  const scheduledInstances = new Set<string>();

  manifest.schedules.forEach((schedule, scheduleIndex) => {
    const path = `schedules[${scheduleIndex}]`;
    if (scheduleIds.has(schedule.id)) push("duplicate-id", `${path}.id`, `Duplicate world schedule '${schedule.id}'.`);
    scheduleIds.add(schedule.id);
    if (scheduledInstances.has(schedule.actorInstanceId)) {
      push("duplicate-id", `${path}.actorInstanceId`, `Actor instance '${schedule.actorInstanceId}' has more than one world schedule.`);
    }
    scheduledInstances.add(schedule.actorInstanceId);

    const actor = context.actorsById.get(schedule.actorId);
    if (!actor) push("unknown-actor", `${path}.actorId`, `Unknown scheduled actor '${schedule.actorId}'.`);
    const instance = context.actorInstancesById.get(schedule.actorInstanceId);
    if (!instance) push("unknown-actor-instance", `${path}.actorInstanceId`, `Unknown scheduled actor instance '${schedule.actorInstanceId}'.`);
    else if (instance.actorId !== schedule.actorId) {
      push("actor-instance-mismatch", `${path}.actorInstanceId`, `Actor instance '${schedule.actorInstanceId}' belongs to '${instance.actorId}', not '${schedule.actorId}'.`);
    }

    const windowIds = new Set<string>();
    schedule.windows.forEach((window, windowIndex) => {
      const windowPath = `${path}.windows[${windowIndex}]`;
      if (windowIds.has(window.id)) push("duplicate-id", `${windowPath}.id`, `Duplicate schedule window '${window.id}'.`);
      windowIds.add(window.id);
      if (window.startMinute >= manifest.minutesPerDay || window.endMinute >= manifest.minutesPerDay) {
        push("invalid-minute-window", windowPath, `Schedule window '${window.id}' must stay inside a ${manifest.minutesPerDay}-minute day.`);
      }
      const entrances = context.entrancesByScene.get(window.sceneId);
      if (!entrances) push("unknown-scene", `${windowPath}.sceneId`, `Unknown schedule scene '${window.sceneId}'.`);
      else if (!entrances.has(window.entranceId)) push("unknown-entrance", `${windowPath}.entranceId`, `Scene '${window.sceneId}' has no entrance '${window.entranceId}'.`);
      if (window.animationState && actor && !actor.animationStates.has(window.animationState)) {
        push("unknown-animation-state", `${windowPath}.animationState`, `Actor '${schedule.actorId}' has no animation state '${window.animationState}'.`);
      }
    });

    for (let leftIndex = 0; leftIndex < schedule.windows.length; leftIndex += 1) {
      const left = schedule.windows[leftIndex]!;
      for (let rightIndex = leftIndex + 1; rightIndex < schedule.windows.length; rightIndex += 1) {
        const right = schedule.windows[rightIndex]!;
        if (
          left.priority === right.priority &&
          daysCanOverlap(left, right) &&
          windowsOverlap(left, right, manifest.minutesPerDay)
        ) {
          push(
            "ambiguous-overlap",
            path,
            `Schedule '${schedule.id}' windows '${left.id}' and '${right.id}' overlap at the same priority.`,
          );
        }
      }
    }
  });

  return issues.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
};

export class RuntimeWorldScheduleValidationError extends Error {
  readonly issues: readonly RuntimeWorldScheduleIssue[];

  constructor(issues: readonly RuntimeWorldScheduleIssue[]) {
    super(`Runtime world schedules are invalid (${issues.length} issue(s)).`);
    this.name = "RuntimeWorldScheduleValidationError";
    this.issues = issues;
  }
}
