import { pointSchema } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  loadSaveGame,
  runtimeBundleFingerprint,
  type SaveGame,
  saveGameSchema,
} from "@evavo/adventure-save-game";
import { z } from "zod";

const fnvFingerprintSchema = z
  .string()
  .regex(/^fnv1a64:[0-9a-f]{16}$/u, "Expected an FNV-1a 64-bit fingerprint.");

export const replayParserInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string().min(1).max(120) }).strict(),
  z.object({ kind: z.literal("backspace") }).strict(),
  z.object({ kind: z.literal("delete-word") }).strict(),
  z.object({ kind: z.literal("history-previous") }).strict(),
  z.object({ kind: z.literal("history-next") }).strict(),
  z.object({ kind: z.literal("submit") }).strict(),
  z.object({ kind: z.literal("clear") }).strict(),
  z.object({ kind: z.literal("focus") }).strict(),
  z.object({ kind: z.literal("blur") }).strict(),
]);
export type ReplayParserInput = z.infer<typeof replayParserInputSchema>;

const replayEventFields = {
  tick: z.number().int().nonnegative(),
  sequence: z.number().int().nonnegative(),
} as const;

export const replayEventSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...replayEventFields,
      kind: z.literal("activate"),
      position: pointSchema,
    })
    .strict(),
  z
    .object({
      ...replayEventFields,
      kind: z.literal("parser-key"),
      input: replayParserInputSchema,
    })
    .strict(),
]);
export type ReplayEvent = z.infer<typeof replayEventSchema>;

const replayPayloadSchema = z
  .object({
    replayVersion: z.literal(1),
    projectId: z.string().min(1),
    bundleFingerprint: fnvFingerprintSchema,
    initialSave: saveGameSchema,
    events: z.array(replayEventSchema),
    finalTick: z.number().int().nonnegative(),
    expectedFinalSaveFingerprint: fnvFingerprintSchema.optional(),
  })
  .strict();

export const replayLogSchema = replayPayloadSchema
  .extend({ replayFingerprint: fnvFingerprintSchema })
  .strict();
export type ReplayLog = z.infer<typeof replayLogSchema>;

export type ReplayValidationIssueCode =
  | "project-mismatch"
  | "bundle-fingerprint-mismatch"
  | "initial-save-incompatible"
  | "final-tick-before-initial"
  | "event-before-initial-tick"
  | "event-after-final-tick"
  | "event-order-invalid";

export interface ReplayValidationIssue {
  readonly severity: "error";
  readonly code: ReplayValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export class ReplayIntegrityError extends Error {
  constructor() {
    super("Replay fingerprint does not match its contents.");
    this.name = "ReplayIntegrityError";
  }
}

export class ReplayCompatibilityError extends Error {
  readonly issues: readonly ReplayValidationIssue[];

  constructor(issues: readonly ReplayValidationIssue[]) {
    super(`Replay is incompatible with this runtime bundle (${issues.length} issue(s)).`);
    this.name = "ReplayCompatibilityError";
    this.issues = issues;
  }
}

export class ReplayExecutionError extends Error {
  readonly event: ReplayEvent | null;

  constructor(event: ReplayEvent | null, message: string) {
    super(message);
    this.name = "ReplayExecutionError";
    this.event = event;
  }
}

export class ReplayDivergenceError extends Error {
  readonly expectedFingerprint: string;
  readonly actualFingerprint: string;

  constructor(expectedFingerprint: string, actualFingerprint: string) {
    super(`Replay diverged: expected final save '${expectedFingerprint}', received '${actualFingerprint}'.`);
    this.name = "ReplayDivergenceError";
    this.expectedFingerprint = expectedFingerprint;
    this.actualFingerprint = actualFingerprint;
  }
}

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) => left.localeCompare(right))) {
      const child = source[key];
      if (child !== undefined) output[key] = canonicalize(child);
    }
    return output;
  }
  return value;
};

export const canonicalReplayJson = (value: unknown): string => {
  const serialized = JSON.stringify(canonicalize(value));
  if (serialized === undefined) {
    throw new TypeError("Replay data cannot be represented as JSON.");
  }
  return serialized;
};

const fnv1a64 = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
};

const replayPayload = (replay: ReplayLog): z.infer<typeof replayPayloadSchema> => ({
  replayVersion: replay.replayVersion,
  projectId: replay.projectId,
  bundleFingerprint: replay.bundleFingerprint,
  initialSave: replay.initialSave,
  events: replay.events,
  finalTick: replay.finalTick,
  ...(replay.expectedFinalSaveFingerprint
    ? { expectedFinalSaveFingerprint: replay.expectedFinalSaveFingerprint }
    : {}),
});

export const parseReplayLog = (input: unknown): ReplayLog => {
  const replay = replayLogSchema.parse(input);
  if (fnv1a64(canonicalReplayJson(replayPayload(replay))) !== replay.replayFingerprint) {
    throw new ReplayIntegrityError();
  }
  return replay;
};

const addIssue = (
  issues: ReplayValidationIssue[],
  code: ReplayValidationIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

export const validateReplayCompatibility = (
  bundle: RuntimeBundle,
  replay: ReplayLog,
): readonly ReplayValidationIssue[] => {
  const issues: ReplayValidationIssue[] = [];
  if (replay.projectId !== bundle.projectId) {
    addIssue(
      issues,
      "project-mismatch",
      "projectId",
      `Replay project '${replay.projectId}' does not match '${bundle.projectId}'.`,
    );
  }
  const fingerprint = runtimeBundleFingerprint(bundle);
  if (replay.bundleFingerprint !== fingerprint) {
    addIssue(
      issues,
      "bundle-fingerprint-mismatch",
      "bundleFingerprint",
      "Replay was recorded against a different runtime bundle.",
    );
  }
  try {
    loadSaveGame(bundle, replay.initialSave);
  } catch (error) {
    addIssue(
      issues,
      "initial-save-incompatible",
      "initialSave",
      error instanceof Error ? error.message : "Initial replay save is incompatible.",
    );
  }

  const initialTick = replay.initialSave.world.story.tick;
  if (replay.finalTick < initialTick) {
    addIssue(
      issues,
      "final-tick-before-initial",
      "finalTick",
      `Replay final tick ${replay.finalTick} precedes initial tick ${initialTick}.`,
    );
  }

  let previousTick = initialTick;
  let previousSequence = -1;
  replay.events.forEach((event, index) => {
    if (event.tick < initialTick) {
      addIssue(
        issues,
        "event-before-initial-tick",
        `events[${index}].tick`,
        `Replay event tick ${event.tick} precedes initial save tick ${initialTick}.`,
      );
    }
    if (event.tick > replay.finalTick) {
      addIssue(
        issues,
        "event-after-final-tick",
        `events[${index}].tick`,
        `Replay event tick ${event.tick} exceeds final tick ${replay.finalTick}.`,
      );
    }
    if (event.tick < previousTick || event.sequence <= previousSequence) {
      addIssue(
        issues,
        "event-order-invalid",
        `events[${index}]`,
        "Replay events must use strictly increasing sequence numbers and non-decreasing ticks.",
      );
    }
    previousTick = event.tick;
    previousSequence = event.sequence;
  });

  return issues;
};

export interface CreateReplayLogOptions {
  readonly events: readonly ReplayEvent[];
  readonly finalTick: number;
  readonly expectedFinalSaveFingerprint?: string;
}

export const createReplayLog = (
  bundle: RuntimeBundle,
  initialSaveInput: unknown,
  options: CreateReplayLogOptions,
): ReplayLog => {
  const initialSave = loadSaveGame(bundle, initialSaveInput);
  const payload = replayPayloadSchema.parse({
    replayVersion: 1,
    projectId: bundle.projectId,
    bundleFingerprint: runtimeBundleFingerprint(bundle),
    initialSave,
    events: options.events,
    finalTick: options.finalTick,
    ...(options.expectedFinalSaveFingerprint
      ? { expectedFinalSaveFingerprint: options.expectedFinalSaveFingerprint }
      : {}),
  });
  const replay = replayLogSchema.parse({
    ...payload,
    replayFingerprint: fnv1a64(canonicalReplayJson(payload)),
  });
  const issues = validateReplayCompatibility(bundle, replay);
  if (issues.length > 0) throw new ReplayCompatibilityError(issues);
  return replay;
};

export const serializeReplayLog = (replay: ReplayLog): string => `${canonicalReplayJson(replay)}\n`;

export interface ReplayRuntimeAdapter {
  restoreSaveGame(input: unknown): number;
  createFrame(tick: number): unknown;
  activate(position: { readonly x: number; readonly y: number }): void;
  handleKey(input: ReplayParserInput): boolean;
  createSaveGame(): SaveGame;
}

export interface ReplayExecutionResult {
  readonly finalSave: SaveGame;
  readonly finalSaveFingerprint: string;
  readonly eventCount: number;
  readonly finalTick: number;
}

export const executeReplay = (
  bundle: RuntimeBundle,
  replayInput: unknown,
  runtime: ReplayRuntimeAdapter,
): ReplayExecutionResult => {
  const replay = parseReplayLog(replayInput);
  const issues = validateReplayCompatibility(bundle, replay);
  if (issues.length > 0) throw new ReplayCompatibilityError(issues);

  const restoredTick = runtime.restoreSaveGame(replay.initialSave);
  if (restoredTick !== replay.initialSave.world.story.tick) {
    throw new ReplayExecutionError(
      null,
      `Replay runtime restored tick ${restoredTick}, expected ${replay.initialSave.world.story.tick}.`,
    );
  }

  let currentTick = restoredTick;
  for (const event of replay.events) {
    if (event.tick > currentTick) {
      runtime.createFrame(event.tick);
      currentTick = event.tick;
    }
    if (event.kind === "activate") {
      runtime.activate(event.position);
    } else if (!runtime.handleKey(event.input)) {
      throw new ReplayExecutionError(
        event,
        `Replay parser input '${event.input.kind}' was not handled at tick ${event.tick}.`,
      );
    }
  }
  if (replay.finalTick > currentTick) {
    runtime.createFrame(replay.finalTick);
  }

  const finalSave = runtime.createSaveGame();
  if (
    replay.expectedFinalSaveFingerprint &&
    replay.expectedFinalSaveFingerprint !== finalSave.saveFingerprint
  ) {
    throw new ReplayDivergenceError(replay.expectedFinalSaveFingerprint, finalSave.saveFingerprint);
  }

  return {
    finalSave,
    finalSaveFingerprint: finalSave.saveFingerprint,
    eventCount: replay.events.length,
    finalTick: finalSave.world.story.tick,
  };
};
