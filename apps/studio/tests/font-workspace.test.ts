import { describe, expect, it } from "vitest";
import { studioBitmapFonts, studioFontProject } from "../src/font-fixture.js";
import {
  bitmapFontPreviewLayout,
  bitmapFontWorkspaceIsDirty,
  bitmapFontWorkspaceReducer,
  createBitmapFontWorkspace,
  insertBitmapGlyphCommand,
  insertKerningCommand,
  removeSelectedGlyphCommand,
  replaceSelectedGlyphCommand,
  selectedBitmapFont,
  selectedBitmapGlyph,
} from "../src/font-workspace.js";

describe("bitmap font workspace", () => {
  it("lays out the preview with native integer metrics", () => {
    const state = createBitmapFontWorkspace(studioFontProject, studioBitmapFonts);
    const layout = bitmapFontPreviewLayout(state);

    expect(layout.width).toBe(180);
    expect(layout.placements.length).toBeGreaterThan(10);
    expect(layout.placements.every((placement) => Number.isInteger(placement.x))).toBe(true);
    expect(layout.fallbackCodePoints).toEqual([]);
  });

  it("inserts and selects a globally unique glyph", () => {
    let state = createBitmapFontWorkspace(studioFontProject, studioBitmapFonts);
    const addition = insertBitmapGlyphCommand(state);
    state = bitmapFontWorkspaceReducer(state, {
      type: "execute",
      command: addition.command,
      selectedGlyphId: addition.glyphId,
    });

    expect(selectedBitmapGlyph(state).id).toBe(addition.glyphId);
    expect(selectedBitmapFont(state).glyphs.at(-1)?.id).toBe(addition.glyphId);
    expect(bitmapFontWorkspaceIsDirty(state)).toBe(true);
  });

  it("edits glyph advance and undoes the change", () => {
    let state = createBitmapFontWorkspace(studioFontProject, studioBitmapFonts);
    const glyph = selectedBitmapGlyph(state);
    state = bitmapFontWorkspaceReducer(state, {
      type: "execute",
      command: replaceSelectedGlyphCommand(state, {
        ...glyph,
        advance: glyph.advance + 1,
      }),
    });
    expect(selectedBitmapGlyph(state).advance).toBe(glyph.advance + 1);

    state = bitmapFontWorkspaceReducer(state, { type: "undo" });
    expect(selectedBitmapGlyph(state).advance).toBe(glyph.advance);
    expect(bitmapFontWorkspaceIsDirty(state)).toBe(false);

    state = bitmapFontWorkspaceReducer(state, { type: "redo" });
    expect(selectedBitmapGlyph(state).advance).toBe(glyph.advance + 1);
  });

  it("blocks deletion of the active fallback glyph", () => {
    const state = createBitmapFontWorkspace(studioFontProject, studioBitmapFonts);
    expect(() =>
      bitmapFontWorkspaceReducer(state, {
        type: "execute",
        command: removeSelectedGlyphCommand(state),
      }),
    ).toThrow();
  });

  it("adds one unused kerning pair for the selected glyph", () => {
    let state = createBitmapFontWorkspace(studioFontProject, studioBitmapFonts);
    const before = selectedBitmapFont(state).kernings.length;
    state = bitmapFontWorkspaceReducer(state, {
      type: "execute",
      command: insertKerningCommand(state),
    });

    expect(selectedBitmapFont(state).kernings).toHaveLength(before + 1);
  });

  it("updates preview text without changing the font document", () => {
    const initial = createBitmapFontWorkspace(studioFontProject, studioBitmapFonts);
    const next = bitmapFontWorkspaceReducer(initial, {
      type: "set-preview-text",
      text: "TAKE LEDGER",
    });

    expect(next.previewText).toBe("TAKE LEDGER");
    expect(next.history).toBe(initial.history);
    expect(bitmapFontWorkspaceIsDirty(next)).toBe(false);
  });
});
