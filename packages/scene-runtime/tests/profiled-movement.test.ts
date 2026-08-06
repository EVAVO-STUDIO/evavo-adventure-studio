import { describe, expect, it } from "vitest";
import type { Id } from "@evavo/adventure-project-schema";
import type { NavigationRoute } from "@evavo/adventure-scene/navigation";
import {
  advanceProfiledNavigationMovement,
  beginProfiledNavigationMovement,
  canonicalProfiledNavigationMovementJson,
  parseProfiledNavigationMovementJson,
  validateProfiledNavigationMovementCompatibility,
} from "../src/profiled-movement.js";

const actorInstanceId = "actor-instance.hero" as Id<"actor-instance">;
const areaId = "navigation-area.stage" as Id<"navigation-area">;

const route = (portalDistance?: number): NavigationRoute => ({
  points: [
    { x: 10, y: 140 },
    { x: 120, y: 140 },
    { x: 160, y: 100 },
    { x: 260, y: 100 },
  ],
  segments: [
    {
      from: { x: 10, y: 140 },
      to: { x: 120, y: 140 },
      kind: "walk",
      areaId,
      portalId: null,
      distance: 110,
    },
    {
      from: { x: 120, y: 140 },
      to: { x: 160, y: 100 },
      kind: portalDistance === undefined ? "walk" : "portal",
      areaId,
      portalId:
        portalDistance === undefined
          ? null
          : ("navigation-portal.stairs" as Id<"navigation-portal">),
      distance: portalDistance ?? Math.hypot(40, 40),
    },
    {
      from: { x: 160, y: 100 },
      to: { x: 260, y: 100 },
      kind: "walk",
      areaId,
      portalId: null,
      distance: 100,
    },
  ],
  distance: 210 + Math.hypot(40, 40),
  startAreaId: areaId,
  endAreaId: areaId,
  snappedStart: false,
  snappedEnd: false,
});

const begin = () =>
  beginProfiledNavigationMovement({
    actorInstanceId,
    route: route(),
    profileId: "storybook-deliberate",
    logicalTicksPerSecond: 60,
  });

describe("profiled navigation movement", () => {
  it("begins deterministic movement with an exact route fingerprint", () => {
    const result = begin();
    expect(result.kind).toBe("profiled");
    if (result.kind !== "profiled") return;
    expect(result.state).toEqual(
      expect.objectContaining({
        actorInstanceId,
        profileId: "storybook-deliberate",
        routePointCount: 4,
        completedSegmentCount: 0,
      }),
    );
    expect(result.state.routeFingerprint).toMatch(/^fnv1a64:[0-9a-f]{16}$/u);
  });

  it("preserves state and exact event evidence across chunked advancement", () => {
    const result = begin();
    if (result.kind !== "profiled") throw new Error("Expected profiled movement.");
    const chunked = advanceProfiledNavigationMovement(result.state, route(), 60, {
      ticks: 180,
    });
    let stepped = result.state;
    const events = [];
    let distanceAdvancedPixels = 0;
    for (let tick = 0; tick < 180; tick += 1) {
      const advanced = advanceProfiledNavigationMovement(stepped, route(), 60);
      stepped = advanced.state;
      events.push(...advanced.events);
      distanceAdvancedPixels += advanced.distanceAdvancedPixels;
    }
    expect(chunked.state).toEqual(stepped);
    expect(chunked.events).toEqual(events);
    expect(chunked.distanceAdvancedPixels).toBeCloseTo(
      distanceAdvancedPixels,
      12,
    );
  });

  it("arrives exactly and emits phase, footfall, segment and completion evidence", () => {
    const result = begin();
    if (result.kind !== "profiled") throw new Error("Expected profiled movement.");
    let state = result.state;
    const events = [];
    for (let tick = 0; tick < 2_000 && state.lastPhase !== "arrived"; tick += 1) {
      const advanced = advanceProfiledNavigationMovement(state, route(), 60);
      state = advanced.state;
      events.push(...advanced.events);
    }
    expect(state.extension.motion.position).toEqual({ x: 260, y: 100 });
    expect(state.extension.motion.velocityMicropixelsPerSecond).toBe(0);
    expect(state.completedSegmentCount).toBe(3);
    expect(events.some((event) => event.kind === "movement-footfall")).toBe(true);
    expect(events.filter((event) => event.kind === "movement-segment-completed")).toHaveLength(3);
    expect(events.at(-1)?.kind).toBe("movement-completed");
  });

  it("round-trips strict canonical save data", () => {
    const result = begin();
    if (result.kind !== "profiled") throw new Error("Expected profiled movement.");
    const advanced = advanceProfiledNavigationMovement(result.state, route(), 60, {
      ticks: 90,
    });
    const json = canonicalProfiledNavigationMovementJson(advanced.state);
    expect(parseProfiledNavigationMovementJson(json)).toEqual(advanced.state);
    expect(() =>
      parseProfiledNavigationMovementJson(
        json.replace('"stateVersion":1', '"stateVersion":2'),
      ),
    ).toThrow(/version 1/u);
  });

  it("rejects route drift rather than applying saved fixed-unit motion to new geometry", () => {
    const result = begin();
    if (result.kind !== "profiled") throw new Error("Expected profiled movement.");
    const changed = route();
    const drifted: NavigationRoute = {
      ...changed,
      points: [...changed.points.slice(0, -1), { x: 262, y: 100 }],
      segments: [
        ...changed.segments.slice(0, -1),
        {
          ...changed.segments.at(-1)!,
          to: { x: 262, y: 100 },
          distance: 102,
        },
      ],
    };
    expect(
      validateProfiledNavigationMovementCompatibility({
        state: result.state,
        route: drifted,
        logicalTicksPerSecond: 60,
      }).map((issue) => issue.code),
    ).toContain("route-fingerprint-mismatch");
  });

  it("rejects internally inconsistent saved motion evidence", () => {
    const result = begin();
    if (result.kind !== "profiled") throw new Error("Expected profiled movement.");
    const advanced = advanceProfiledNavigationMovement(result.state, route(), 60, {
      ticks: 45,
    });
    const corrupted = JSON.parse(
      canonicalProfiledNavigationMovementJson(advanced.state),
    ) as typeof advanced.state;
    const currentPhase = corrupted.extension.motion.phase;
    const alternatePhase: typeof currentPhase =
      currentPhase === "moving" ? "starting" : "moving";
    const state: typeof advanced.state = {
      ...corrupted,
      lastPhase: alternatePhase,
      completedSegmentCount: corrupted.completedSegmentCount + 1,
      extension: {
        ...corrupted.extension,
        motion: {
          ...corrupted.extension.motion,
          distanceRemainder: 60,
          position: {
            ...corrupted.extension.motion.position,
            x: corrupted.extension.motion.position.x + 2,
          },
          walkCyclePhase:
            (corrupted.extension.motion.walkCyclePhase + 0.25) % 1,
        },
      },
    };
    expect(
      validateProfiledNavigationMovementCompatibility({
        state,
        route: route(),
        logicalTicksPerSecond: 60,
      }).map((issue) => issue.code),
    ).toEqual(
      expect.arrayContaining([
        "invalid-motion-distance",
        "invalid-motion-display-position",
        "invalid-motion-phase",
        "invalid-walk-cycle-phase",
        "invalid-completed-segment-count",
      ]),
    );
  });

  it("falls back explicitly for non-geometric portals", () => {
    const result = beginProfiledNavigationMovement({
      actorInstanceId,
      route: route(240),
      profileId: "cinematic-directed",
      logicalTicksPerSecond: 60,
    });
    expect(result).toEqual({
      kind: "legacy-fallback",
      profileId: "cinematic-directed",
      reason: "non-geometric-portal",
      speedPixelsPerSecond: 45,
    });
  });

  it("rejects a profile whose logical rate differs from the runtime", () => {
    const result = beginProfiledNavigationMovement({
      actorInstanceId,
      route: route(),
      profileId: "pulp-grounded",
      logicalTicksPerSecond: 50,
    });
    expect(result).toEqual(
      expect.objectContaining({
        kind: "rejected",
        reason: "logical-tick-rate-mismatch",
      }),
    );
  });
});
