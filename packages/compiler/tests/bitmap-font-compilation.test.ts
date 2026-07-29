import { describe, expect, it } from "vitest";
import { assetBuildManifestSchema } from "@evavo/adventure-asset-contract";
import { bitmapFontManifestSchema } from "@evavo/adventure-bitmap-font";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  compileProject,
  ProjectCompilationError,
} from "../src/index.js";

const hash = "0".repeat(64);

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.font-compile",
  title: "Font Compile",
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

const assets = assetBuildManifestSchema.parse({
  manifestVersion: 1,
  projectId: project.id,
  compilerVersion: "test",
  fingerprint: hash,
  assets: [
    {
      assetId: "asset.office",
      kind: "image",
      sourceFiles: [
        { path: "art/office.png", sha256: hash, byteLength: 1 },
      ],
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/office.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image",
        width: 320,
        height: 200,
        palette: true,
        colourCount: 128,
      },
    },
    {
      assetId: "asset.font.dialogue",
      kind: "image",
      sourceFiles: [
        { path: "art/font-dialogue.png", sha256: hash, byteLength: 1 },
      ],
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/font-dialogue.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image",
        width: 32,
        height: 16,
        palette: true,
        colourCount: 16,
      },
    },
  ],
});

const fonts = bitmapFontManifestSchema.parse({
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
          id: "font-glyph.V",
          codePoint: 86,
          sourceRect: { x: 11, y: 0, width: 6, height: 8 },
          bearing: { x: 0, y: -8 },
          advance: 7,
        },
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
      kernings: [
        { leftCodePoint: 86, rightCodePoint: 65, adjustment: -1 },
        { leftCodePoint: 65, rightCodePoint: 86, adjustment: -1 },
      ],
    },
  ],
});

describe("bitmap font compilation", () => {
  it("embeds canonical fonts and includes them in the fingerprint", () => {
    const compiled = compileProject(project, assets, fonts);

    expect(compiled.bundle.bitmapFonts?.fonts[0]?.glyphs.map((glyph) => glyph.codePoint)).toEqual([
      63,
      65,
      86,
    ]);
    expect(compiled.bundle.bitmapFonts?.fonts[0]?.kernings).toEqual([
      { leftCodePoint: 65, rightCodePoint: 86, adjustment: -1 },
      { leftCodePoint: 86, rightCodePoint: 65, adjustment: -1 },
    ]);
    expect(compiled.canonicalJson).toContain("bitmap-font.dialogue");
  });

  it("produces identical output when authored font arrays are reordered", () => {
    const reordered = bitmapFontManifestSchema.parse({
      ...fonts,
      fonts: fonts.fonts.map((font) => ({
        ...font,
        glyphs: [...font.glyphs].reverse(),
        kernings: [...font.kernings].reverse(),
      })),
    });

    const first = compileProject(project, assets, fonts);
    const second = compileProject(project, assets, reordered);
    expect(second.canonicalJson).toBe(first.canonicalJson);
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it("omits the optional runtime font document when none is supplied", () => {
    expect(compileProject(project, assets).bundle.bitmapFonts).toBeUndefined();
  });

  it("blocks glyph rectangles outside the compiled atlas", () => {
    const broken = bitmapFontManifestSchema.parse({
      ...fonts,
      fonts: fonts.fonts.map((font) => ({
        ...font,
        glyphs: font.glyphs.map((glyph) =>
          glyph.codePoint === 65
            ? {
                ...glyph,
                sourceRect: { x: 30, y: 0, width: 6, height: 8 },
              }
            : glyph,
        ),
      })),
    });

    expect(() => compileProject(project, assets, broken)).toThrowError(
      expect.objectContaining<Partial<ProjectCompilationError>>({
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "compiled-font-image-bounds" }),
        ]),
      }),
    );
  });
});
