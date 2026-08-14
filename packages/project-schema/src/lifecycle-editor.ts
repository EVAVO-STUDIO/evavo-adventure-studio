import { z } from "zod";
import {
  gameLifecycleManifestSchema,
  gameLifecycleOutcomeSchema,
  type GameLifecycleManifest,
  type GameLifecycleOutcome,
} from "./lifecycle.js";

export class GameLifecycleEditorCommandError extends Error {
  readonly code:
    | "invalid-index"
    | "missing-outcome"
    | "identity-change"
    | "project-mismatch"
    | "last-outcome";
  readonly path: string;

  constructor(code: GameLifecycleEditorCommandError["code"], path: string, message: string) {
    super(message);
    this.name = "GameLifecycleEditorCommandError";
    this.code = code;
    this.path = path;
  }
}

export type GameLifecycleEditorCommand =
  | { readonly kind: "batch"; readonly commands: readonly GameLifecycleEditorCommand[] }
  | { readonly kind: "replace-manifest"; readonly manifest: GameLifecycleManifest }
  | {
      readonly kind: "insert-outcome";
      readonly index: number;
      readonly outcome: GameLifecycleOutcome;
    }
  | { readonly kind: "remove-outcome"; readonly outcomeId: string }
  | {
      readonly kind: "replace-outcome";
      readonly outcomeId: string;
      readonly outcome: GameLifecycleOutcome;
    };

export const gameLifecycleEditorCommandSchema: z.ZodType<GameLifecycleEditorCommand> = z.lazy(
  () =>
    z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("batch"),
          commands: z.array(gameLifecycleEditorCommandSchema).min(1),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-manifest"),
          manifest: gameLifecycleManifestSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-outcome"),
          index: z.number().int().nonnegative(),
          outcome: gameLifecycleOutcomeSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-outcome"),
          outcomeId: z.string().min(1),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-outcome"),
          outcomeId: z.string().min(1),
          outcome: gameLifecycleOutcomeSchema,
        })
        .strict(),
    ]),
) as z.ZodType<GameLifecycleEditorCommand>;

export const parseGameLifecycleEditorCommand = (input: unknown): GameLifecycleEditorCommand =>
  gameLifecycleEditorCommandSchema.parse(input);

export interface AppliedGameLifecycleEditorCommand {
  readonly manifest: GameLifecycleManifest;
  readonly inverse: GameLifecycleEditorCommand;
}

export interface GameLifecycleEditorHistoryEntry {
  readonly undo: GameLifecycleEditorCommand;
  readonly redo: GameLifecycleEditorCommand;
}

export interface GameLifecycleEditorHistoryState {
  readonly manifest: GameLifecycleManifest;
  readonly savedManifest: GameLifecycleManifest;
  readonly operationRevision: number;
  readonly undoStack: readonly GameLifecycleEditorHistoryEntry[];
  readonly redoStack: readonly GameLifecycleEditorHistoryEntry[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const parse = (manifest: GameLifecycleManifest): GameLifecycleManifest =>
  gameLifecycleManifestSchema.parse(manifest) as GameLifecycleManifest;

const assertProject = (expected: string, actual: string): void => {
  if (expected !== actual) {
    throw new GameLifecycleEditorCommandError(
      "project-mismatch",
      "manifest.projectId",
      `Lifecycle editor cannot change project '${expected}' to '${actual}'.`,
    );
  }
};

const outcomeIndex = (manifest: GameLifecycleManifest, outcomeId: string): number => {
  const index = manifest.outcomes.findIndex((outcome) => outcome.id === outcomeId);
  if (index < 0) {
    throw new GameLifecycleEditorCommandError(
      "missing-outcome",
      "outcomeId",
      `Lifecycle outcome '${outcomeId}' does not exist.`,
    );
  }
  return index;
};

const canonicalObject = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalObject);
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    return Object.fromEntries(
      Object.keys(source)
        .sort((left, right) => left.localeCompare(right))
        .filter((key) => source[key] !== undefined)
        .map((key) => [key, canonicalObject(source[key])]),
    );
  }
  return value;
};

export const canonicalGameLifecycleEditorJson = (value: unknown): string => {
  const json = JSON.stringify(canonicalObject(value));
  if (json === undefined) throw new TypeError("Lifecycle editor data cannot be represented as JSON.");
  return json;
};

export const applyGameLifecycleEditorCommand = (
  manifest: GameLifecycleManifest,
  command: GameLifecycleEditorCommand,
): AppliedGameLifecycleEditorCommand => {
  switch (command.kind) {
    case "batch": {
      let next = manifest;
      const inverses: GameLifecycleEditorCommand[] = [];
      for (const child of command.commands) {
        const applied = applyGameLifecycleEditorCommand(next, child);
        next = applied.manifest;
        inverses.unshift(applied.inverse);
      }
      return { manifest: next, inverse: { kind: "batch", commands: inverses } };
    }
    case "replace-manifest":
      assertProject(manifest.projectId, command.manifest.projectId);
      return {
        manifest: parse(clone(command.manifest)),
        inverse: { kind: "replace-manifest", manifest: clone(manifest) },
      };
    case "insert-outcome": {
      if (command.index > manifest.outcomes.length) {
        throw new GameLifecycleEditorCommandError(
          "invalid-index",
          "index",
          `Insert index ${command.index} is outside 0 to ${manifest.outcomes.length}.`,
        );
      }
      const outcomes = [
        ...manifest.outcomes.slice(0, command.index).map(clone),
        clone(command.outcome),
        ...manifest.outcomes.slice(command.index).map(clone),
      ];
      return {
        manifest: parse({ ...manifest, outcomes }),
        inverse: { kind: "remove-outcome", outcomeId: command.outcome.id },
      };
    }
    case "remove-outcome": {
      if (manifest.outcomes.length === 1) {
        throw new GameLifecycleEditorCommandError(
          "last-outcome",
          "outcomeId",
          "A lifecycle manifest must retain at least one outcome.",
        );
      }
      const index = outcomeIndex(manifest, command.outcomeId);
      const previous = manifest.outcomes[index];
      if (!previous) throw new Error("Lifecycle outcome index is invalid.");
      return {
        manifest: parse({
          ...manifest,
          outcomes: [
            ...manifest.outcomes.slice(0, index).map(clone),
            ...manifest.outcomes.slice(index + 1).map(clone),
          ],
        }),
        inverse: { kind: "insert-outcome", index, outcome: clone(previous) },
      };
    }
    case "replace-outcome": {
      const index = outcomeIndex(manifest, command.outcomeId);
      const previous = manifest.outcomes[index];
      if (!previous) throw new Error("Lifecycle outcome index is invalid.");
      if (command.outcomeId !== command.outcome.id) {
        throw new GameLifecycleEditorCommandError(
          "identity-change",
          "outcome.id",
          `Replace commands cannot change outcome ID '${command.outcomeId}' to '${command.outcome.id}'.`,
        );
      }
      const outcomes = manifest.outcomes.map((outcome, candidateIndex) =>
        candidateIndex === index ? clone(command.outcome) : clone(outcome),
      );
      return {
        manifest: parse({ ...manifest, outcomes }),
        inverse: {
          kind: "replace-outcome",
          outcomeId: command.outcomeId,
          outcome: clone(previous),
        },
      };
    }
  }
};

export const createGameLifecycleEditorHistory = (
  manifest: GameLifecycleManifest,
): GameLifecycleEditorHistoryState => {
  const snapshot = parse(clone(manifest));
  return {
    manifest: snapshot,
    savedManifest: clone(snapshot),
    operationRevision: 0,
    undoStack: [],
    redoStack: [],
  };
};

export const executeGameLifecycleEditorCommand = (
  history: GameLifecycleEditorHistoryState,
  command: GameLifecycleEditorCommand,
): GameLifecycleEditorHistoryState => {
  const applied = applyGameLifecycleEditorCommand(history.manifest, command);
  return {
    ...history,
    manifest: applied.manifest,
    operationRevision: history.operationRevision + 1,
    undoStack: [...history.undoStack, { undo: applied.inverse, redo: clone(command) }],
    redoStack: [],
  };
};

export const undoGameLifecycleEditorCommand = (
  history: GameLifecycleEditorHistoryState,
): GameLifecycleEditorHistoryState => {
  const entry = history.undoStack.at(-1);
  if (!entry) return history;
  const applied = applyGameLifecycleEditorCommand(history.manifest, entry.undo);
  return {
    ...history,
    manifest: applied.manifest,
    operationRevision: history.operationRevision + 1,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, entry],
  };
};

export const redoGameLifecycleEditorCommand = (
  history: GameLifecycleEditorHistoryState,
): GameLifecycleEditorHistoryState => {
  const entry = history.redoStack.at(-1);
  if (!entry) return history;
  const applied = applyGameLifecycleEditorCommand(history.manifest, entry.redo);
  return {
    ...history,
    manifest: applied.manifest,
    operationRevision: history.operationRevision + 1,
    undoStack: [...history.undoStack, entry],
    redoStack: history.redoStack.slice(0, -1),
  };
};

export const markGameLifecycleEditorSaved = (
  history: GameLifecycleEditorHistoryState,
): GameLifecycleEditorHistoryState => ({
  ...history,
  savedManifest: clone(history.manifest),
});

export const isGameLifecycleEditorDirty = (
  history: GameLifecycleEditorHistoryState,
): boolean =>
  canonicalGameLifecycleEditorJson(history.manifest) !==
  canonicalGameLifecycleEditorJson(history.savedManifest);