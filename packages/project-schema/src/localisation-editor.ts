import { z } from "zod";
import { canonicaliseLocalisationManifest } from "./localisation-authoring.js";
import { localeKey } from "./localisation-resolve.js";
import {
  type LocalisationLocale,
  type LocalisationManifest,
  localisationLocaleSchema,
  localisationManifestSchema,
  localeTagSchema,
} from "./localisation-types.js";

export class LocalisationEditorCommandError extends Error {
  readonly code:
    | "duplicate-locale"
    | "empty-batch"
    | "identity-change"
    | "missing-entry"
    | "missing-locale"
    | "protected-locale";
  readonly path: string;

  constructor(code: LocalisationEditorCommandError["code"], path: string, message: string) {
    super(message);
    this.name = "LocalisationEditorCommandError";
    this.code = code;
    this.path = path;
  }
}

export type LocalisationEditorCommand =
  | { readonly kind: "batch"; readonly commands: readonly LocalisationEditorCommand[] }
  | { readonly kind: "insert-locale"; readonly locale: LocalisationLocale }
  | { readonly kind: "remove-locale"; readonly locale: string }
  | {
      readonly kind: "replace-locale";
      readonly locale: string;
      readonly nextLocale: LocalisationLocale;
    }
  | {
      readonly kind: "set-entry-text";
      readonly locale: string;
      readonly key: string;
      readonly text: string;
    }
  | {
      readonly kind: "remove-entry";
      readonly locale: string;
      readonly key: string;
    };

export const localisationEditorCommandSchema: z.ZodType<LocalisationEditorCommand> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("batch"),
        commands: z.array(localisationEditorCommandSchema).min(1),
      })
      .strict(),
    z.object({ kind: z.literal("insert-locale"), locale: localisationLocaleSchema }).strict(),
    z.object({ kind: z.literal("remove-locale"), locale: localeTagSchema }).strict(),
    z
      .object({
        kind: z.literal("replace-locale"),
        locale: localeTagSchema,
        nextLocale: localisationLocaleSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("set-entry-text"),
        locale: localeTagSchema,
        key: z.string().min(1),
        text: z.string(),
      })
      .strict(),
    z
      .object({
        kind: z.literal("remove-entry"),
        locale: localeTagSchema,
        key: z.string().min(1),
      })
      .strict(),
  ]),
) as z.ZodType<LocalisationEditorCommand>;

export const parseLocalisationEditorCommand = (input: unknown): LocalisationEditorCommand =>
  localisationEditorCommandSchema.parse(input);

export interface AppliedLocalisationEditorCommand {
  readonly manifest: LocalisationManifest;
  readonly inverse: LocalisationEditorCommand;
}

export interface LocalisationEditorDocumentState {
  readonly manifest: LocalisationManifest;
  readonly savedManifest: LocalisationManifest;
  readonly operationRevision: number;
}

export interface LocalisationEditorHistoryEntry {
  readonly undo: LocalisationEditorCommand;
  readonly redo: LocalisationEditorCommand;
}

export interface LocalisationEditorHistoryState {
  readonly document: LocalisationEditorDocumentState;
  readonly undoStack: readonly LocalisationEditorHistoryEntry[];
  readonly redoStack: readonly LocalisationEditorHistoryEntry[];
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

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

export const canonicalLocalisationEditorJson = (value: unknown): string => {
  const output = JSON.stringify(canonicalize(value));
  if (output === undefined) {
    throw new TypeError("Localisation editor data cannot be represented as JSON.");
  }
  return output;
};

const localeIndex = (manifest: LocalisationManifest, locale: string): number =>
  manifest.locales.findIndex((candidate) => localeKey(candidate.locale) === localeKey(locale));

const requireLocale = (
  manifest: LocalisationManifest,
  locale: string,
): { readonly index: number; readonly locale: LocalisationLocale } => {
  const index = localeIndex(manifest, locale);
  const value = manifest.locales[index];
  if (index < 0 || !value) {
    throw new LocalisationEditorCommandError(
      "missing-locale",
      "locale",
      `Localisation locale '${locale}' does not exist.`,
    );
  }
  return { index, locale: value };
};

const canonicalManifest = (manifest: LocalisationManifest): LocalisationManifest =>
  localisationManifestSchema.parse(canonicaliseLocalisationManifest(manifest)) as LocalisationManifest;

const replaceLocaleAt = (
  manifest: LocalisationManifest,
  index: number,
  locale: LocalisationLocale,
): LocalisationManifest =>
  canonicalManifest({
    ...manifest,
    locales: [
      ...manifest.locales.slice(0, index).map(cloneJson),
      cloneJson(locale),
      ...manifest.locales.slice(index + 1).map(cloneJson),
    ],
  });

const assertInsertableLocale = (
  manifest: LocalisationManifest,
  locale: LocalisationLocale,
): void => {
  if (localeKey(locale.locale) === localeKey(manifest.sourceLocale)) {
    throw new LocalisationEditorCommandError(
      "protected-locale",
      "locale.locale",
      `Source locale '${manifest.sourceLocale}' cannot be inserted as a target locale.`,
    );
  }
  if (localeIndex(manifest, locale.locale) >= 0) {
    throw new LocalisationEditorCommandError(
      "duplicate-locale",
      "locale.locale",
      `Localisation locale '${locale.locale}' already exists.`,
    );
  }
  if (locale.fallbackLocale && localeKey(locale.fallbackLocale) === localeKey(locale.locale)) {
    throw new LocalisationEditorCommandError(
      "protected-locale",
      "locale.fallbackLocale",
      `Localisation locale '${locale.locale}' cannot fall back to itself.`,
    );
  }
};

export const applyLocalisationEditorCommand = (
  manifest: LocalisationManifest,
  command: LocalisationEditorCommand,
): AppliedLocalisationEditorCommand => {
  switch (command.kind) {
    case "batch": {
      if (command.commands.length === 0) {
        throw new LocalisationEditorCommandError(
          "empty-batch",
          "commands",
          "Localisation command batches cannot be empty.",
        );
      }
      let next = manifest;
      const inverses: LocalisationEditorCommand[] = [];
      for (const child of command.commands) {
        const applied = applyLocalisationEditorCommand(next, child);
        next = applied.manifest;
        inverses.unshift(applied.inverse);
      }
      return { manifest: next, inverse: { kind: "batch", commands: inverses } };
    }
    case "insert-locale": {
      const locale = localisationLocaleSchema.parse(command.locale) as LocalisationLocale;
      assertInsertableLocale(manifest, locale);
      return {
        manifest: canonicalManifest({ ...manifest, locales: [...manifest.locales, cloneJson(locale)] }),
        inverse: { kind: "remove-locale", locale: locale.locale },
      };
    }
    case "remove-locale": {
      const { index, locale } = requireLocale(manifest, command.locale);
      if (manifest.locales.length === 1) {
        throw new LocalisationEditorCommandError(
          "protected-locale",
          "locale",
          "A localisation manifest must retain at least one target locale.",
        );
      }
      const reference = manifest.locales.find(
        (candidate) =>
          candidate.fallbackLocale &&
          localeKey(candidate.fallbackLocale) === localeKey(locale.locale) &&
          localeKey(candidate.locale) !== localeKey(locale.locale),
      );
      if (reference) {
        throw new LocalisationEditorCommandError(
          "protected-locale",
          "locale",
          `Locale '${locale.locale}' is the fallback for '${reference.locale}' and cannot be removed.`,
        );
      }
      return {
        manifest: canonicalManifest({
          ...manifest,
          locales: [
            ...manifest.locales.slice(0, index).map(cloneJson),
            ...manifest.locales.slice(index + 1).map(cloneJson),
          ],
        }),
        inverse: { kind: "insert-locale", locale },
      };
    }
    case "replace-locale": {
      const { index, locale } = requireLocale(manifest, command.locale);
      const nextLocale = localisationLocaleSchema.parse(command.nextLocale) as LocalisationLocale;
      if (localeKey(locale.locale) !== localeKey(nextLocale.locale)) {
        throw new LocalisationEditorCommandError(
          "identity-change",
          "nextLocale.locale",
          `Replace commands cannot change locale '${locale.locale}' to '${nextLocale.locale}'.`,
        );
      }
      if (
        nextLocale.fallbackLocale &&
        localeKey(nextLocale.fallbackLocale) === localeKey(nextLocale.locale)
      ) {
        throw new LocalisationEditorCommandError(
          "protected-locale",
          "nextLocale.fallbackLocale",
          `Localisation locale '${nextLocale.locale}' cannot fall back to itself.`,
        );
      }
      return {
        manifest: replaceLocaleAt(manifest, index, nextLocale),
        inverse: { kind: "replace-locale", locale: locale.locale, nextLocale: locale },
      };
    }
    case "set-entry-text": {
      const { index, locale } = requireLocale(manifest, command.locale);
      const entryIndex = locale.entries.findIndex((entry) => entry.key === command.key);
      const previous = locale.entries[entryIndex];
      const entries = previous
        ? locale.entries.map((entry, candidateIndex) =>
            candidateIndex === entryIndex ? { key: command.key, text: command.text } : cloneJson(entry),
          )
        : [...locale.entries.map(cloneJson), { key: command.key, text: command.text }];
      const nextLocale = { ...locale, entries };
      return {
        manifest: replaceLocaleAt(manifest, index, nextLocale),
        inverse: previous
          ? {
              kind: "set-entry-text",
              locale: locale.locale,
              key: command.key,
              text: previous.text,
            }
          : { kind: "remove-entry", locale: locale.locale, key: command.key },
      };
    }
    case "remove-entry": {
      const { index, locale } = requireLocale(manifest, command.locale);
      const entryIndex = locale.entries.findIndex((entry) => entry.key === command.key);
      const previous = locale.entries[entryIndex];
      if (entryIndex < 0 || !previous) {
        throw new LocalisationEditorCommandError(
          "missing-entry",
          "key",
          `Localisation key '${command.key}' does not exist in '${locale.locale}'.`,
        );
      }
      return {
        manifest: replaceLocaleAt(manifest, index, {
          ...locale,
          entries: [
            ...locale.entries.slice(0, entryIndex).map(cloneJson),
            ...locale.entries.slice(entryIndex + 1).map(cloneJson),
          ],
        }),
        inverse: {
          kind: "set-entry-text",
          locale: locale.locale,
          key: previous.key,
          text: previous.text,
        },
      };
    }
  }
};

export const createLocalisationEditorDocument = (
  manifest: LocalisationManifest,
): LocalisationEditorDocumentState => {
  const snapshot = canonicalManifest(cloneJson(manifest));
  return {
    manifest: snapshot,
    savedManifest: cloneJson(snapshot),
    operationRevision: 0,
  };
};

export const isLocalisationEditorDocumentDirty = (
  document: LocalisationEditorDocumentState,
): boolean =>
  canonicalLocalisationEditorJson(document.manifest) !==
  canonicalLocalisationEditorJson(document.savedManifest);

export const createLocalisationEditorHistory = (
  manifest: LocalisationManifest,
): LocalisationEditorHistoryState => ({
  document: createLocalisationEditorDocument(manifest),
  undoStack: [],
  redoStack: [],
});

const applyToDocument = (
  document: LocalisationEditorDocumentState,
  command: LocalisationEditorCommand,
): {
  readonly document: LocalisationEditorDocumentState;
  readonly inverse: LocalisationEditorCommand;
} => {
  const applied = applyLocalisationEditorCommand(document.manifest, command);
  return {
    document: {
      ...document,
      manifest: applied.manifest,
      operationRevision: document.operationRevision + 1,
    },
    inverse: applied.inverse,
  };
};

export const executeLocalisationEditorCommand = (
  history: LocalisationEditorHistoryState,
  command: LocalisationEditorCommand,
): LocalisationEditorHistoryState => {
  const applied = applyToDocument(history.document, command);
  return {
    document: applied.document,
    undoStack: [...history.undoStack, { undo: applied.inverse, redo: cloneJson(command) }],
    redoStack: [],
  };
};

export const undoLocalisationEditorCommand = (
  history: LocalisationEditorHistoryState,
): LocalisationEditorHistoryState => {
  const entry = history.undoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(history.document, entry.undo);
  return {
    document: applied.document,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, entry],
  };
};

export const redoLocalisationEditorCommand = (
  history: LocalisationEditorHistoryState,
): LocalisationEditorHistoryState => {
  const entry = history.redoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(history.document, entry.redo);
  return {
    document: applied.document,
    undoStack: [...history.undoStack, entry],
    redoStack: history.redoStack.slice(0, -1),
  };
};

export const markLocalisationEditorHistorySaved = (
  history: LocalisationEditorHistoryState,
): LocalisationEditorHistoryState => ({
  ...history,
  document: {
    ...history.document,
    savedManifest: cloneJson(history.document.manifest),
  },
});