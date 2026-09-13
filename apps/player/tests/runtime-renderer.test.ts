import { bitmapFontManifestSchema } from "@evavo/adventure-bitmap-font";
import type { Id } from "@evavo/adventure-project-schema";
import { PixiWebGLRenderer } from "@evavo/adventure-renderer-pixi";
import { PixiIndexedWebGLRenderer } from "@evavo/adventure-renderer-pixi/indexed-renderer";
import { PixiAssetTextureStore } from "@evavo/adventure-renderer-pixi/texture-store";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  createPackagedRendererOptions,
  createPackagedRuntimeRenderer,
} from "../src/runtime-renderer.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;
const textures = {} as PixiAssetTextureStore;
const presentation = {
  nativeWidth: 320,
  nativeHeight: 200,
  interactionMode: "context" as const,
  integerScale: true,
  textureSampling: "nearest" as const,
  logicalTicksPerSecond: 60,
  pixelMotionPolicy: "strict" as const,
  showScore: false,
  allowHotspotAssist: false,
};

const bitmapFonts = bitmapFontManifestSchema.parse({
  manifestVersion: 1,
  projectId: "project.player-fonts",
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
});

const baseBundle = {
  projectId: "project.renderer-test",
  presentation,
} as unknown as RuntimeBundle;

const indexedBundle = {
  ...baseBundle,
  indexedAssets: {
    manifestVersion: 1,
    projectId: "project.renderer-test",
    assets: [
      {
        assetId: "asset.actor",
        width: 1,
        height: 1,
        indexRuntimePath: "indexed/actor.idx",
        indexSha256: "a".repeat(64),
        indexByteLength: 1,
        defaultPalette: {
          paletteAssetId: "asset.palette.base",
          paletteOffset: 0,
        },
        frames: [],
      },
    ],
  },
} as unknown as RuntimeBundle;

describe("packaged runtime renderer options", () => {
  it("preserves fontless bundle compatibility", () => {
    const options = createPackagedRendererOptions({ presentation }, textures);
    expect(options.textures).toBe(textures);
    expect(options.bitmapFonts).toBeUndefined();
  });

  it("creates an exact font and atlas resolver from the bundle", () => {
    const options = createPackagedRendererOptions({ bitmapFonts, presentation }, textures);
    const resolver = options.bitmapFonts;

    expect(
      resolver?.getFont(id<"bitmap-font">("bitmap-font.dialogue"), id<"asset">("asset.font.dialogue")),
    ).toMatchObject({ name: "Dialogue" });
    expect(resolver?.getFont(null, id<"asset">("asset.font.dialogue"))?.id).toBe("bitmap-font.dialogue");
    expect(
      resolver?.getFont(id<"bitmap-font">("bitmap-font.dialogue"), id<"asset">("asset.other")),
    ).toBeNull();
  });

  it("keeps legacy bundles on the normal Pixi renderer", () => {
    const store = new PixiAssetTextureStore();
    const renderer = createPackagedRuntimeRenderer(baseBundle, store);
    expect(renderer).toBeInstanceOf(PixiWebGLRenderer);
    expect(renderer).not.toBeInstanceOf(PixiIndexedWebGLRenderer);
  });

  it("selects the indexed Pixi subclass once the texture store has a bundle URL", async () => {
    const store = new PixiAssetTextureStore();
    await store.loadRuntimeAssets([], "https://example.test/release/game.bundle.json");
    const renderer = createPackagedRuntimeRenderer(indexedBundle, store);
    expect(renderer).toBeInstanceOf(PixiIndexedWebGLRenderer);
  });

  it("fails early when indexed metadata has no retained bundle URL", () => {
    const store = new PixiAssetTextureStore();
    expect(() => createPackagedRuntimeRenderer(indexedBundle, store)).toThrow(/bundle URL/u);
  });
});
