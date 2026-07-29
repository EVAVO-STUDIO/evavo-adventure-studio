import { describe, expect, it } from "vitest";
import type { PixiAssetTextureStore } from "@evavo/adventure-renderer-pixi/texture-store";
import { createPackagedRendererOptions } from "../src/runtime-renderer.js";

const textures = {} as PixiAssetTextureStore;

const bitmapFonts = {
  manifestVersion: 1 as const,
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
};

describe("packaged runtime renderer options", () => {
  it("preserves fontless bundle compatibility", () => {
    const options = createPackagedRendererOptions({}, textures);
    expect(options.textures).toBe(textures);
    expect(options.bitmapFonts).toBeUndefined();
  });

  it("creates an exact font and atlas resolver from the bundle", () => {
    const options = createPackagedRendererOptions({ bitmapFonts }, textures);
    const resolver = options.bitmapFonts;

    expect(resolver?.getFont("bitmap-font.dialogue", "asset.font.dialogue")).toMatchObject({
      name: "Dialogue",
    });
    expect(resolver?.getFont(null, "asset.font.dialogue")?.id).toBe(
      "bitmap-font.dialogue",
    );
    expect(resolver?.getFont("bitmap-font.dialogue", "asset.other")).toBeNull();
  });
});
