import { describe, expect, it } from "vitest";
import type {
  Id,
  NavigationArea,
  Point,
  Polygon,
} from "@evavo/adventure-project-schema";
import {
  findNavigationRoute,
  segmentInsidePolygon,
  type NavigationPortal,
} from "../src/navigation-solver.js";

const id = <T extends string>(value: string) => value as Id<T>;

const area = (
  areaId: string,
  points: readonly Point[],
): NavigationArea => ({
  id: id<"navigation-area">(areaId),
  shape: { points },
  elevation: 0,
});

const concave: Polygon = {
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 40 },
    { x: 40, y: 40 },
    { x: 40, y: 100 },
    { x: 0, y: 100 },
  ],
};

describe("deterministic navigation routes", () => {
  it("routes around the reflex corner of a concave walk polygon", () => {
    const start = { x: 80, y: 20 };
    const end = { x: 20, y: 80 };
    expect(segmentInsidePolygon(start, end, concave)).toBe(false);

    const result = findNavigationRoute(start, end, [
      area("navigation.concave", concave.points),
    ]);
    expect(result.kind).toBe("route");
    if (result.kind !== "route") {
      throw new Error("Expected a route through the concave room.");
    }

    expect(result.route.points).toEqual([
      start,
      { x: 40, y: 40 },
      end,
    ]);
    expect(
      result.route.segments.every((segment) =>
        segmentInsidePolygon(segment.from, segment.to, concave),
      ),
    ).toBe(true);
  });

  it("snaps an outside click to the nearest reachable boundary", () => {
    const result = findNavigationRoute(
      { x: 10, y: 25 },
      { x: 70, y: 25 },
      [
        area("navigation.room", [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 50, y: 50 },
          { x: 0, y: 50 },
        ]),
      ],
    );

    expect(result.kind).toBe("route");
    if (result.kind === "route") {
      expect(result.route.snappedEnd).toBe(true);
      expect(result.route.points.at(-1)).toEqual({ x: 50, y: 25 });
    }
  });

  it("crosses separate navigation surfaces only through authored portals", () => {
    const left = area("navigation.left", [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 0, y: 50 },
    ]);
    const right = area("navigation.right", [
      { x: 100, y: 0 },
      { x: 150, y: 0 },
      { x: 150, y: 50 },
      { x: 100, y: 50 },
    ]);
    const portal: NavigationPortal = {
      id: id<"navigation-portal">("portal.bridge"),
      fromAreaId: left.id,
      toAreaId: right.id,
      fromPoint: { x: 50, y: 25 },
      toPoint: { x: 100, y: 25 },
      bidirectional: true,
    };

    const disconnected = findNavigationRoute(
      { x: 10, y: 25 },
      { x: 140, y: 25 },
      [left, right],
      [],
    );
    expect(disconnected).toEqual({
      kind: "unreachable",
      reason: "no-connected-route",
    });

    const connected = findNavigationRoute(
      { x: 10, y: 25 },
      { x: 140, y: 25 },
      [left, right],
      [portal],
    );
    expect(connected.kind).toBe("route");
    if (connected.kind === "route") {
      expect(connected.route.points).toEqual([
        { x: 10, y: 25 },
        { x: 50, y: 25 },
        { x: 100, y: 25 },
        { x: 140, y: 25 },
      ]);
      expect(
        connected.route.segments
          .filter((segment) => segment.kind === "portal")
          .map((segment) => segment.portalId),
      ).toEqual(["portal.bridge"]);
    }
  });

  it("chooses the lexically stable portal when equal routes exist", () => {
    const left = area("navigation.left", [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 0, y: 50 },
    ]);
    const right = area("navigation.right", [
      { x: 100, y: 0 },
      { x: 150, y: 0 },
      { x: 150, y: 50 },
      { x: 100, y: 50 },
    ]);
    const portals: readonly NavigationPortal[] = ["portal.b", "portal.a"].map(
      (portalId) => ({
        id: id<"navigation-portal">(portalId),
        fromAreaId: left.id,
        toAreaId: right.id,
        fromPoint: { x: 50, y: 25 },
        toPoint: { x: 100, y: 25 },
        bidirectional: true,
      }),
    );
    const result = findNavigationRoute(
      { x: 10, y: 25 },
      { x: 140, y: 25 },
      [left, right],
      portals,
    );

    expect(result.kind).toBe("route");
    if (result.kind === "route") {
      expect(
        result.route.segments.find((segment) => segment.kind === "portal")
          ?.portalId,
      ).toBe("portal.a");
    }
  });

  it("returns a stable zero-length route without dropping its point", () => {
    const point = { x: 20, y: 20 };
    const result = findNavigationRoute(point, point, [
      area("navigation.room", [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
        { x: 0, y: 50 },
      ]),
    ]);

    expect(result).toMatchObject({
      kind: "route",
      route: {
        points: [point],
        segments: [],
        distance: 0,
      },
    });
  });
});
