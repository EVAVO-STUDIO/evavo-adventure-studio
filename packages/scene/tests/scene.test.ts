import type { DepthBand, Id, Polygon } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import {
  createIntegerPresentationTransform,
  hostPointToNative,
  pointInPolygon,
  quantizeNativePoint,
  resolveScaleAtY,
  sortByDepth,
} from "../src/index.js";

const id = <T extends string>(value: string) => value as Id<T>;

const floor: Polygon = {
  points: [
    { x: 20, y: 120 },
    { x: 300, y: 120 },
    { x: 300, y: 190 },
    { x: 20, y: 190 },
  ],
};

describe("scene solver", () => {
  it("treats polygon edges as navigable", () => {
    expect(pointInPolygon({ x: 20, y: 150 }, floor)).toBe(true);
    expect(pointInPolygon({ x: 160, y: 150 }, floor)).toBe(true);
    expect(pointInPolygon({ x: 10, y: 150 }, floor)).toBe(false);
  });

  it("interpolates authored perspective scale", () => {
    const bands: readonly DepthBand[] = [
      {
        id: id<"depth-band">("depth.office"),
        farY: 130,
        nearY: 190,
        farScale: 0.72,
        nearScale: 1,
      },
    ];

    expect(resolveScaleAtY(bands, 160)?.scale).toBeCloseTo(0.86);
    expect(resolveScaleAtY(bands, 80)?.scale).toBeCloseTo(0.72);
    expect(resolveScaleAtY(bands, 220)?.scale).toBeCloseTo(1);
  });

  it("uses stable IDs to break equal-depth ties", () => {
    const sorted = sortByDepth(
      [
        { id: "actor.zed", y: 160 },
        { id: "actor.ada", y: 160 },
        { id: "actor.near", y: 180 },
      ],
      (actor) => ({
        layer: 0,
        elevation: 0,
        baselineY: actor.y,
        zOffset: 0,
        stableId: actor.id,
      }),
    );

    expect(sorted.map((actor) => actor.id)).toEqual(["actor.ada", "actor.zed", "actor.near"]);
  });

  it("maps letterboxed host input back to native pixels", () => {
    const transform = createIntegerPresentationTransform(320, 200, 1280, 720);

    expect(transform).toMatchObject({ scale: 3, offsetX: 160, offsetY: 60 });
    expect(hostPointToNative({ x: 163, y: 63 }, transform)).toEqual({ x: 1, y: 1 });
    expect(hostPointToNative({ x: 20, y: 20 }, transform)).toBeNull();
  });

  it("quantizes only the subjects required by the pixel policy", () => {
    const point = { x: 42.4, y: 91.6 };

    expect(quantizeNativePoint(point, "strict", "entity")).toEqual({ x: 42, y: 92 });
    expect(quantizeNativePoint(point, "camera-strict", "camera")).toEqual({
      x: 42,
      y: 92,
    });
    expect(quantizeNativePoint(point, "camera-strict", "entity")).toBe(point);
  });
});
