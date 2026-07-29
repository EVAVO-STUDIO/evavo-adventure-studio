import {
  bitmapFontManifestSchema,
  validateBitmapFontManifest,
  type BitmapFontDefinition,
  type BitmapFontManifest,
  type BitmapGlyph,
  type BitmapKerning,
} from "@evavo/adventure-bitmap-font";
import type { AdventureProject, Id } from "@evavo/adventure-project-schema";

export class BitmapFontEditorCommandError extends Error {
  readonly code:
    | "invalid-index"
    | "duplicate-id"
    | "duplicate-kerning"
    | "missing-entity"
    | "identity-change"
    | "empty-batch"
    | "invalid-document";
  readonly path: string;

  constructor(
    code: BitmapFontEditorCommandError["code"],
    path: string,
    message: string,
  ) {
    super(message);
    this.name = "BitmapFontEditorCommandError";
    this.code = code;
    this.path = path;
  }
}

export type BitmapFontEditorCommand =
  | {
      readonly kind: "batch";
      readonly commands: readonly BitmapFontEditorCommand[];
    }
  | {
      readonly kind: "insert-font";
      readonly index: number;
      readonly font: BitmapFontDefinition;
    }
  | {
      readonly kind: "remove-font";
      readonly fontId: Id<"bitmap-font">;
    }
  | {
      readonly kind: "replace-font";
      readonly fontId: Id<"bitmap-font">;
      readonly font: BitmapFontDefinition;
    }
  | {
      readonly kind: "insert-glyph";
      readonly fontId: Id<"bitmap-font">;
      readonly index: number;
      readonly glyph: BitmapGlyph;
    }
  | {
      readonly kind: "remove-glyph";
      readonly fontId: Id<"bitmap-font">;
      readonly glyphId: Id<"font-glyph">;
    }
  | {
      readonly kind: "replace-glyph";
      readonly fontId: Id<"bitmap-font">;
      readonly glyphId: Id<"font-glyph">;
      readonly glyph: BitmapGlyph;
    }
  | {
      readonly kind: "insert-kerning";
      readonly fontId: Id<"bitmap-font">;
      readonly index: number;
      readonly kerning: BitmapKerning;
    }
  | {
      readonly kind: "remove-kerning";
      readonly fontId: Id<"bitmap-font">;
      readonly leftCodePoint: number;
      readonly rightCodePoint: number;
    }
  | {
      readonly kind: "replace-kerning";
      readonly fontId: Id<"bitmap-font">;
      readonly leftCodePoint: number;
      readonly rightCodePoint: number;
      readonly kerning: BitmapKerning;
    };

export interface AppliedBitmapFontEditorCommand {
  readonly manifest: BitmapFontManifest;
  readonly inverse: BitmapFontEditorCommand;
}

export interface BitmapFontEditorDocumentState {
  readonly manifest: BitmapFontManifest;
  readonly savedManifest: BitmapFontManifest;
  readonly operationRevision: number;
}

export interface BitmapFontEditorHistoryEntry {
  readonly undo: BitmapFontEditorCommand;
  readonly redo: BitmapFontEditorCommand;
}

export interface BitmapFontEditorHistoryState {
  readonly document: BitmapFontEditorDocumentState;
  readonly undoStack: readonly BitmapFontEditorHistoryEntry[];
  readonly redoStack: readonly BitmapFontEditorHistoryEntry[];
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

export const canonicalBitmapFontEditorJson = (value: unknown): string => {
  const output = JSON.stringify(canonicalize(value));
  if (output === undefined) {
    throw new TypeError("Bitmap font editor data cannot be represented as JSON.");
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
    throw new BitmapFontEditorCommandError(
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

const findFont = (
  manifest: BitmapFontManifest,
  fontId: Id<"bitmap-font">,
): { readonly index: number; readonly font: BitmapFontDefinition } => {
  const index = manifest.fonts.findIndex((font) => font.id === fontId);
  if (index < 0) {
    throw new BitmapFontEditorCommandError(
      "missing-entity",
      "fontId",
      `Bitmap font '${fontId}' does not exist.`,
    );
  }
  const font = manifest.fonts[index];
  if (!font) throw new Error("Bitmap font index is invalid.");
  return { index, font };
};

const findGlyph = (
  font: BitmapFontDefinition,
  glyphId: Id<"font-glyph">,
): { readonly index: number; readonly glyph: BitmapGlyph } => {
  const index = font.glyphs.findIndex((glyph) => glyph.id === glyphId);
  if (index < 0) {
    throw new BitmapFontEditorCommandError(
      "missing-entity",
      "glyphId",
      `Bitmap glyph '${glyphId}' does not exist in font '${font.id}'.`,
    );
  }
  const glyph = font.glyphs[index];
  if (!glyph) throw new Error("Bitmap glyph index is invalid.");
  return { index, glyph };
};

const kerningKey = (leftCodePoint: number, rightCodePoint: number): string =>
  `${leftCodePoint}:${rightCodePoint}`;

const findKerning = (
  font: BitmapFontDefinition,
  leftCodePoint: number,
  rightCodePoint: number,
): { readonly index: number; readonly kerning: BitmapKerning } => {
  const index = font.kernings.findIndex(
    (kerning) =>
      kerning.leftCodePoint === leftCodePoint &&
      kerning.rightCodePoint === rightCodePoint,
  );
  if (index < 0) {
    throw new BitmapFontEditorCommandError(
      "missing-entity",
      "kerning",
      `Kerning pair '${kerningKey(leftCodePoint, rightCodePoint)}' does not exist in font '${font.id}'.`,
    );
  }
  const kerning = font.kernings[index];
  if (!kerning) throw new Error("Bitmap kerning index is invalid.");
  return { index, kerning };
};

const manifestIds = (manifest: BitmapFontManifest): ReadonlySet<string> => {
  const ids = new Set<string>();
  for (const font of manifest.fonts) {
    ids.add(font.id);
    for (const glyph of font.glyphs) ids.add(glyph.id);
  }
  return ids;
};

const assertInsertedIds = (
  manifest: BitmapFontManifest,
  ids: readonly string[],
  path: string,
): void => {
  const existing = manifestIds(manifest);
  const local = new Set<string>();
  for (const id of ids) {
    if (local.has(id) || existing.has(id)) {
      throw new BitmapFontEditorCommandError(
        "duplicate-id",
        path,
        `Bitmap font ID '${id}' already exists.`,
      );
    }
    local.add(id);
  }
};

const assertStableIdentity = (
  expected: string,
  actual: string,
  path: string,
): void => {
  if (expected !== actual) {
    throw new BitmapFontEditorCommandError(
      "identity-change",
      path,
      `Replace commands cannot change ID '${expected}' to '${actual}'.`,
    );
  }
};

const updateFont = (
  manifest: BitmapFontManifest,
  index: number,
  font: BitmapFontDefinition,
): BitmapFontManifest => ({
  ...manifest,
  fonts: replaceAt(manifest.fonts, index, font),
});

const applyCommandUnchecked = (
  manifest: BitmapFontManifest,
  command: BitmapFontEditorCommand,
): AppliedBitmapFontEditorCommand => {
  switch (command.kind) {
    case "batch": {
      if (command.commands.length === 0) {
        throw new BitmapFontEditorCommandError(
          "empty-batch",
          "commands",
          "Bitmap font command batches cannot be empty.",
        );
      }
      let next = manifest;
      const inverses: BitmapFontEditorCommand[] = [];
      for (const child of command.commands) {
        const applied = applyCommandUnchecked(next, child);
        next = applied.manifest;
        inverses.unshift(applied.inverse);
      }
      return {
        manifest: next,
        inverse: { kind: "batch", commands: inverses },
      };
    }
    case "insert-font": {
      assertInsertedIds(
        manifest,
        [command.font.id, ...command.font.glyphs.map((glyph) => glyph.id)],
        "font",
      );
      return {
        manifest: {
          ...manifest,
          fonts: insertAt(manifest.fonts, command.index, command.font, "index"),
        },
        inverse: { kind: "remove-font", fontId: command.font.id },
      };
    }
    case "remove-font": {
      const { index, font } = findFont(manifest, command.fontId);
      return {
        manifest: { ...manifest, fonts: removeAt(manifest.fonts, index) },
        inverse: { kind: "insert-font", index, font },
      };
    }
    case "replace-font": {
      const { index, font: previous } = findFont(manifest, command.fontId);
      assertStableIdentity(command.fontId, command.font.id, "font.id");
      const previousIds = new Set([
        previous.id,
        ...previous.glyphs.map((glyph) => glyph.id),
      ]);
      const existing = manifestIds(manifest);
      for (const id of [
        command.font.id,
        ...command.font.glyphs.map((glyph) => glyph.id),
      ]) {
        if (existing.has(id) && !previousIds.has(id)) {
          throw new BitmapFontEditorCommandError(
            "duplicate-id",
            "font",
            `Bitmap font ID '${id}' already exists.`,
          );
        }
      }
      return {
        manifest: updateFont(manifest, index, command.font),
        inverse: {
          kind: "replace-font",
          fontId: command.fontId,
          font: previous,
        },
      };
    }
    case "insert-glyph": {
      const { index, font } = findFont(manifest, command.fontId);
      assertInsertedIds(manifest, [command.glyph.id], "glyph.id");
      return {
        manifest: updateFont(manifest, index, {
          ...font,
          glyphs: insertAt(font.glyphs, command.index, command.glyph, "index"),
        }),
        inverse: {
          kind: "remove-glyph",
          fontId: command.fontId,
          glyphId: command.glyph.id,
        },
      };
    }
    case "remove-glyph": {
      const { index: fontIndex, font } = findFont(manifest, command.fontId);
      const { index, glyph } = findGlyph(font, command.glyphId);
      return {
        manifest: updateFont(manifest, fontIndex, {
          ...font,
          glyphs: removeAt(font.glyphs, index),
        }),
        inverse: {
          kind: "insert-glyph",
          fontId: command.fontId,
          index,
          glyph,
        },
      };
    }
    case "replace-glyph": {
      const { index: fontIndex, font } = findFont(manifest, command.fontId);
      const { index, glyph: previous } = findGlyph(font, command.glyphId);
      assertStableIdentity(command.glyphId, command.glyph.id, "glyph.id");
      return {
        manifest: updateFont(manifest, fontIndex, {
          ...font,
          glyphs: replaceAt(font.glyphs, index, command.glyph),
        }),
        inverse: {
          kind: "replace-glyph",
          fontId: command.fontId,
          glyphId: command.glyphId,
          glyph: previous,
        },
      };
    }
    case "insert-kerning": {
      const { index: fontIndex, font } = findFont(manifest, command.fontId);
      if (
        font.kernings.some(
          (candidate) =>
            candidate.leftCodePoint === command.kerning.leftCodePoint &&
            candidate.rightCodePoint === command.kerning.rightCodePoint,
        )
      ) {
        throw new BitmapFontEditorCommandError(
          "duplicate-kerning",
          "kerning",
          `Kerning pair '${kerningKey(command.kerning.leftCodePoint, command.kerning.rightCodePoint)}' already exists.`,
        );
      }
      return {
        manifest: updateFont(manifest, fontIndex, {
          ...font,
          kernings: insertAt(
            font.kernings,
            command.index,
            command.kerning,
            "index",
          ),
        }),
        inverse: {
          kind: "remove-kerning",
          fontId: command.fontId,
          leftCodePoint: command.kerning.leftCodePoint,
          rightCodePoint: command.kerning.rightCodePoint,
        },
      };
    }
    case "remove-kerning": {
      const { index: fontIndex, font } = findFont(manifest, command.fontId);
      const { index, kerning } = findKerning(
        font,
        command.leftCodePoint,
        command.rightCodePoint,
      );
      return {
        manifest: updateFont(manifest, fontIndex, {
          ...font,
          kernings: removeAt(font.kernings, index),
        }),
        inverse: {
          kind: "insert-kerning",
          fontId: command.fontId,
          index,
          kerning,
        },
      };
    }
    case "replace-kerning": {
      const { index: fontIndex, font } = findFont(manifest, command.fontId);
      const { index, kerning: previous } = findKerning(
        font,
        command.leftCodePoint,
        command.rightCodePoint,
      );
      if (
        command.kerning.leftCodePoint !== command.leftCodePoint ||
        command.kerning.rightCodePoint !== command.rightCodePoint
      ) {
        throw new BitmapFontEditorCommandError(
          "identity-change",
          "kerning",
          "Replace kerning commands cannot change the code-point pair.",
        );
      }
      return {
        manifest: updateFont(manifest, fontIndex, {
          ...font,
          kernings: replaceAt(font.kernings, index, command.kerning),
        }),
        inverse: {
          kind: "replace-kerning",
          fontId: command.fontId,
          leftCodePoint: command.leftCodePoint,
          rightCodePoint: command.rightCodePoint,
          kerning: previous,
        },
      };
    }
  }
};

const validateDocument = (
  project: Pick<AdventureProject, "id" | "assets">,
  manifest: BitmapFontManifest,
): BitmapFontManifest => {
  let parsed: BitmapFontManifest;
  try {
    parsed = bitmapFontManifestSchema.parse(manifest);
  } catch (error) {
    throw new BitmapFontEditorCommandError(
      "invalid-document",
      "$",
      error instanceof Error ? error.message : "Bitmap font schema validation failed.",
    );
  }
  const issues = validateBitmapFontManifest(project, parsed);
  if (issues.length > 0) {
    const first = issues[0];
    throw new BitmapFontEditorCommandError(
      "invalid-document",
      first?.path ?? "$",
      first?.message ?? "Bitmap font semantic validation failed.",
    );
  }
  return parsed;
};

export const applyBitmapFontEditorCommand = (
  project: Pick<AdventureProject, "id" | "assets">,
  manifest: BitmapFontManifest,
  command: BitmapFontEditorCommand,
): AppliedBitmapFontEditorCommand => {
  const applied = applyCommandUnchecked(manifest, command);
  return {
    manifest: validateDocument(project, applied.manifest),
    inverse: applied.inverse,
  };
};

export const createBitmapFontEditorDocument = (
  project: Pick<AdventureProject, "id" | "assets">,
  manifest: BitmapFontManifest,
): BitmapFontEditorDocumentState => {
  const snapshot = cloneJson(validateDocument(project, manifest));
  return {
    manifest: snapshot,
    savedManifest: cloneJson(snapshot),
    operationRevision: 0,
  };
};

export const isBitmapFontEditorDocumentDirty = (
  document: BitmapFontEditorDocumentState,
): boolean =>
  canonicalBitmapFontEditorJson(document.manifest) !==
  canonicalBitmapFontEditorJson(document.savedManifest);

export const createBitmapFontEditorHistory = (
  project: Pick<AdventureProject, "id" | "assets">,
  manifest: BitmapFontManifest,
): BitmapFontEditorHistoryState => ({
  document: createBitmapFontEditorDocument(project, manifest),
  undoStack: [],
  redoStack: [],
});

const applyToDocument = (
  project: Pick<AdventureProject, "id" | "assets">,
  document: BitmapFontEditorDocumentState,
  command: BitmapFontEditorCommand,
): {
  readonly document: BitmapFontEditorDocumentState;
  readonly inverse: BitmapFontEditorCommand;
} => {
  const applied = applyBitmapFontEditorCommand(
    project,
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

export const executeBitmapFontEditorCommand = (
  project: Pick<AdventureProject, "id" | "assets">,
  history: BitmapFontEditorHistoryState,
  command: BitmapFontEditorCommand,
): BitmapFontEditorHistoryState => {
  const applied = applyToDocument(project, history.document, command);
  return {
    document: applied.document,
    undoStack: [
      ...history.undoStack,
      { undo: applied.inverse, redo: cloneJson(command) },
    ],
    redoStack: [],
  };
};

export const undoBitmapFontEditorCommand = (
  project: Pick<AdventureProject, "id" | "assets">,
  history: BitmapFontEditorHistoryState,
): BitmapFontEditorHistoryState => {
  const entry = history.undoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(project, history.document, entry.undo);
  return {
    document: applied.document,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, entry],
  };
};

export const redoBitmapFontEditorCommand = (
  project: Pick<AdventureProject, "id" | "assets">,
  history: BitmapFontEditorHistoryState,
): BitmapFontEditorHistoryState => {
  const entry = history.redoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(project, history.document, entry.redo);
  return {
    document: applied.document,
    undoStack: [...history.undoStack, entry],
    redoStack: history.redoStack.slice(0, -1),
  };
};

export const markBitmapFontEditorHistorySaved = (
  history: BitmapFontEditorHistoryState,
): BitmapFontEditorHistoryState => ({
  ...history,
  document: {
    ...history.document,
    savedManifest: cloneJson(history.document.manifest),
  },
});
