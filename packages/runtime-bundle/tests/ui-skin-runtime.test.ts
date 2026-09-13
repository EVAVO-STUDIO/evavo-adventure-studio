import { describe, expect, it } from "vitest";
import { parseRuntimeBundle, RuntimeUiSkinValidationError } from "../src/index.js";

const hash = "0".repeat(64);

const runtimeBundle = () => ({
  bundleVersion: 1 as const,
  sourceSchemaVersion: 1 as const,
  projectId: "project.runtime-ui",
  title: "Runtime UI",
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
      assetId: "asset.font.ui",
      kind: "image" as const,
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/font-ui.png",
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
    projectId: "project.runtime-ui",
    fonts: [
      {
        id: "bitmap-font.ui",
        name: "UI",
        atlasAssetId: "asset.font.ui",
        lineHeight: 8,
        baseline: 6,
        spaceAdvance: 3,
        letterSpacing: 0,
        fallbackCodePoint: 63,
        glyphs: [
          {
            id: "font-glyph.question",
            codePoint: 63,
            sourceRect: { x: 0, y: 0, width: 4, height: 6 },
            bearing: { x: 0, y: -6 },
            advance: 5,
          },
        ],
        kernings: [],
      },
    ],
  },
  uiSkins: {
    manifestVersion: 1 as const,
    projectId: "project.runtime-ui",
    defaultSkinId: "ui-skin.context",
    skins: [
      {
        id: "ui-skin.context",
        name: "Context",
        interactionMode: "context" as const,
        nativeSize: { width: 320, height: 200 },
        status: {
          id: "ui-region.status",
          rect: { x: 0, y: 182, width: 320, height: 18 },
          padding: 4,
          panel: {
            fill: [8, 10, 16, 240] as const,
            border: 0x333744,
            borderWidth: 1,
          },
        },
        verbs: [],
        fonts: {
          status: {
            fontId: "bitmap-font.ui",
            color: 0xffffff,
            outlineColor: 0,
            align: "left" as const,
          },
        },
      },
    ],
  },
});

describe("runtime interface skins", () => {
  it("accepts source-free skins with bundled bitmap fonts", () => {
    const parsed = parseRuntimeBundle(runtimeBundle());
    expect(parsed.uiSkins?.defaultSkinId).toBe("ui-skin.context");
  });

  it("rejects UI font references missing from the bundle", () => {
    const input = runtimeBundle();
    input.uiSkins.skins[0]!.fonts.status.fontId = "bitmap-font.missing";

    expect(() => parseRuntimeBundle(input)).toThrow(RuntimeUiSkinValidationError);
  });

  it("rejects default skin interaction-mode drift", () => {
    const input = runtimeBundle();
    const [defaultSkin] = input.uiSkins.skins;
    if (!defaultSkin) {
      throw new Error("Expected the runtime UI fixture to contain its default skin.");
    }
    const drifted = {
      ...input,
      uiSkins: {
        ...input.uiSkins,
        skins: [{ ...defaultSkin, interactionMode: "verb-list" as const }],
      },
    };

    expect(() => parseRuntimeBundle(drifted)).toThrow(RuntimeUiSkinValidationError);
  });
});
