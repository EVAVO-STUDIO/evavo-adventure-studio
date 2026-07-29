import { describe, expect, it } from "vitest";
import {
  parseRuntimeBundle,
  RuntimeBitmapFontValidationError,
} from "../src/index.js";

const hash = "0".repeat(64);

const runtimeBundle = () => ({
  bundleVersion: 1 as const,
  sourceSchemaVersion: 1 as const,
  projectId: "project.runtime-font",
  title: "Runtime Font",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context" as const,
    integerScale: true,
    textureSampling: "nearest" as const,
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict" as const,
    showScore: false,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.office",
  startEntranceId: "entrance.office",
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [
    {
      assetId: "asset.office",
      kind: "image" as const,
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
        kind: "image" as const,
        width: 320,
        height: 200,
        palette: true,
        colourCount: 128,
      },
    },
    {
      assetId: "asset.font.dialogue",
      kind: "image" as const,
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
        kind: "image" as const,
        width: 32,
        height: 16,
        palette: true,
        colourCount: 16,
      },
    },
  ],
  inventoryItems: [],
  actors: [],
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
          facing: "east" as const,
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  dialogues: [],
  sequences: [],
  bitmapFonts: {
    manifestVersion: 1 as const,
    projectId: "project.runtime-font",
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
        ],
        kernings: [],
      },
    ],
  },
});

describe("runtime bitmap fonts", () => {
  it("accepts source-free font definitions with compiled atlas evidence", () => {
    const parsed = parseRuntimeBundle(runtimeBundle());
    expect(parsed.bitmapFonts?.fonts[0]?.id).toBe("bitmap-font.dialogue");
  });

  it("rejects glyph rectangles outside the packaged atlas", () => {
    const input = runtimeBundle();
    input.bitmapFonts.fonts[0]!.glyphs[0]!.sourceRect = {
      x: 30,
      y: 0,
      width: 5,
      height: 8,
    };

    expect(() => parseRuntimeBundle(input)).toThrow(
      RuntimeBitmapFontValidationError,
    );
  });

  it("rejects font atlases removed from the packaged assets", () => {
    const input = runtimeBundle();
    input.assets = input.assets.filter(
      (asset) => asset.assetId !== "asset.font.dialogue",
    );

    expect(() => parseRuntimeBundle(input)).toThrow(
      RuntimeBitmapFontValidationError,
    );
  });
});
