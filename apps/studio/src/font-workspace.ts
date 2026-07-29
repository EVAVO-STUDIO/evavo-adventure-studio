import type {
  BitmapFontDefinition,
  BitmapFontManifest,
  BitmapGlyph,
  BitmapKerning,
} from "@evavo/adventure-bitmap-font";
import {
  layoutBitmapText,
  type BitmapTextLayout,
} from "@evavo/adventure-bitmap-font/layout";
import {
  createBitmapFontEditorHistory,
  executeBitmapFontEditorCommand,
  isBitmapFontEditorDocumentDirty,
  markBitmapFontEditorHistorySaved,
  redoBitmapFontEditorCommand,
  undoBitmapFontEditorCommand,
  type BitmapFontEditorCommand,
  type BitmapFontEditorHistoryState,
} from "@evavo/adventure-bitmap-font-editor-core";
import type { AdventureProject, Id } from "@evavo/adventure-project-schema";

export interface BitmapFontWorkspaceState {
  readonly project: AdventureProject;
  readonly history: BitmapFontEditorHistoryState;
  readonly selectedFontId: Id<"bitmap-font">;
  readonly selectedGlyphId: Id<"font-glyph">;
  readonly previewText: string;
  readonly previewWidth: number;
  readonly notice: string | null;
}

export type BitmapFontWorkspaceAction =
  | { readonly type: "select-font"; readonly fontId: Id<"bitmap-font"> }
  | { readonly type: "select-glyph"; readonly glyphId: Id<"font-glyph"> }
  | {
      readonly type: "execute";
      readonly command: BitmapFontEditorCommand;
      readonly selectedGlyphId?: Id<"font-glyph">;
      readonly notice?: string;
    }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "mark-saved" }
  | { readonly type: "set-preview-text"; readonly text: string }
  | { readonly type: "set-preview-width"; readonly width: number }
  | { readonly type: "clear-notice" };

const firstFont = (manifest: BitmapFontManifest): BitmapFontDefinition => {
  const font = manifest.fonts[0];
  if (!font) throw new Error("Bitmap font manifests require at least one font.");
  return font;
};

const firstGlyph = (font: BitmapFontDefinition): BitmapGlyph => {
  const glyph = font.glyphs[0];
  if (!glyph) throw new Error(`Bitmap font '${font.id}' requires at least one glyph.`);
  return glyph;
};

export const createBitmapFontWorkspace = (
  project: AdventureProject,
  manifest: BitmapFontManifest,
): BitmapFontWorkspaceState => {
  const history = createBitmapFontEditorHistory(project, manifest);
  const font = firstFont(history.document.manifest);
  return {
    project,
    history,
    selectedFontId: font.id,
    selectedGlyphId: firstGlyph(font).id,
    previewText: "LOOK AT THE RED LEDGER?",
    previewWidth: 180,
    notice: null,
  };
};

export const selectedBitmapFont = (
  state: BitmapFontWorkspaceState,
): BitmapFontDefinition => {
  const font = state.history.document.manifest.fonts.find(
    (candidate) => candidate.id === state.selectedFontId,
  );
  if (!font) throw new Error(`Bitmap font '${state.selectedFontId}' does not exist.`);
  return font;
};

export const selectedBitmapGlyph = (
  state: BitmapFontWorkspaceState,
): BitmapGlyph => {
  const font = selectedBitmapFont(state);
  const glyph = font.glyphs.find(
    (candidate) => candidate.id === state.selectedGlyphId,
  );
  if (!glyph) {
    throw new Error(
      `Bitmap glyph '${state.selectedGlyphId}' does not exist in '${font.id}'.`,
    );
  }
  return glyph;
};

export const bitmapFontPreviewLayout = (
  state: BitmapFontWorkspaceState,
): BitmapTextLayout =>
  layoutBitmapText(selectedBitmapFont(state), state.previewText, {
    maxWidth: state.previewWidth,
    alignment: "left",
    lineSpacing: 1,
  });

export const bitmapFontWorkspaceIsDirty = (
  state: BitmapFontWorkspaceState,
): boolean => isBitmapFontEditorDocumentDirty(state.history.document);

const selectionAfterHistory = (
  state: BitmapFontWorkspaceState,
  history: BitmapFontEditorHistoryState,
): Pick<BitmapFontWorkspaceState, "selectedFontId" | "selectedGlyphId"> => {
  const selectedFont = history.document.manifest.fonts.find(
    (font) => font.id === state.selectedFontId,
  );
  const font = selectedFont ?? firstFont(history.document.manifest);
  const selectedGlyph = font.glyphs.find(
    (glyph) => glyph.id === state.selectedGlyphId,
  );
  return {
    selectedFontId: font.id,
    selectedGlyphId: (selectedGlyph ?? firstGlyph(font)).id,
  };
};

export const bitmapFontWorkspaceReducer = (
  state: BitmapFontWorkspaceState,
  action: BitmapFontWorkspaceAction,
): BitmapFontWorkspaceState => {
  switch (action.type) {
    case "select-font": {
      const font = state.history.document.manifest.fonts.find(
        (candidate) => candidate.id === action.fontId,
      );
      if (!font) return state;
      return {
        ...state,
        selectedFontId: font.id,
        selectedGlyphId: firstGlyph(font).id,
        notice: null,
      };
    }
    case "select-glyph":
      return { ...state, selectedGlyphId: action.glyphId, notice: null };
    case "execute": {
      const history = executeBitmapFontEditorCommand(
        state.project,
        state.history,
        action.command,
      );
      const selection = selectionAfterHistory(state, history);
      return {
        ...state,
        history,
        ...selection,
        ...(action.selectedGlyphId
          ? { selectedGlyphId: action.selectedGlyphId }
          : {}),
        notice: action.notice ?? null,
      };
    }
    case "undo": {
      const history = undoBitmapFontEditorCommand(state.project, state.history);
      return {
        ...state,
        history,
        ...selectionAfterHistory(state, history),
        notice: "Undid the last bitmap font edit.",
      };
    }
    case "redo": {
      const history = redoBitmapFontEditorCommand(state.project, state.history);
      return {
        ...state,
        history,
        ...selectionAfterHistory(state, history),
        notice: "Redid the bitmap font edit.",
      };
    }
    case "mark-saved":
      return {
        ...state,
        history: markBitmapFontEditorHistorySaved(state.history),
        notice: "Bitmap font manifest marked as saved.",
      };
    case "set-preview-text":
      return { ...state, previewText: action.text, notice: null };
    case "set-preview-width":
      return {
        ...state,
        previewWidth: Math.max(32, Math.min(300, Math.round(action.width))),
      };
    case "clear-notice":
      return { ...state, notice: null };
  }
};

export const replaceSelectedFontCommand = (
  state: BitmapFontWorkspaceState,
  font: BitmapFontDefinition,
): BitmapFontEditorCommand => ({
  kind: "replace-font",
  fontId: state.selectedFontId,
  font,
});

export const replaceSelectedGlyphCommand = (
  state: BitmapFontWorkspaceState,
  glyph: BitmapGlyph,
): BitmapFontEditorCommand => ({
  kind: "replace-glyph",
  fontId: state.selectedFontId,
  glyphId: state.selectedGlyphId,
  glyph,
});

const glyphIds = (manifest: BitmapFontManifest): ReadonlySet<string> =>
  new Set(manifest.fonts.flatMap((font) => font.glyphs.map((glyph) => glyph.id)));

const nextGlyphCodePoint = (font: BitmapFontDefinition): number => {
  const used = new Set(font.glyphs.map((glyph) => glyph.codePoint));
  for (let codePoint = 32; codePoint <= 0x7e; codePoint += 1) {
    if (codePoint !== 32 && !used.has(codePoint)) return codePoint;
  }
  for (let codePoint = 0xa0; codePoint <= 0x10ffff; codePoint += 1) {
    if (!used.has(codePoint)) return codePoint;
  }
  throw new Error("No unused Unicode code point is available.");
};

const uniqueGlyphId = (
  manifest: BitmapFontManifest,
  font: BitmapFontDefinition,
  codePoint: number,
): Id<"font-glyph"> => {
  const existing = glyphIds(manifest);
  const base = `font-glyph.${font.id}.${codePoint}`;
  let candidate = base;
  let suffix = 1;
  while (existing.has(candidate)) {
    candidate = `${base}.${suffix}`;
    suffix += 1;
  }
  return candidate as Id<"font-glyph">;
};

export const insertBitmapGlyphCommand = (
  state: BitmapFontWorkspaceState,
): {
  readonly command: BitmapFontEditorCommand;
  readonly glyphId: Id<"font-glyph">;
} => {
  const font = selectedBitmapFont(state);
  const codePoint = nextGlyphCodePoint(font);
  const glyphId = uniqueGlyphId(
    state.history.document.manifest,
    font,
    codePoint,
  );
  const glyph: BitmapGlyph = {
    id: glyphId,
    codePoint,
    sourceRect: { x: 0, y: 0, width: 5, height: 8 },
    bearing: { x: 0, y: -8 },
    advance: 6,
  };
  return {
    command: {
      kind: "insert-glyph",
      fontId: font.id,
      index: font.glyphs.length,
      glyph,
    },
    glyphId,
  };
};

export const removeSelectedGlyphCommand = (
  state: BitmapFontWorkspaceState,
): BitmapFontEditorCommand => ({
  kind: "remove-glyph",
  fontId: state.selectedFontId,
  glyphId: state.selectedGlyphId,
});

export const insertKerningCommand = (
  state: BitmapFontWorkspaceState,
): BitmapFontEditorCommand => {
  const font = selectedBitmapFont(state);
  const selected = selectedBitmapGlyph(state);
  const right = font.glyphs.find(
    (glyph) =>
      glyph.codePoint !== selected.codePoint &&
      !font.kernings.some(
        (kerning) =>
          kerning.leftCodePoint === selected.codePoint &&
          kerning.rightCodePoint === glyph.codePoint,
      ),
  );
  if (!right) {
    throw new Error("No unused kerning pair is available for the selected glyph.");
  }
  const kerning: BitmapKerning = {
    leftCodePoint: selected.codePoint,
    rightCodePoint: right.codePoint,
    adjustment: -1,
  };
  return {
    kind: "insert-kerning",
    fontId: font.id,
    index: font.kernings.length,
    kerning,
  };
};
