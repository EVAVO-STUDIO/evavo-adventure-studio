import type { Id, Point } from "@evavo/adventure-project-schema";
import type {
  BitmapTextRenderNode,
  ResolvedFrame,
  SpriteRenderNode,
} from "@evavo/adventure-render-contract";
import {
  type BitmapFontDefinition,
  type BitmapFontManifest,
} from "./index.js";
import { layoutBitmapText } from "./layout.js";

export interface BitmapFontResolver {
  getFont(
    fontId: Id<"bitmap-font"> | null,
    fontAssetId: Id<"asset">,
  ): BitmapFontDefinition | null;
}

export class BitmapFontResolutionError extends Error {
  readonly nodeId: Id<"render-node">;
  readonly fontId: Id<"bitmap-font"> | null;
  readonly fontAssetId: Id<"asset">;

  constructor(node: BitmapTextRenderNode) {
    super(
      node.fontId
        ? `Bitmap font '${node.fontId}' for node '${node.id}' is unavailable or does not use atlas '${node.fontAssetId}'.`
        : `Bitmap text node '${node.id}' cannot resolve one unambiguous font for atlas '${node.fontAssetId}'.`,
    );
    this.name = "BitmapFontResolutionError";
    this.nodeId = node.id;
    this.fontId = node.fontId ?? null;
    this.fontAssetId = node.fontAssetId;
  }
}

export const createBitmapFontResolver = (
  manifest: BitmapFontManifest,
): BitmapFontResolver => {
  const byId = new Map(
    manifest.fonts.map((font) => [font.id as string, font] as const),
  );
  const byAsset = new Map<string, BitmapFontDefinition[]>();
  for (const font of manifest.fonts) {
    const fonts = byAsset.get(font.atlasAssetId) ?? [];
    fonts.push(font);
    byAsset.set(font.atlasAssetId, fonts);
  }

  return {
    getFont: (fontId, fontAssetId) => {
      if (fontId) {
        const font = byId.get(fontId);
        return font?.atlasAssetId === fontAssetId ? font : null;
      }
      const candidates = byAsset.get(fontAssetId) ?? [];
      return candidates.length === 1 ? (candidates[0] ?? null) : null;
    },
  };
};

type RenderColor = number | readonly [number, number, number, number];

type Rgba = readonly [number, number, number, number];

const colorToRgba = (color: RenderColor): Rgba => {
  if (typeof color === "number") {
    if (!Number.isInteger(color) || color < 0 || color > 0xffffff) {
      throw new RangeError(
        "Packed bitmap text colours must be integers from 0x000000 to 0xFFFFFF.",
      );
    }
    return [
      (color >> 16) & 0xff,
      (color >> 8) & 0xff,
      color & 0xff,
      0xff,
    ];
  }
  for (const channel of color) {
    if (!Number.isInteger(channel) || channel < 0 || channel > 255) {
      throw new RangeError("Bitmap text RGBA channels must be integers from 0 to 255.");
    }
  }
  return color;
};

const renderNodeId = (value: string): Id<"render-node"> =>
  value as Id<"render-node">;

const transformLocalPoint = (
  node: BitmapTextRenderNode,
  point: Point,
): Point => {
  const localX =
    (point.x - node.transform.pivot.x) * node.transform.scale.x;
  const localY =
    (point.y - node.transform.pivot.y) * node.transform.scale.y;
  const cosine = Math.cos(node.transform.rotationRadians);
  const sine = Math.sin(node.transform.rotationRadians);
  return {
    x: node.transform.position.x + localX * cosine - localY * sine,
    y: node.transform.position.y + localX * sine + localY * cosine,
  };
};

const OUTLINE_OFFSETS: readonly Point[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

const glyphSprite = (
  node: BitmapTextRenderNode,
  font: BitmapFontDefinition,
  glyphIndex: number,
  localPosition: Point,
  color: Rgba,
  outlineIndex: number | null,
): SpriteRenderNode => {
  const placement = layoutBitmapText(
    { ...font, lineHeight: node.lineHeight },
    node.text,
    {
      maxWidth: node.maximumWidth,
      alignment: node.align,
    },
  ).placements[glyphIndex];
  if (!placement) {
    throw new RangeError(`Bitmap glyph placement ${glyphIndex} is unavailable.`);
  }
  const glyph = placement.glyph;
  const suffix =
    outlineIndex === null ? "fill" : `outline.${outlineIndex.toString()}`;
  const alpha = color[3] / 255;

  return {
    kind: "sprite",
    id: renderNodeId(`${node.id}.glyph.${glyphIndex}.${suffix}`),
    order: {
      ...node.order,
      zOffset:
        node.order.zOffset + (outlineIndex === null ? 0 : -1),
      stableId: `${node.order.stableId}.glyph.${glyphIndex}.${suffix}`,
    },
    transform: {
      position: transformLocalPoint(node, localPosition),
      pivot: { x: 0, y: 0 },
      scale: node.transform.scale,
      rotationRadians: node.transform.rotationRadians,
    },
    opacity: node.opacity * alpha,
    visible: node.visible,
    ...(node.maskNodeId ? { maskNodeId: node.maskNodeId } : {}),
    assetId: font.atlasAssetId,
    ...(glyph.frameId ? { frameId: glyph.frameId } : {}),
    sourceRect: glyph.sourceRect,
    originalSize: {
      width: glyph.sourceRect.width,
      height: glyph.sourceRect.height,
    },
    trimOffset: { x: 0, y: 0 },
    sampling: "nearest",
    tintRgba: [color[0], color[1], color[2], 255],
  };
};

export const resolveBitmapTextNode = (
  node: BitmapTextRenderNode,
  resolver: BitmapFontResolver,
): readonly SpriteRenderNode[] => {
  const font = resolver.getFont(node.fontId ?? null, node.fontAssetId);
  if (!font) {
    throw new BitmapFontResolutionError(node);
  }
  if (node.lineHeight < font.baseline) {
    throw new RangeError(
      `Bitmap text line height ${node.lineHeight} is below font baseline ${font.baseline}.`,
    );
  }

  const layout = layoutBitmapText(
    { ...font, lineHeight: node.lineHeight },
    node.text,
    {
      maxWidth: node.maximumWidth,
      alignment: node.align,
    },
  );
  const fill = colorToRgba(node.color);
  const outline = node.outlineColor
    ? colorToRgba(node.outlineColor)
    : null;
  const sprites: SpriteRenderNode[] = [];

  layout.placements.forEach((placement, glyphIndex) => {
    if (outline) {
      OUTLINE_OFFSETS.forEach((offset, outlineIndex) => {
        sprites.push(
          glyphSprite(
            node,
            font,
            glyphIndex,
            {
              x: placement.x + offset.x,
              y: placement.y + offset.y,
            },
            outline,
            outlineIndex,
          ),
        );
      });
    }
    sprites.push(
      glyphSprite(
        node,
        font,
        glyphIndex,
        { x: placement.x, y: placement.y },
        fill,
        null,
      ),
    );
  });

  return sprites;
};

export const expandBitmapTextFrame = (
  frame: ResolvedFrame,
  resolver: BitmapFontResolver,
): ResolvedFrame => ({
  ...frame,
  nodes: frame.nodes.flatMap((node) =>
    node.kind === "bitmap-text"
      ? resolveBitmapTextNode(node, resolver)
      : [node],
  ),
});
