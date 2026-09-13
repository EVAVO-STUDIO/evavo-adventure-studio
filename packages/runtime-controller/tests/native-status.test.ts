import { bitmapFontManifestSchema } from "@evavo/adventure-bitmap-font";
import type { Id } from "@evavo/adventure-project-schema";
import type { ResolvedFrame } from "@evavo/adventure-render-contract";
import { describe, expect, it } from "vitest";
import { appendNativeStatusPanel } from "../src/native-status.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const frame: ResolvedFrame = {
  frameVersion: 1,
  tick: 0,
  canvas: { width: 320, height: 200, clearColor: [0, 0, 0, 255] },
  camera: {
    position: { x: 0, y: 0 },
    viewport: { width: 320, height: 200 },
    shakeOffset: { x: 0, y: 0 },
  },
  nodes: [
    {
      kind: "solid-rectangle",
      id: id<"render-node">("background"),
      order: {
        layer: "background",
        elevation: 0,
        baselineY: 200,
        zOffset: 0,
        stableId: "background",
      },
      transform: {
        position: { x: 0, y: 0 },
        pivot: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotationRadians: 0,
      },
      opacity: 1,
      visible: true,
      size: { width: 320, height: 200 },
      color: 0,
    },
  ],
};

const fonts = bitmapFontManifestSchema.parse({
  manifestVersion: 1,
  projectId: "project.status",
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
          id: "font-glyph.ui.question",
          codePoint: 63,
          sourceRect: { x: 0, y: 0, width: 4, height: 6 },
          bearing: { x: 0, y: -6 },
          advance: 5,
        },
      ],
      kernings: [],
    },
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
      ],
      kernings: [],
    },
  ],
});

describe("native bitmap status rail", () => {
  it("uses the deterministic dialogue font and appends native UI nodes", () => {
    const composed = appendNativeStatusPanel(frame, { bitmapFonts: fonts }, "Nothing useful happens.");

    expect(composed.nodes).toHaveLength(4);
    expect(composed.nodes.at(-1)).toMatchObject({
      kind: "bitmap-text",
      fontId: "bitmap-font.dialogue",
      fontAssetId: "asset.font.dialogue",
      text: "Nothing useful happens.",
      maximumWidth: 304,
      lineHeight: 10,
      outlineColor: 0x05060a,
    });
    expect(composed.nodes[1]).toMatchObject({
      kind: "solid-rectangle",
      size: { width: 320, height: 18 },
      transform: { position: { x: 0, y: 182 } },
    });
  });

  it("returns the original frame when fonts or text are absent", () => {
    expect(appendNativeStatusPanel(frame, {}, "STATUS")).toBe(frame);
    expect(appendNativeStatusPanel(frame, { bitmapFonts: fonts }, "   ")).toBe(frame);
  });
});
