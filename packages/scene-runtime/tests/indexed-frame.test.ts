import type { Id } from "@evavo/adventure-project-schema";
import type { ResolvedFrame, SpriteRenderNode } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  applyIndexedAssetsToFrame,
  IndexedSpriteTintConflictError,
} from "../src/indexed-frame.js";

const asId = <T extends string>(value: string): Id<T> => value as Id<T>;

const sprite = (assetId = "asset.actor", tint = false): SpriteRenderNode => ({
  kind: "sprite",
  id: asId<"render-node">("render.actor"),
  assetId: asId<"asset">(assetId),
  frameId: asId<"sprite-frame">("frame.actor.idle"),
  sourceRect: { x: 2, y: 4, width: 16, height: 32 },
  originalSize: { width: 20, height: 36 },
  trimOffset: { x: 2, y: 3 },
  sampling: "nearest",
  ...(tint ? { tintRgba: [255, 200, 160, 255] as const } : {}),
  order: {
    layer: "world",
    elevation: 0,
    baselineY: 160,
    zOffset: 0,
    stableId: "actor",
  },
  transform: {
    position: { x: 80, y: 160 },
    pivot: { x: 10, y: 35 },
    scale: { x: 0.9, y: 0.9 },
    rotationRadians: 0,
  },
  opacity: 1,
  visible: true,
});

const frame = (node: SpriteRenderNode): ResolvedFrame => ({
  frameVersion: 1,
  tick: 12,
  canvas: { width: 320, height: 200, clearColor: [0, 0, 0, 255] },
  camera: {
    position: { x: 0, y: 0 },
    viewport: { width: 320, height: 200 },
    shakeOffset: { x: 0, y: 0 },
  },
  nodes: [node],
});

const bundle = {
  indexedAssets: {
    manifestVersion: 1,
    projectId: asId<"project">("project.indexed-frame"),
    assets: [
      {
        assetId: asId<"asset">("asset.actor"),
        width: 64,
        height: 64,
        indexRuntimePath: "indexed/actor.idx",
        indexSha256: "a".repeat(64),
        indexByteLength: 4096,
        transparentIndex: 0,
        defaultPalette: {
          paletteAssetId: asId<"asset">("asset.palette.actor"),
          paletteOffset: 16,
        },
        frames: [],
      },
    ],
  },
} as unknown as RuntimeBundle;

describe("canonical indexed frame conversion", () => {
  it("converts a normal runtime sprite to an indexed node using sidecar defaults", () => {
    const source = sprite();
    const resolved = applyIndexedAssetsToFrame(bundle, frame(source));
    expect(resolved.nodes[0]).toMatchObject({
      kind: "indexed-sprite",
      id: "render.actor",
      indexAssetId: "asset.actor",
      paletteAssetId: "asset.palette.actor",
      paletteOffset: 16,
      sourceRect: source.sourceRect,
      originalSize: source.originalSize,
      trimOffset: source.trimOffset,
      order: source.order,
      transform: source.transform,
      opacity: 1,
      visible: true,
    });
  });

  it("leaves assets without indexed metadata on the ordinary sprite path", () => {
    const source = sprite("asset.other");
    expect(applyIndexedAssetsToFrame(bundle, frame(source)).nodes[0]).toBe(source);
  });

  it("rejects RGBA tint on an asset declared as indexed VGA artwork", () => {
    expect(() => applyIndexedAssetsToFrame(bundle, frame(sprite("asset.actor", true)))).toThrow(
      IndexedSpriteTintConflictError,
    );
  });
});
