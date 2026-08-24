import type { Point, Polygon } from "@evavo/adventure-project-schema";

const EPSILON = 1e-7;

const orientation = (a: Point, b: Point, c: Point): number =>
  (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);

const onSegment = (a: Point, b: Point, c: Point): boolean =>
  b.x <= Math.max(a.x, c.x) + EPSILON &&
  b.x + EPSILON >= Math.min(a.x, c.x) &&
  b.y <= Math.max(a.y, c.y) + EPSILON &&
  b.y + EPSILON >= Math.min(a.y, c.y);

const segmentsIntersect = (a1: Point, a2: Point, b1: Point, b2: Point): boolean => {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if ((o1 > EPSILON && o2 < -EPSILON || o1 < -EPSILON && o2 > EPSILON) &&
      (o3 > EPSILON && o4 < -EPSILON || o3 < -EPSILON && o4 > EPSILON)) {
    return true;
  }
  if (Math.abs(o1) <= EPSILON && onSegment(a1, b1, a2)) return true;
  if (Math.abs(o2) <= EPSILON && onSegment(a1, b2, a2)) return true;
  if (Math.abs(o3) <= EPSILON && onSegment(b1, a1, b2)) return true;
  if (Math.abs(o4) <= EPSILON && onSegment(b1, a2, b2)) return true;
  return false;
};

const samePoint = (left: Point, right: Point): boolean =>
  Math.abs(left.x - right.x) <= EPSILON && Math.abs(left.y - right.y) <= EPSILON;

export const polygonSignedArea = (polygon: Polygon): number => {
  let total = 0;
  for (let index = 0; index < polygon.points.length; index += 1) {
    const current = polygon.points[index];
    const next = polygon.points[(index + 1) % polygon.points.length];
    if (current && next) total += current.x * next.y - next.x * current.y;
  }
  return total / 2;
};

export const polygonSelfIntersections = (polygon: Polygon): readonly [number, number][] => {
  const intersections: [number, number][] = [];
  const count = polygon.points.length;
  for (let left = 0; left < count; left += 1) {
    const leftStart = polygon.points[left];
    const leftEnd = polygon.points[(left + 1) % count];
    if (!leftStart || !leftEnd) continue;
    for (let right = left + 1; right < count; right += 1) {
      if (right === left || right === (left + 1) % count || (right + 1) % count === left) continue;
      const rightStart = polygon.points[right];
      const rightEnd = polygon.points[(right + 1) % count];
      if (!rightStart || !rightEnd) continue;
      if (samePoint(leftStart, rightStart) || samePoint(leftStart, rightEnd) ||
          samePoint(leftEnd, rightStart) || samePoint(leftEnd, rightEnd)) continue;
      if (segmentsIntersect(leftStart, leftEnd, rightStart, rightEnd)) {
        intersections.push([left, right]);
      }
    }
  }
  return intersections;
};

export interface SceneDirectorPolygonQualityIssue {
  readonly code: "too-few-points" | "degenerate" | "self-intersection" | "duplicate-consecutive-point";
  readonly message: string;
}

export const evaluateSceneDirectorPolygonQuality = (
  polygon: Polygon,
): readonly SceneDirectorPolygonQualityIssue[] => {
  const issues: SceneDirectorPolygonQualityIssue[] = [];
  if (polygon.points.length < 3) {
    issues.push({ code: "too-few-points", message: "Polygon requires at least three points." });
    return issues;
  }
  for (let index = 0; index < polygon.points.length; index += 1) {
    const current = polygon.points[index];
    const next = polygon.points[(index + 1) % polygon.points.length];
    if (current && next && samePoint(current, next)) {
      issues.push({
        code: "duplicate-consecutive-point",
        message: `Polygon points ${index} and ${(index + 1) % polygon.points.length} occupy the same position.`,
      });
    }
  }
  if (Math.abs(polygonSignedArea(polygon)) <= EPSILON) {
    issues.push({ code: "degenerate", message: "Polygon has effectively zero signed area." });
  }
  const intersections = polygonSelfIntersections(polygon);
  if (intersections.length > 0) {
    issues.push({
      code: "self-intersection",
      message: `Polygon self-intersects between edge pairs ${intersections
        .map(([left, right]) => `${left}/${right}`)
        .join(", ")}.`,
    });
  }
  return issues;
};
