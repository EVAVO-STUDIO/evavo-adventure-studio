import { bitmapFontManifestSchema } from "@evavo/adventure-bitmap-font";
import type { Id } from "@evavo/adventure-project-schema";
import type { PixiAssetTextureStore } from "@evavo/adventure-renderer-pixi/texture-store";
import { describe, expect, it } from "vitest";
import { createPackagedRendererOptions } from "../src/runtime-renderer.js";

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
});
