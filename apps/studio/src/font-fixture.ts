import { type BitmapFontManifest, bitmapFontManifestSchema } from "@evavo/adventure-bitmap-font";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { studioProject } from "./fixture.js";

export const studioFontProject = parseAdventureProject({
  ...studioProject,
  assets: [
    ...studioProject.assets,
    {
      id: "asset.font.dialogue",
      path: "art/fonts/dialogue-8px.png",
      kind: "image",
    },
  ],
});

const GLYPH_CHARACTERS = "?ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!:'-()";

const glyphs = [...GLYPH_CHARACTERS].map((character, index) => {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) {
    throw new Error("Studio bitmap font character has no code point.");
  }
  const column = index % 10;
  const row = Math.floor(index / 10);
  const width = character === "I" || character === "1" ? 3 : 5;
  return {
    id: `font-glyph.dialogue.${codePoint}`,
    codePoint,
    sourceRect: {
      x: column * 8,
      y: row * 10,
      width,
      height: 8,
    },
    bearing: { x: 0, y: -8 },
    advance: width + 1,
  };
});

export const studioBitmapFonts: BitmapFontManifest = bitmapFontManifestSchema.parse({
  manifestVersion: 1,
  projectId: studioFontProject.id,
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
      glyphs,
      kernings: [
        { leftCodePoint: 65, rightCodePoint: 86, adjustment: -1 },
        { leftCodePoint: 84, rightCodePoint: 65, adjustment: -1 },
        { leftCodePoint: 89, rightCodePoint: 65, adjustment: -1 },
      ],
    },
  ],
});
