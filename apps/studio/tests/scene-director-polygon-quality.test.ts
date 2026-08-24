import { describe, expect, it } from "vitest";
import {
  evaluateSceneDirectorPolygonQuality,
  polygonSelfIntersections,
  polygonSignedArea,
} from "../src/scene-director-polygon-quality.js";

const rectangle = {
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ],
};

describe("Scene Director polygon quality", () => {
  it("accepts a simple authored rectangle", () => {
    expect(polygonSignedArea(rectangle)).toBe(100);
    expect(polygonSelfIntersections(rectangle)).toEqual([]);
    expect(evaluateSceneDirectorPolygonQuality(rectangle)).toEqual([]);
  });

  it("rejects a bow-tie polygon that self-intersects", () => {
    const bowTie = {
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ],
    };
    expect(polygonSelfIntersections(bowTie)).toEqual([[0, 2]]);
    expect(evaluateSceneDirectorPolygonQuality(bowTie)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "self-intersection" })]),
    );
  });

  it("rejects duplicate consecutive vertices", () => {
    expect(
      evaluateSceneDirectorPolygonQuality({
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 10 },
        ],
      }),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "duplicate-consecutive-point" })]),
    );
  });
});
