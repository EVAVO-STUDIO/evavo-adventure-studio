import { describe, expect, it } from "vitest";
import type { Id } from "@evavo/adventure-project-schema";
import type {
  BitmapTextRenderNode,
  ResolvedFrame,
} from "@evavo/adventure-render-contract";
import { bitmapFontManifestSchema } from "../src/index.js";
import {
  BitmapFontResolutionError,
  createBitmapFontResolver,
  expandBitmapTextFrame,
  resolveBitmapTextNode,
} from "../src/render.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const manifest = bitmapFontManifestSchema.parse({
  manifestVersion: 1,
  projectId: "project.font-render",
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
          sourceRect: { x: 0, y: 0, width: 4, height: 8 },
          bearing: { x: 0, y: -8 },
          advance: 5,
        },
        {
          id: "font-glyph.A",
          codePoint: 65,
          sourceRect: { x: 4, y: 0, width: 6, height: 8 },
          bearing: { x: 0, y: -8 },
          advance: 7,
        },
      ],
      kernings: [],
    },
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

const textNode = (
  overrides: Partial<BitmapTextRenderNode> = {},
): BitmapTextRenderNode => ({
  kind: "bitmap-text",
  id: id<"render-node">("text.dialogue"),
  order: {
    layer: "speech",
    elevation: 0,
    baselineY: 80,
    zOffset: 0,
    stableId: "text.dialogue",
  },
  transform: {
    position: { x: 20, y: 40 },
    pivot: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotationRadians: 0,
  },
  opacity: 1,
  visible: true,
  fontAssetId: id<"asset">("asset.font.dialogue"),
  fontId: id<"bitmap-font">("bitmap-font.dialogue"),
  text: "A",
  maximumWidth: 80,
  lineHeight: 10,
  align: "left",
  color: 0xffffff,
  ...overrides,
});

describe("bitmap font render resolution", () => {
  it("expands a glyph into a nearest-sampled atlas sprite", () => {
    const sprites = resolveBitmapTextNode(
      textNode(),
      createBitmapFontResolver(manifest),
    );

    expect(sprites).toHaveLength(1);
    expect(sprites[0]).toMatchObject({
      kind: "sprite",
      assetId: "asset.font.dialogue",
      sourceRect: { x: 4, y: 0, width: 6, height: 8 },
      transform: { position: { x: 20, y: 40 } },
      sampling: "nearest",
      tintRgba: [255, 255, 255, 255],
    });
  });

  it("renders black outlines as eight native-pixel passes behind the fill", () => {
    const sprites = resolveBitmapTextNode(
      textNode({ outlineColor: 0x000000 }),
      createBitmapFontResolver(manifest),
    );

    expect(sprites).toHaveLength(9);
    expect(sprites.slice(0, 8).every((sprite) => sprite.order.zOffset === -1)).toBe(
      true,
    );
    expect(sprites[0]?.tintRgba).toEqual([0, 0, 0, 255]);
    expect(sprites.at(-1)?.order.zOffset).toBe(0);
  });

  it("preserves atlas frame identity and RGBA alpha", () => {
    const sprites = resolveBitmapTextNode(
      textNode({
        fontAssetId: id<"asset">("asset.font.ui"),
        fontId: id<"bitmap-font">("bitmap-font.ui"),
        text: "?",
        lineHeight: 8,
        color: [200, 120, 80, 128],
      }),
      createBitmapFontResolver(manifest),
    );

    expect(sprites[0]).toMatchObject({
      frameId: "frame.font.ui.question",
      opacity: 128 / 255,
      tintRgba: [200, 120, 80, 255],
    });
  });

  it("applies parent pivot, scale and rotation to glyph positions", () => {
    const sprites = resolveBitmapTextNode(
      textNode({
        transform: {
          position: { x: 50, y: 60 },
          pivot: { x: 2, y: 0 },
          scale: { x: 2, y: 1 },
          rotationRadians: Math.PI / 2,
        },
      }),
      createBitmapFontResolver(manifest),
    );

    expect(sprites[0]?.transform.position.x).toBeCloseTo(50);
    expect(sprites[0]?.transform.position.y).toBeCloseTo(56);
    expect(sprites[0]?.transform.scale).toEqual({ x: 2, y: 1 });
  });

  it("requires an explicit font ID when an atlas is ambiguous", () => {
    const ambiguous = bitmapFontManifestSchema.parse({
      ...manifest,
      fonts: [
        manifest.fonts[0],
        { ...manifest.fonts[0], id: "bitmap-font.dialogue.compact" },
      ],
    });
    const { fontId: _fontId, ...atlasOnlyNode } = textNode();

    expect(() =>
      resolveBitmapTextNode(
        atlasOnlyNode,
        createBitmapFontResolver(ambiguous),
      ),
    ).toThrow(BitmapFontResolutionError);
  });

  it("expands bitmap nodes while preserving ordinary render nodes", () => {
    const frame: ResolvedFrame = {
      frameVersion: 1,
      tick: 4,
      canvas: { width: 320, height: 200, clearColor: [0, 0, 0, 255] },
      camera: {
        position: { x: 0, y: 0 },
        viewport: { width: 320, height: 200 },
        shakeOffset: { x: 0, y: 0 },
      },
      nodes: [
        textNode(),
        {
          kind: "solid-rectangle",
          id: id<"render-node">("panel"),
          order: {
            layer: "interface",
            elevation: 0,
            baselineY: 180,
            zOffset: 0,
            stableId: "panel",
          },
          transform: {
            position: { x: 0, y: 170 },
            pivot: { x: 0, y: 0 },
            scale: { x: 1, y: 1 },
            rotationRadians: 0,
          },
          opacity: 1,
          visible: true,
          size: { width: 320, height: 30 },
          color: 0x101018,
        },
      ],
    };

    const expanded = expandBitmapTextFrame(
      frame,
      createBitmapFontResolver(manifest),
    );
    expect(expanded.nodes.map((node) => node.kind)).toEqual([
      "sprite",
      "solid-rectangle",
    ]);
  });
});
