import { describe, expect, it } from "vitest";
import type { Id } from "@evavo/adventure-project-schema";
import {
  orderRenderNodes,
  validateResolvedFrame,
  type RenderNode,
  type ResolvedFrame,
} from "../src/index.js";

const id = <T extends string>(value: string) => value as Id<T>;

const createNode = (
  nodeId: string,
  layer: "world" | "occlusion",
  baselineY: number,
  maskNodeId?: string,
): RenderNode => ({
  kind: "solid-rectangle",
  id: id<"render-node">(nodeId),
  order: {
    layer,
    elevation: 0,
    baselineY,
    zOffset: 0,
    stableId: nodeId,
  },
  transform: {
    position: { x: 0, y: 0 },
    pivot: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotationRadians: 0,
  },
  opacity: 1,
  visible: true,
  ...(maskNodeId
    ? { maskNodeId: id<"render-node">(maskNodeId) }
    : {}),
  size: { width: 16, height: 16 },
  color: 0,
});

const createFrame = (nodes: readonly RenderNode[]): ResolvedFrame => ({
  frameVersion: 1,
  tick: 42,
  canvas: {
    width: 320,
    height: 200,
    clearColor: [0, 0, 0, 255],
  },
  camera: {
    position: { x: 0, y: 0 },
    viewport: { width: 320, height: 200 },
    shakeOffset: { x: 0, y: 0 },
  },
  nodes,
});

describe("resolved frame contract", () => {
  it("orders scene layers before depth within a layer", () => {
    const ordered = orderRenderNodes([
      createNode("occluder", "occlusion", 100),
      createNode("near-actor", "world", 180),
      createNode("far-actor", "world", 120),
    ]);

    expect(ordered.map((node) => node.id)).toEqual([
      "far-actor",
      "near-actor",
      "occluder",
    ]);
  });

  it("reports duplicate IDs and unknown masks", () => {
    const issues = validateResolvedFrame(
      createFrame([
        createNode("actor", "world", 160, "missing-mask"),
        createNode("actor", "world", 170),
      ]),
    );

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["duplicate-node-id", "unknown-mask"]),
    );
  });

  it("rejects mask cycles before rendering", () => {
    const issues = validateResolvedFrame(
      createFrame([
        createNode("mask-a", "occlusion", 100, "mask-b"),
        createNode("mask-b", "occlusion", 101, "mask-a"),
      ]),
    );

    expect(issues.filter((issue) => issue.code === "mask-cycle")).toHaveLength(2);
  });
});
