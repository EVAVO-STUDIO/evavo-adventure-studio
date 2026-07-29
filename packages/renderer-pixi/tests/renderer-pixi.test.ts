import { describe, expect, it } from "vitest";
import type { Id } from "@evavo/adventure-project-schema";
import type {
  BitmapTextRenderNode,
  SolidRectangleRenderNode,
  SpriteRenderNode,
} from "@evavo/adventure-render-contract";
import {
  pixiSupportsNode,
  toPixiFill,
} from "../src/index.js";

const id = <T extends string>(value: string) => value as Id<T>;

const transform = {
  position: { x: 0, y: 0 },
  pivot: { x: 0, y: 0 },
  scale: { x: 1, y: 1 },
  rotationRadians: 0,
} as const;

const order = {
  layer: "world",
  elevation: 0,
  baselineY: 0,
  zOffset: 0,
  stableId: "fixture",
} as const;

describe("PixiJS renderer contracts", () => {
  it("converts byte RGBA colours without losing alpha", () => {
    expect(toPixiFill([0x12, 0x34, 0x56, 0x80])).toEqual({
      color: 0x123456,
      alpha: 0x80 / 255,
    });
    expect(toPixiFill(0xff244e)).toEqual({ color: 0xff244e, alpha: 1 });
  });

  it("rejects invalid colour channels", () => {
    expect(() => toPixiFill([256, 0, 0, 255])).toThrow(RangeError);
    expect(() => toPixiFill(-1)).toThrow(RangeError);
  });

  it("advertises only implemented first-slice node kinds", () => {
    const sprite: SpriteRenderNode = {
      kind: "sprite",
      id: id<"render-node">("render.sprite"),
      order,
      transform,
      opacity: 1,
      visible: true,
      assetId: id<"asset">("asset.sprite"),
      sourceRect: { x: 0, y: 0, width: 16, height: 16 },
      originalSize: { width: 16, height: 16 },
      trimOffset: { x: 0, y: 0 },
      sampling: "nearest",
    };
    const rectangle: SolidRectangleRenderNode = {
      kind: "solid-rectangle",
      id: id<"render-node">("render.rectangle"),
      order,
      transform,
      opacity: 1,
      visible: true,
      size: { width: 16, height: 16 },
      color: 0,
    };
    const text: BitmapTextRenderNode = {
      kind: "bitmap-text",
      id: id<"render-node">("render.text"),
      order: { ...order, layer: "interface" },
      transform,
      opacity: 1,
      visible: true,
      fontAssetId: id<"asset">("asset.font"),
      text: "LOOK",
      maximumWidth: 100,
      lineHeight: 8,
      align: "left",
      color: 0xffffff,
    };

    expect(pixiSupportsNode(sprite)).toBe(true);
    expect(pixiSupportsNode(rectangle)).toBe(true);
    expect(pixiSupportsNode(text)).toBe(false);
  });
});
