import { describe, expect, it } from "vitest";
import { bitmapFontManifestSchema } from "@evavo/adventure-bitmap-font";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  BitmapFontEditorCommandError,
  createBitmapFontEditorHistory,
  executeBitmapFontEditorCommand,
  isBitmapFontEditorDocumentDirty,
  markBitmapFontEditorHistorySaved,
  redoBitmapFontEditorCommand,
  undoBitmapFontEditorCommand,
} from "../src/index.js";
import { parseBitmapFontEditorCommand } from "../src/command-schema.js";

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.font-editor",
  title: "Font Editor",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: false,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.office",
  startEntranceId: "entrance.office",
  scenes: [
    {
      id: "scene.office",
      name: "Office",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.office",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.office",
          position: { x: 20, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  actors: [],
  dialogues: [],
  sequences: [],
  assets: [
    { id: "asset.office", path: "art/office.png", kind: "image" },
    {
      id: "asset.font.dialogue",
      path: "art/font-dialogue.png",
      kind: "image",
    },
  ],
  inventoryItems: [],
});

const manifest = bitmapFontManifestSchema.parse({
  manifestVersion: 1,
  projectId: project.id,
  fonts: [
    {
      id: "bitmap-font.dialogue",
      name: "Dialogue",
      atlasAssetId: "asset.font.dialogue",
      lineHeight: 10,
      baseline: 8,
      spaceAdvance: 4,
      letterSpacing: 1,
      fallbackCodePoint: 63,
      glyphs: [
        {
          id: "font-glyph.question",
          codePoint: 63,
          sourceRect: { x: 0, y: 0, width: 5, height: 8 },
          bearing: { x: 0, y: -8 },
          advance: 6,
        },
        {
          id: "font-glyph.A",
          codePoint: 65,
          sourceRect: { x: 5, y: 0, width: 6, height: 8 },
          bearing: { x: 0, y: -8 },
          advance: 7,
        },
      ],
      kernings: [],
    },
  ],
});

describe("bitmap font editor history", () => {
  it("edits glyph metrics with undo, redo and save tracking", () => {
    let history = createBitmapFontEditorHistory(project, manifest);
    const glyph = manifest.fonts[0]!.glyphs[1]!;
    history = executeBitmapFontEditorCommand(project, history, {
      kind: "replace-glyph",
      fontId: manifest.fonts[0]!.id,
      glyphId: glyph.id,
      glyph: { ...glyph, advance: 8, bearing: { x: 1, y: -8 } },
    });

    expect(history.document.manifest.fonts[0]?.glyphs[1]).toMatchObject({
      advance: 8,
      bearing: { x: 1, y: -8 },
    });
    expect(isBitmapFontEditorDocumentDirty(history.document)).toBe(true);

    history = undoBitmapFontEditorCommand(project, history);
    expect(history.document.manifest.fonts[0]?.glyphs[1]).toEqual(glyph);
    expect(isBitmapFontEditorDocumentDirty(history.document)).toBe(false);

    history = redoBitmapFontEditorCommand(project, history);
    expect(history.document.manifest.fonts[0]?.glyphs[1]?.advance).toBe(8);
    history = markBitmapFontEditorHistorySaved(history);
    expect(isBitmapFontEditorDocumentDirty(history.document)).toBe(false);
  });

  it("allows atomic fallback migration but blocks invalid standalone removal", () => {
    const font = manifest.fonts[0]!;
    const fallback = font.glyphs[0]!;
    const replacement = font.glyphs[1]!;
    const history = createBitmapFontEditorHistory(project, manifest);

    expect(() =>
      executeBitmapFontEditorCommand(project, history, {
        kind: "remove-glyph",
        fontId: font.id,
        glyphId: fallback.id,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<BitmapFontEditorCommandError>>({
        code: "invalid-document",
      }),
    );

    const migrated = executeBitmapFontEditorCommand(project, history, {
      kind: "batch",
      commands: [
        {
          kind: "remove-glyph",
          fontId: font.id,
          glyphId: fallback.id,
        },
        {
          kind: "replace-font",
          fontId: font.id,
          font: {
            ...font,
            fallbackCodePoint: replacement.codePoint,
            glyphs: [replacement],
          },
        },
      ],
    });
    expect(migrated.document.manifest.fonts[0]).toMatchObject({
      fallbackCodePoint: 65,
      glyphs: [{ id: "font-glyph.A" }],
    });
    expect(migrated.undoStack).toHaveLength(1);
  });

  it("adds and edits stable kerning pairs", () => {
    const font = manifest.fonts[0]!;
    let history = createBitmapFontEditorHistory(project, manifest);
    history = executeBitmapFontEditorCommand(project, history, {
      kind: "insert-kerning",
      fontId: font.id,
      index: 0,
      kerning: {
        leftCodePoint: 65,
        rightCodePoint: 63,
        adjustment: -1,
      },
    });
    history = executeBitmapFontEditorCommand(project, history, {
      kind: "replace-kerning",
      fontId: font.id,
      leftCodePoint: 65,
      rightCodePoint: 63,
      kerning: {
        leftCodePoint: 65,
        rightCodePoint: 63,
        adjustment: -2,
      },
    });

    expect(history.document.manifest.fonts[0]?.kernings[0]?.adjustment).toBe(-2);
    expect(() =>
      executeBitmapFontEditorCommand(project, history, {
        kind: "insert-kerning",
        fontId: font.id,
        index: 1,
        kerning: {
          leftCodePoint: 65,
          rightCodePoint: 63,
          adjustment: 0,
        },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<BitmapFontEditorCommandError>>({
        code: "duplicate-kerning",
      }),
    );
  });

  it("protects globally unique glyph identities", () => {
    const font = manifest.fonts[0]!;
    expect(() =>
      executeBitmapFontEditorCommand(
        project,
        createBitmapFontEditorHistory(project, manifest),
        {
          kind: "insert-glyph",
          fontId: font.id,
          index: font.glyphs.length,
          glyph: { ...font.glyphs[1]!, codePoint: 66 },
        },
      ),
    ).toThrowError(
      expect.objectContaining<Partial<BitmapFontEditorCommandError>>({
        code: "duplicate-id",
      }),
    );
  });
});

describe("bitmap font command schema", () => {
  it("parses recursive glyph and kerning commands", () => {
    expect(
      parseBitmapFontEditorCommand({
        kind: "batch",
        commands: [
          {
            kind: "replace-glyph",
            fontId: "bitmap-font.dialogue",
            glyphId: "font-glyph.A",
            glyph: manifest.fonts[0]!.glyphs[1],
          },
          {
            kind: "insert-kerning",
            fontId: "bitmap-font.dialogue",
            index: 0,
            kerning: {
              leftCodePoint: 65,
              rightCodePoint: 63,
              adjustment: -1,
            },
          },
        ],
      }),
    ).toMatchObject({ kind: "batch" });
  });

  it("rejects empty command batches", () => {
    expect(() =>
      parseBitmapFontEditorCommand({ kind: "batch", commands: [] }),
    ).toThrow();
  });
});
