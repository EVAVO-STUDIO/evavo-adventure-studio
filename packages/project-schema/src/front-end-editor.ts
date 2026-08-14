import { z } from "zod";
import {
  type ClassicFrontEndManifest,
  classicFrontEndManifestSchema,
} from "./front-end.js";

export const classicFrontEndMenuLabelKeySchema = z.enum([
  "newGame",
  "continueGame",
  "loadGame",
  "options",
  "credits",
  "quit",
  "quickSave",
  "back",
  "fullscreen",
]);
export type ClassicFrontEndMenuLabelKey = z.infer<typeof classicFrontEndMenuLabelKeySchema>;

export const classicFrontEndMenuVisibilityKeySchema = z.enum([
  "showContinue",
  "showLoad",
  "showOptions",
  "showCredits",
  "showQuit",
]);
export type ClassicFrontEndMenuVisibilityKey = z.infer<
  typeof classicFrontEndMenuVisibilityKeySchema
>;

export type ClassicFrontEndEditorCommand =
  | { readonly kind: "batch"; readonly commands: readonly ClassicFrontEndEditorCommand[] }
  | { readonly kind: "set-publisher-name"; readonly value: string }
  | { readonly kind: "set-presents-line"; readonly value: string }
  | {
      readonly kind: "set-splash-timing";
      readonly durationTicks: number;
      readonly skipAfterTicks: number;
    }
  | { readonly kind: "set-title-kicker"; readonly value: string }
  | {
      readonly kind: "set-menu-label";
      readonly label: ClassicFrontEndMenuLabelKey;
      readonly value: string;
    }
  | {
      readonly kind: "set-menu-visibility";
      readonly field: ClassicFrontEndMenuVisibilityKey;
      readonly value: boolean;
    }
  | { readonly kind: "set-fullscreen"; readonly value: boolean }
  | { readonly kind: "set-credits"; readonly lines: readonly string[] };

export const classicFrontEndEditorCommandSchema: z.ZodType<ClassicFrontEndEditorCommand> = z.lazy(
  () =>
    z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("batch"),
          commands: z.array(classicFrontEndEditorCommandSchema).min(1),
        })
        .strict(),
      z.object({ kind: z.literal("set-publisher-name"), value: z.string() }).strict(),
      z.object({ kind: z.literal("set-presents-line"), value: z.string() }).strict(),
      z
        .object({
          kind: z.literal("set-splash-timing"),
          durationTicks: z.number().int(),
          skipAfterTicks: z.number().int(),
        })
        .strict(),
      z.object({ kind: z.literal("set-title-kicker"), value: z.string() }).strict(),
      z
        .object({
          kind: z.literal("set-menu-label"),
          label: classicFrontEndMenuLabelKeySchema,
          value: z.string(),
        })
        .strict(),
      z
        .object({
          kind: z.literal("set-menu-visibility"),
          field: classicFrontEndMenuVisibilityKeySchema,
          value: z.boolean(),
        })
        .strict(),
      z.object({ kind: z.literal("set-fullscreen"), value: z.boolean() }).strict(),
      z
        .object({
          kind: z.literal("set-credits"),
          lines: z.array(z.string()),
        })
        .strict(),
    ]),
) as z.ZodType<ClassicFrontEndEditorCommand>;

export const parseClassicFrontEndEditorCommand = (
  input: unknown,
): ClassicFrontEndEditorCommand => classicFrontEndEditorCommandSchema.parse(input);

export interface AppliedClassicFrontEndEditorCommand {
  readonly manifest: ClassicFrontEndManifest;
  readonly inverse: ClassicFrontEndEditorCommand;
}

export interface ClassicFrontEndEditorHistoryEntry {
  readonly undo: ClassicFrontEndEditorCommand;
  readonly redo: ClassicFrontEndEditorCommand;
}

export interface ClassicFrontEndEditorHistoryState {
  readonly manifest: ClassicFrontEndManifest;
  readonly savedManifest: ClassicFrontEndManifest;
  readonly operationRevision: number;
  readonly undoStack: readonly ClassicFrontEndEditorHistoryEntry[];
  readonly redoStack: readonly ClassicFrontEndEditorHistoryEntry[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const parse = (manifest: ClassicFrontEndManifest): ClassicFrontEndManifest =>
  classicFrontEndManifestSchema.parse(manifest);

export const applyClassicFrontEndEditorCommand = (
  manifest: ClassicFrontEndManifest,
  command: ClassicFrontEndEditorCommand,
): AppliedClassicFrontEndEditorCommand => {
  switch (command.kind) {
    case "batch": {
      let next = manifest;
      const inverses: ClassicFrontEndEditorCommand[] = [];
      for (const child of command.commands) {
        const applied = applyClassicFrontEndEditorCommand(next, child);
        next = applied.manifest;
        inverses.unshift(applied.inverse);
      }
      return { manifest: next, inverse: { kind: "batch", commands: inverses } };
    }
    case "set-publisher-name":
      return {
        manifest: parse({
          ...manifest,
          publisher: { ...manifest.publisher, name: command.value },
        }),
        inverse: { kind: "set-publisher-name", value: manifest.publisher.name },
      };
    case "set-presents-line":
      return {
        manifest: parse({
          ...manifest,
          publisher: { ...manifest.publisher, presents: command.value },
        }),
        inverse: { kind: "set-presents-line", value: manifest.publisher.presents },
      };
    case "set-splash-timing":
      return {
        manifest: parse({
          ...manifest,
          publisher: {
            ...manifest.publisher,
            splashDurationTicks: command.durationTicks,
            splashSkipAfterTicks: command.skipAfterTicks,
          },
        }),
        inverse: {
          kind: "set-splash-timing",
          durationTicks: manifest.publisher.splashDurationTicks,
          skipAfterTicks: manifest.publisher.splashSkipAfterTicks,
        },
      };
    case "set-title-kicker":
      return {
        manifest: parse({ ...manifest, title: { kicker: command.value } }),
        inverse: { kind: "set-title-kicker", value: manifest.title.kicker },
      };
    case "set-menu-label":
      return {
        manifest: parse({
          ...manifest,
          menu: {
            ...manifest.menu,
            labels: { ...manifest.menu.labels, [command.label]: command.value },
          },
        }),
        inverse: {
          kind: "set-menu-label",
          label: command.label,
          value: manifest.menu.labels[command.label],
        },
      };
    case "set-menu-visibility":
      return {
        manifest: parse({
          ...manifest,
          menu: { ...manifest.menu, [command.field]: command.value },
        }),
        inverse: {
          kind: "set-menu-visibility",
          field: command.field,
          value: manifest.menu[command.field],
        },
      };
    case "set-fullscreen":
      return {
        manifest: parse({
          ...manifest,
          options: { allowFullscreen: command.value },
        }),
        inverse: { kind: "set-fullscreen", value: manifest.options.allowFullscreen },
      };
    case "set-credits":
      return {
        manifest: parse({
          ...manifest,
          credits: { lines: [...command.lines] },
        }),
        inverse: { kind: "set-credits", lines: [...manifest.credits.lines] },
      };
  }
};

export const createClassicFrontEndEditorHistory = (
  manifest: ClassicFrontEndManifest,
): ClassicFrontEndEditorHistoryState => {
  const snapshot = parse(clone(manifest));
  return {
    manifest: snapshot,
    savedManifest: clone(snapshot),
    operationRevision: 0,
    undoStack: [],
    redoStack: [],
  };
};

export const executeClassicFrontEndEditorCommand = (
  history: ClassicFrontEndEditorHistoryState,
  command: ClassicFrontEndEditorCommand,
): ClassicFrontEndEditorHistoryState => {
  const applied = applyClassicFrontEndEditorCommand(history.manifest, command);
  return {
    ...history,
    manifest: applied.manifest,
    operationRevision: history.operationRevision + 1,
    undoStack: [...history.undoStack, { undo: applied.inverse, redo: clone(command) }],
    redoStack: [],
  };
};

export const undoClassicFrontEndEditorCommand = (
  history: ClassicFrontEndEditorHistoryState,
): ClassicFrontEndEditorHistoryState => {
  const entry = history.undoStack.at(-1);
  if (!entry) return history;
  const applied = applyClassicFrontEndEditorCommand(history.manifest, entry.undo);
  return {
    ...history,
    manifest: applied.manifest,
    operationRevision: history.operationRevision + 1,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, entry],
  };
};

export const redoClassicFrontEndEditorCommand = (
  history: ClassicFrontEndEditorHistoryState,
): ClassicFrontEndEditorHistoryState => {
  const entry = history.redoStack.at(-1);
  if (!entry) return history;
  const applied = applyClassicFrontEndEditorCommand(history.manifest, entry.redo);
  return {
    ...history,
    manifest: applied.manifest,
    operationRevision: history.operationRevision + 1,
    undoStack: [...history.undoStack, entry],
    redoStack: history.redoStack.slice(0, -1),
  };
};

export const markClassicFrontEndEditorSaved = (
  history: ClassicFrontEndEditorHistoryState,
): ClassicFrontEndEditorHistoryState => ({
  ...history,
  savedManifest: clone(history.manifest),
});

export const isClassicFrontEndEditorDirty = (
  history: ClassicFrontEndEditorHistoryState,
): boolean => JSON.stringify(history.manifest) !== JSON.stringify(history.savedManifest);