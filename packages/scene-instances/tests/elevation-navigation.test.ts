import type { NavigationArea } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import type { SceneNavigationPortal } from "../src/index.js";
import {
  auditNavigationPortalElevations,
  navigationPortalElevationTransition,
} from "../src/elevation-navigation.js";

const areas: readonly NavigationArea[] = [
  {
    id: "navigation.floor" as never,
    elevation: 0,
    shape: { points: [{ x: 0, y: 100 }, { x: 160, y: 100 }, { x: 160, y: 200 }, { x: 0, y: 200 }] },
  },
  {
    id: "navigation.landing" as never,
    elevation: 2,
    shape: { points: [{ x: 160, y: 60 }, { x: 320, y: 60 }, { x: 320, y: 140 }, { x: 160, y: 140 }] },
  },
];

const portal = (animation?: string): SceneNavigationPortal => ({
  id: "navigation-portal.stairs" as never,
  fromAreaId: "navigation.floor" as never,
  toAreaId: "navigation.landing" as never,
  fromPoint: { x: 155, y: 110 },
  toPoint: { x: 165, y: 130 },
  bidirectional: true,
  traversalCost: 8,
  ...(animation ? { traversalAnimationState: animation } : {}),
});

describe("navigation portal elevation audit", () => {
  it("classifies ascent and preserves authored traversal animation", () => {
    expect(navigationPortalElevationTransition(areas, portal("stairs"))).toEqual({
      portalId: "navigation-portal.stairs",
      fromAreaId: "navigation.floor",
      toAreaId: "navigation.landing",
      fromElevation: 0,
      toElevation: 2,
      delta: 2,
      kind: "ascent",
      traversalAnimationState: "stairs",
    });
    expect(auditNavigationPortalElevations(areas, [portal("stairs")])).toEqual([]);
  });

  it("warns when a non-flat portal has no traversal animation", () => {
    expect(auditNavigationPortalElevations(areas, [portal()])).toEqual([
      expect.objectContaining({ code: "non-flat-transition-without-animation", severity: "warning" }),
    ]);
  });

  it("rejects portal endpoints outside their referenced navigation areas", () => {
    const malformed = {
      ...portal("stairs"),
      fromPoint: { x: 250, y: 110 },
      toPoint: { x: 20, y: 130 },
    };
    expect(auditNavigationPortalElevations(areas, [malformed])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "from-point-outside-area", severity: "error" }),
        expect.objectContaining({ code: "to-point-outside-area", severity: "error" }),
      ]),
    );
  });
});
