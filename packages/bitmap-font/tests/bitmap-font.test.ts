import { describe, expect, it } from "vitest";
import { assetBuildManifestSchema } from "@evavo/adventure-asset-contract";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  bitmapFontManifestSchema,
  validateBitmapFontManifest,
} from "../src/index.js";
import { layoutBitmapText } from "../src/layout.js";
import { validateCompiledBitmapFontMappings } from "../src/compiled-mapping.js";

const hash = "0".repeat(64);

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.bitmap-font",
  title: "Bitmap Font",
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
    {
      id: "asset.font.ui",
      path: "art/font-ui.aseprite",
      kind: "spritesheet",
    },
  ],
  inventoryItems: [],
});

const imageFontManifest = bitmapFontManifestSchema.parse({
  manifestVersion: 1,
  projectId: project.id,
  fonts: [
    {
      id: "bitmap-font.dialogue",
      name: "Dialogue 8px",
      atlasAssetId: "asset.font.dialogue",
      lineHeight: 10,
      baseline: 8,
      spaceAdvance: 4,
      letterSpacing: 1,
      fallbackCodePoint: 63,
      glyphs: [
        {
          id: "font-glyph.dialogue.question",
          codePoint: 63,
          sourceRect: { x: 0, y: 0, width: 5, height: 8 },
          bearing: { x: 0, y: -8 },
          advance: 6,
        },
        {
          id: "font-glyph.dialogue.A",
          codePoint: 65,
          sourceRect: { x: 5, y: 0, width: 6, height: 8 },
          bearing: { x: 0, y: -8 },
          advance: 7,
        },
        {
          id: "font-glyph.dialogue.V",
          codePoint: 86,
          sourceRect: { x: 11, y: 0, width: 6, height: 8 },
          bearing: { x: 0, y: -8 },
          advance: 7,
        },
      ],
      kernings: [
        {
          leftCodePoint: 65,
          rightCodePoint: 86,
          adjustment: -1,
        },
      ],
    },
  ],
});

const spritesheetFontManifest = bitmapFontManifestSchema.parse({
  manifestVersion: 1,
  projectId: project.id,
  fonts: [
    {
      id: "bitmap-font.ui",
      name: "UI 6px",
      atlasAssetId: "asset.font.ui",
      lineHeight: 8,
      baseline: 6,
      spaceAdvance: 3,
      letterSpacing: 0,
      fallbackCodePoint: 63,
      glyphs: [
        {
          id: "font-glyph.ui.question",
          codePoint: 63,
          frameId: "frame.font.ui.question",
          sourceRect: { x: 1, y: 1, width: 4, height: 6 },
          bearing: { x: 0, y: -6 },
          advance: 5,
        },
      ],
      kernings: [],
    },
  ],
});

describe("bitmap font validation", () => {
  it("accepts image and spritesheet atlas contracts", () => {
    expect(validateBitmapFontManifest(project, imageFontManifest)).toEqual([]);
    expect(validateBitmapFontManifest(project, spritesheetFontManifest)).toEqual(
      [],
    );
  });

  it("reports missing fallback, duplicate code points and atlas-mode drift", () => {
    const broken = bitmapFontManifestSchema.parse({
      ...imageFontManifest,
      fonts: [
        {
          ...imageFontManifest.fonts[0],
          fallbackCodePoint: 88,
          glyphs: [
            imageFontManifest.fonts[0]!.glyphs[0],
            {
              ...imageFontManifest.fonts[0]!.glyphs[1],
              id: "font-glyph.dialogue.duplicate",
              codePoint: 63,
              frameId: "frame.unexpected",
            },
          ],
        },
      ],
    });

    expect(validateBitmapFontManifest(project, broken).map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "missing-fallback-glyph",
        "duplicate-code-point",
        "unexpected-glyph-frame-id",
      ]),
    );
  });
});

describe("bitmap text layout", () => {
  const font = imageFontManifest.fonts[0]!;

  it("applies integer advances and kerning", () => {
    const layout = layoutBitmapText(font, "AV");

    expect(layout.placements.map((placement) => placement.x)).toEqual([0, 7]);
    expect(layout.lines[0]?.width).toBe(14);
    expect(layout.height).toBe(10);
  });

  it("wraps words and aligns lines without browser metrics", () => {
    const layout = layoutBitmapText(font, "AV AV", {
      maxWidth: 18,
      alignment: "right",
      lineSpacing: 2,
    });

    expect(layout.lines).toHaveLength(2);
    expect(layout.width).toBe(18);
    expect(layout.height).toBe(22);
    expect(layout.placements[0]?.x).toBe(4);
    expect(layout.placements[2]?.y).toBe(12);
  });

  it("uses the fallback glyph and reports missing code points", () => {
    const layout = layoutBitmapText(font, "AΩ");

    expect(layout.placements[1]).toMatchObject({
      codePoint: 937,
      glyphId: "font-glyph.dialogue.question",
    });
    expect(layout.fallbackCodePoints).toEqual([937]);
  });

  it("supports explicit newlines, spaces and tabs", () => {
    const layout = layoutBitmapText(font, "A V\nA\tV", {
      tabSpaces: 2,
    });

    expect(layout.lines).toHaveLength(2);
    expect(layout.placements).toHaveLength(4);
    expect(layout.placements[2]?.y).toBe(10);
  });
});

describe("compiled bitmap font mappings", () => {
  const compiled = assetBuildManifestSchema.parse({
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
          {
            path: "art/font-dialogue.png",
            sha256: hash,
            byteLength: 1,
          },
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
      {
        assetId: "asset.font.ui",
        kind: "spritesheet",
        sourceFiles: [
          {
            path: "art/font-ui.aseprite",
            sha256: hash,
            byteLength: 1,
          },
        ],
        outputFiles: [
          {
            role: "atlas-manifest",
            runtimePath: "assets/font-ui/atlas.json",
            mediaType: "application/json",
            sha256: hash,
            byteLength: 1,
          },
          {
            role: "page-000",
            runtimePath: "assets/font-ui/page.png",
            mediaType: "image/png",
            sha256: hash,
            byteLength: 1,
          },
        ],
        metadata: {
          kind: "spritesheet",
          pages: [{ outputRole: "page-000", width: 32, height: 16 }],
          frames: [
            {
              frameId: "frame.font.ui.question",
              pageOutputRole: "page-000",
              sourceRect: { x: 1, y: 1, width: 4, height: 6 },
              originalSize: { width: 4, height: 6 },
              trimOffset: { x: 0, y: 0 },
              padding: 1,
            },
          ],
        },
      },
    ],
  });

  it("accepts image bounds and exact atlas frame rectangles", () => {
    expect(validateCompiledBitmapFontMappings(imageFontManifest, compiled)).toEqual(
      [],
    );
    expect(
      validateCompiledBitmapFontMappings(spritesheetFontManifest, compiled),
    ).toEqual([]);
  });

  it("reports stale atlas frame geometry", () => {
    const broken = bitmapFontManifestSchema.parse({
      ...spritesheetFontManifest,
      fonts: [
        {
          ...spritesheetFontManifest.fonts[0],
          glyphs: [
            {
              ...spritesheetFontManifest.fonts[0]!.glyphs[0],
              sourceRect: { x: 2, y: 1, width: 4, height: 6 },
            },
          ],
        },
      ],
    });

    expect(
      validateCompiledBitmapFontMappings(broken, compiled).map(
        (issue) => issue.code,
      ),
    ).toContain("compiled-font-frame-rectangle-mismatch");
  });
});
