import { describe, expect, it } from "vitest";
import {
  nightShiftDirectorInstances,
  nightShiftDirectorProject,
  nightShiftDirectorStaging,
} from "../src/night-shift-director-fixture.js";
import {
  directorBaseDepthScale,
  directorInverseTransformPoint,
  directorObjectScale,
  directorPointInPolygon,
  directorTransformLocalPoint,
} from "../src/scene-director-object-geometry.js";

const documents = {
  project: nightShiftDirectorProject,
  sceneInstances: nightShiftDirectorInstances,
  staging: nightShiftDirectorStaging,
};

describe("Scene Director object geometry", () => {
  it("treats polygon boundaries as inside like the runtime", () => {
    const polygon = {
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
    };
    expect(directorPointInPolygon({ x: 5, y: 0 }, polygon)).toBe(true);
    expect(directorPointInPolygon({ x: 5, y: 5 }, polygon)).toBe(true);
    expect(directorPointInPolygon({ x: 11, y: 5 }, polygon)).toBe(false);
  });

  it("round-trips pivoted and mirrored local interaction points", () => {
    const local = { x: 2.5, y: 7.25 };
    const scene = directorTransformLocalPoint(
      local,
      { x: 120, y: 150 },
      { x: 8, y: 10 },
      0.75,
      true,
    );
    expect(directorInverseTransformPoint(scene, { x: 120, y: 150 }, { x: 8, y: 10 }, 0.75, true))
      .toEqual(local);
  });

  it("uses the same nearest/smallest depth-band selection rule as runtime", () => {
    const scale = directorBaseDepthScale(
      [
        { id: "depth-band.large" as never, farY: 100, nearY: 180, farScale: 0.5, nearScale: 1, zOffset: 0 },
        { id: "depth-band.small" as never, farY: 120, nearY: 160, farScale: 0.7, nearScale: 0.9, zOffset: 0 },
      ],
      140,
    );
    expect(scale).toBeCloseTo(0.8);
  });

  it("uses the staged navigation-area perspective override for Night Shift objects", () => {
    const radio = nightShiftDirectorInstances.scenes[0]?.objectInstances.find(
      (object) => object.id === "object.night-shift.radio",
    );
    expect(radio).toBeDefined();
    expect(
      directorObjectScale(documents, "scene.night-shift.station" as never, radio!),
    ).toBeGreaterThan(0.7);
    expect(
      directorObjectScale(documents, "scene.night-shift.station" as never, radio!),
    ).toBeLessThan(1);
  });
});
