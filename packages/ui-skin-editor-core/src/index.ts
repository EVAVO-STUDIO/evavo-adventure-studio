import type { BitmapFontManifest } from "@evavo/adventure-bitmap-font";
import type { AdventureProject, Id } from "@evavo/adventure-project-schema";
import {
  uiSkinManifestSchema,
  validateUiSkinManifest,
  type UiSkin,
  type UiSkinManifest,
  type UiVerb,
} from "@evavo/adventure-ui-skin";

export class UiSkinEditorCommandError extends Error {
  readonly code:
    | "invalid-index"
    | "duplicate-id"
    | "missing-entity"
    | "identity-change"
    | "empty-batch"
    | "invalid-document";
  readonly path: string;

  constructor(
    code: UiSkinEditorCommandError["code"],
    path: string,
    message: string,
  ) {
    super(message);
    this.name = "UiSkinEditorCommandError";
    this.code = code;
    this.path = path;
  }
}

export type UiSkinEditorCommand =
  | { readonly kind: "batch"; readonly commands: readonly UiSkinEditorCommand[] }
  | { readonly kind: "set-default-skin"; readonly skinId: Id<"ui-skin"> }
  | { readonly kind: "insert-skin"; readonly index: number; readonly skin: UiSkin }
  | { readonly kind: "remove-skin"; readonly skinId: Id<"ui-skin"> }
  | {
      readonly kind: "replace-skin";
      readonly skinId: Id<"ui-skin">;
      readonly skin: UiSkin;
    }
  | {
      readonly kind: "insert-verb";
      readonly skinId: Id<"ui-skin">;
      readonly index: number;
      readonly verb: UiVerb;
    }
  | {
      readonly kind: "remove-verb";
      readonly skinId: Id<"ui-skin">;
      readonly verbId: Id<"ui-verb">;
    }
  | {
      readonly kind: "replace-verb";
      readonly skinId: Id<"ui-skin">;
      readonly verbId: Id<"ui-verb">;
      readonly verb: UiVerb;
    };

export interface AppliedUiSkinEditorCommand {
  readonly manifest: UiSkinManifest;
  readonly inverse: UiSkinEditorCommand;
}

export interface UiSkinEditorDocumentState {
  readonly manifest: UiSkinManifest;
  readonly savedManifest: UiSkinManifest;
  readonly operationRevision: number;
}

export interface UiSkinEditorHistoryEntry {
  readonly undo: UiSkinEditorCommand;
  readonly redo: UiSkinEditorCommand;
}

export interface UiSkinEditorHistoryState {
  readonly document: UiSkinEditorDocumentState;
  readonly undoStack: readonly UiSkinEditorHistoryEntry[];
  readonly redoStack: readonly UiSkinEditorHistoryEntry[];
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) =>
      left.localeCompare(right),
    )) {
      const child = source[key];
      if (child !== undefined) output[key] = canonicalize(child);
    }
    return output;
  }
  return value;
};

export const canonicalUiSkinEditorJson = (value: unknown): string => {
  const output = JSON.stringify(canonicalize(value));
  if (output === undefined) {
    throw new TypeError("Interface skin editor data cannot be represented as JSON.");
  }
  return output;
};

const insertAt = <T>(
  values: readonly T[],
  index: number,
  value: T,
  path: string,
): T[] => {
  if (!Number.isSafeInteger(index) || index < 0 || index > values.length) {
    throw new UiSkinEditorCommandError(
      "invalid-index",
      path,
      `Insert index ${index} is outside 0 to ${values.length}.`,
    );
  }
  return [
    ...values.slice(0, index).map(cloneJson),
    cloneJson(value),
    ...values.slice(index).map(cloneJson),
  ];
};

const removeAt = <T>(values: readonly T[], index: number): T[] => [
  ...values.slice(0, index).map(cloneJson),
  ...values.slice(index + 1).map(cloneJson),
];

const replaceAt = <T>(values: readonly T[], index: number, value: T): T[] => [
  ...values.slice(0, index).map(cloneJson),
  cloneJson(value),
  ...values.slice(index + 1).map(cloneJson),
];

const findSkin = (
  manifest: UiSkinManifest,
  skinId: Id<"ui-skin">,
): { readonly index: number; readonly skin: UiSkin } => {
  const index = manifest.skins.findIndex((skin) => skin.id === skinId);
  if (index < 0) {
    throw new UiSkinEditorCommandError(
      "missing-entity",
      "skinId",
      `Interface skin '${skinId}' does not exist.`,
    );
  }
  const skin = manifest.skins[index];
  if (!skin) throw new Error("Interface skin index is invalid.");
  return { index, skin };
};

const findVerb = (
  skin: UiSkin,
  verbId: Id<"ui-verb">,
): { readonly index: number; readonly verb: UiVerb } => {
  const index = skin.verbs.findIndex((verb) => verb.id === verbId);
  if (index < 0) {
    throw new UiSkinEditorCommandError(
      "missing-entity",
      "verbId",
      `Interface verb '${verbId}' does not exist in skin '${skin.id}'.`,
    );
  }
  const verb = skin.verbs[index];
  if (!verb) throw new Error("Interface verb index is invalid.");
  return { index, verb };
};

const updateSkin = (
  manifest: UiSkinManifest,
  index: number,
  skin: UiSkin,
): UiSkinManifest => ({
  ...manifest,
  skins: replaceAt(manifest.skins, index, skin),
});

const assertStableIdentity = (
  expected: string,
  actual: string,
  path: string,
): void => {
  if (expected !== actual) {
    throw new UiSkinEditorCommandError(
      "identity-change",
      path,
      `Replace commands cannot change ID '${expected}' to '${actual}'.`,
    );
  }
};

const applyUnchecked = (
  manifest: UiSkinManifest,
  command: UiSkinEditorCommand,
): AppliedUiSkinEditorCommand => {
  switch (command.kind) {
    case "batch": {
      if (command.commands.length === 0) {
        throw new UiSkinEditorCommandError(
          "empty-batch",
          "commands",
          "Interface skin command batches cannot be empty.",
        );
      }
      let next = manifest;
      const inverses: UiSkinEditorCommand[] = [];
      for (const child of command.commands) {
        const applied = applyUnchecked(next, child);
        next = applied.manifest;
        inverses.unshift(applied.inverse);
      }
      return {
        manifest: next,
        inverse: { kind: "batch", commands: inverses },
      };
    }
    case "set-default-skin":
      return {
        manifest: { ...manifest, defaultSkinId: command.skinId },
        inverse: {
          kind: "set-default-skin",
          skinId: manifest.defaultSkinId,
        },
      };
    case "insert-skin": {
      if (manifest.skins.some((skin) => skin.id === command.skin.id)) {
        throw new UiSkinEditorCommandError(
          "duplicate-id",
          "skin.id",
          `Interface skin '${command.skin.id}' already exists.`,
        );
      }
      return {
        manifest: {
          ...manifest,
          skins: insertAt(manifest.skins, command.index, command.skin, "index"),
        },
        inverse: { kind: "remove-skin", skinId: command.skin.id },
      };
    }
    case "remove-skin": {
      const { index, skin } = findSkin(manifest, command.skinId);
      return {
        manifest: { ...manifest, skins: removeAt(manifest.skins, index) },
        inverse: { kind: "insert-skin", index, skin },
      };
    }
    case "replace-skin": {
      const { index, skin: previous } = findSkin(manifest, command.skinId);
      assertStableIdentity(command.skinId, command.skin.id, "skin.id");
      return {
        manifest: updateSkin(manifest, index, command.skin),
        inverse: {
          kind: "replace-skin",
          skinId: command.skinId,
          skin: previous,
        },
      };
    }
    case "insert-verb": {
      const { index: skinIndex, skin } = findSkin(manifest, command.skinId);
      if (skin.verbs.some((verb) => verb.id === command.verb.id)) {
        throw new UiSkinEditorCommandError(
          "duplicate-id",
          "verb.id",
          `Interface verb '${command.verb.id}' already exists in skin '${skin.id}'.`,
        );
      }
      return {
        manifest: updateSkin(manifest, skinIndex, {
          ...skin,
          verbs: insertAt(skin.verbs, command.index, command.verb, "index"),
        }),
        inverse: {
          kind: "remove-verb",
          skinId: command.skinId,
          verbId: command.verb.id,
        },
      };
    }
    case "remove-verb": {
      const { index: skinIndex, skin } = findSkin(manifest, command.skinId);
      const { index, verb } = findVerb(skin, command.verbId);
      return {
        manifest: updateSkin(manifest, skinIndex, {
          ...skin,
          verbs: removeAt(skin.verbs, index),
        }),
        inverse: {
          kind: "insert-verb",
          skinId: command.skinId,
          index,
          verb,
        },
      };
    }
    case "replace-verb": {
      const { index: skinIndex, skin } = findSkin(manifest, command.skinId);
      const { index, verb: previous } = findVerb(skin, command.verbId);
      assertStableIdentity(command.verbId, command.verb.id, "verb.id");
      return {
        manifest: updateSkin(manifest, skinIndex, {
          ...skin,
          verbs: replaceAt(skin.verbs, index, command.verb),
        }),
        inverse: {
          kind: "replace-verb",
          skinId: command.skinId,
          verbId: command.verbId,
          verb: previous,
        },
      };
    }
  }
};

const validateDocument = (
  project: Pick<AdventureProject, "id" | "presentation" | "assets">,
  fonts: BitmapFontManifest | null,
  manifest: UiSkinManifest,
): UiSkinManifest => {
  let parsed: UiSkinManifest;
  try {
    parsed = uiSkinManifestSchema.parse(manifest);
  } catch (error) {
    throw new UiSkinEditorCommandError(
      "invalid-document",
      "$",
      error instanceof Error ? error.message : "Interface skin schema validation failed.",
    );
  }
  const errors = validateUiSkinManifest(project, fonts, parsed).filter(
    (issue) => issue.severity === "error",
  );
  if (errors.length > 0) {
    const first = errors[0];
    throw new UiSkinEditorCommandError(
      "invalid-document",
      first?.path ?? "$",
      first?.message ?? "Interface skin validation failed.",
    );
  }
  return parsed;
};

export const applyUiSkinEditorCommand = (
  project: Pick<AdventureProject, "id" | "presentation" | "assets">,
  fonts: BitmapFontManifest | null,
  manifest: UiSkinManifest,
  command: UiSkinEditorCommand,
): AppliedUiSkinEditorCommand => {
  const applied = applyUnchecked(manifest, command);
  return {
    manifest: validateDocument(project, fonts, applied.manifest),
    inverse: applied.inverse,
  };
};

export const createUiSkinEditorDocument = (
  project: Pick<AdventureProject, "id" | "presentation" | "assets">,
  fonts: BitmapFontManifest | null,
  manifest: UiSkinManifest,
): UiSkinEditorDocumentState => {
  const snapshot = cloneJson(validateDocument(project, fonts, manifest));
  return {
    manifest: snapshot,
    savedManifest: cloneJson(snapshot),
    operationRevision: 0,
  };
};

export const isUiSkinEditorDocumentDirty = (
  document: UiSkinEditorDocumentState,
): boolean =>
  canonicalUiSkinEditorJson(document.manifest) !==
  canonicalUiSkinEditorJson(document.savedManifest);

export const createUiSkinEditorHistory = (
  project: Pick<AdventureProject, "id" | "presentation" | "assets">,
  fonts: BitmapFontManifest | null,
  manifest: UiSkinManifest,
): UiSkinEditorHistoryState => ({
  document: createUiSkinEditorDocument(project, fonts, manifest),
  undoStack: [],
  redoStack: [],
});

const applyToDocument = (
  project: Pick<AdventureProject, "id" | "presentation" | "assets">,
  fonts: BitmapFontManifest | null,
  document: UiSkinEditorDocumentState,
  command: UiSkinEditorCommand,
): {
  readonly document: UiSkinEditorDocumentState;
  readonly inverse: UiSkinEditorCommand;
} => {
  const applied = applyUiSkinEditorCommand(
    project,
    fonts,
    document.manifest,
    command,
  );
  return {
    document: {
      ...document,
      manifest: applied.manifest,
      operationRevision: document.operationRevision + 1,
    },
    inverse: applied.inverse,
  };
};

export const executeUiSkinEditorCommand = (
  project: Pick<AdventureProject, "id" | "presentation" | "assets">,
  fonts: BitmapFontManifest | null,
  history: UiSkinEditorHistoryState,
  command: UiSkinEditorCommand,
): UiSkinEditorHistoryState => {
  const applied = applyToDocument(project, fonts, history.document, command);
  return {
    document: applied.document,
    undoStack: [
      ...history.undoStack,
      { undo: applied.inverse, redo: cloneJson(command) },
    ],
    redoStack: [],
  };
};

export const undoUiSkinEditorCommand = (
  project: Pick<AdventureProject, "id" | "presentation" | "assets">,
  fonts: BitmapFontManifest | null,
  history: UiSkinEditorHistoryState,
): UiSkinEditorHistoryState => {
  const entry = history.undoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(project, fonts, history.document, entry.undo);
  return {
    document: applied.document,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, entry],
  };
};

export const redoUiSkinEditorCommand = (
  project: Pick<AdventureProject, "id" | "presentation" | "assets">,
  fonts: BitmapFontManifest | null,
  history: UiSkinEditorHistoryState,
): UiSkinEditorHistoryState => {
  const entry = history.redoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(project, fonts, history.document, entry.redo);
  return {
    document: applied.document,
    undoStack: [...history.undoStack, entry],
    redoStack: history.redoStack.slice(0, -1),
  };
};

export const markUiSkinEditorHistorySaved = (
  history: UiSkinEditorHistoryState,
): UiSkinEditorHistoryState => ({
  ...history,
  document: {
    ...history.document,
    savedManifest: cloneJson(history.document.manifest),
  },
});
