import { describe, expect, it } from "vitest";
import { bitmapFontManifestSchema } from "@evavo/adventure-bitmap-font";
import { registerBitmapFontsForAssetCollection } from "@evavo/adventure-bitmap-font/runtime-registry";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeAssetRecord } from "@evavo/adventure-asset-contract/runtime-asset";
import { PixiAssetTextureStore } from "../src/texture-store.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const fonts = bitmapFontManifestSchema.parse({
  manifestVersion: 1,
  projectId: "project.renderer-fonts",
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

describe("runtime bitmap font handoff", () => {
  it("adopts the resolver associated with the exact runtime asset collection", async () => {
    const assets: RuntimeAssetRecord[] = [];
    registerBitmapFontsForAssetCollection(assets, fonts);
    const store = new PixiAssetTextureStore({ aliasNamespace: "font-test" });

    await store.loadRuntimeAssets(assets, "https://example.test/game.bundle.json");

    expect(
      store
        .getBitmapFontResolver()
        ?.getFont(
          id<"bitmap-font">("bitmap-font.dialogue"),
          id<"asset">("asset.font.dialogue"),
        )?.name,
    ).toBe("Dialogue");
    await store.dispose();
    expect(store.getBitmapFontResolver()).toBeNull();
  });

  it("does not adopt fonts registered for a different array identity", async () => {
    const registered: RuntimeAssetRecord[] = [];
    const loaded: RuntimeAssetRecord[] = [];
    registerBitmapFontsForAssetCollection(registered, fonts);
    const store = new PixiAssetTextureStore({ aliasNamespace: "identity-test" });

    await store.loadRuntimeAssets(loaded, "https://example.test/game.bundle.json");
    expect(store.getBitmapFontResolver()).toBeNull();
  });
});
