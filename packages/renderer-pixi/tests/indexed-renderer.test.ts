import type { Id } from "@evavo/adventure-project-schema";
import type { IndexedSpriteRenderNode, ResolvedFrame } from "@evavo/adventure-render-contract";
import { describe, expect, it } from "vitest";
import { expandIndexedPixiFrame } from "../src/indexed-renderer.js";

const indexedNode = (
  paletteOffset: number,
): IndexedSpriteRenderNode => ({
  id: "render-node.test-indexed" as Id<"render-node">,
  kind: "indexed-sprite",
  indexAssetId: "asset.index-map.officer" as Id<"asset">,
  paletteAssetId: "asset.palette.station" as Id<"asset">,
  sourceRect: { x: 0, y: 0, width: 24, height: 48 },
  originalSize: { width: 24, height: 48 },
  trimOffset: { x: 0, y: 0 },
  paletteOffset,
  order: {
    layer: "world",
    elevation: 0,
    baselineY: 160,
    zOffset: 0,
    stableId: "officer",
  },
  transform: {
    position: { x: 80, y: 160 },
    pivot: { x: 12, y: 47 },
    scale: { x: 1, y: 1 },
    rotationRadians: 0,
  },
  opacity: 1,
  visible: true,
});

const frameFor = (paletteOffset: number): ResolvedFrame => ({
  frameVersion: 1,
  tick: 12,
  canvas: { width: 320, height: 200, clearColor: [0, 0, 0, 255] },
  camera: {
    position: { x: 0, y: 0 },
    viewport: { width: 320, height: 200 },
    shakeOffset: { x: 0, y: 0 },
  },
  nodes: [indexedNode(paletteOffset)],
});

describe("indexed Pixi renderer adapter", () => {
  it("preserves canonical geometry while expanding indexed nodes to nearest-neighbour sprites", () => {
    const registrations: Array<{ assetId: string; node: IndexedSpriteRenderNode }> = [];
    const expanded = expandIndexedPixiFrame(frameFor(0), (assetId, node) => {
      registrations.push({ assetId, node });
    });

    expect(registrations).toHaveLength(1);
    expect(registrations[0]?.node.kind).toBe("indexed-sprite");
    expect(expanded.nodes[0]).toEqual(
      expect.objectContaining({
        id: "render-node.test-indexed",
        kind: "sprite",
        sourceRect: { x: 0, y: 0, width: 24, height: 48 },
        originalSize: { width: 24, height: 48 },
        trimOffset: { x: 0, y: 0 },
        sampling: "nearest",
        opacity: 1,
        visible: true,
      }),
    );
    expect(expanded.nodes[0]?.transform).toEqual(frameFor(0).nodes[0]?.transform);
    expect(expanded.nodes[0]?.order).toEqual(frameFor(0).nodes[0]?.order);
  });

  it("uses stable synthetic texture identity for the same index/palette/offset tuple", () => {
    const ids: string[] = [];
    expandIndexedPixiFrame(frameFor(3), (assetId) => ids.push(assetId));
    expandIndexedPixiFrame(frameFor(3), (assetId) => ids.push(assetId));
    expect(ids[0]).toBe(ids[1]);
  });

  it("changes synthetic texture identity when palette offset changes", () => {
    const ids: string[] = [];
    expandIndexedPixiFrame(frameFor(0), (assetId) => ids.push(assetId));
    expandIndexedPixiFrame(frameFor(16), (assetId) => ids.push(assetId));
    expect(ids[0]).not.toBe(ids[1]);
  });
});
