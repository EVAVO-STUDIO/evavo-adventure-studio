import type {
  Point,
  Polygon,
  Size,
} from "@evavo/adventure-project-schema";
import type {
  AdventureScene,
  AdventureSceneReadabilityOverlay,
} from "./scene-readability-types.js";

const pointOnSegment = (point: Point, start: Point, end: Point): boolean => {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared <= 0.000001) {
    const pointDeltaX = point.x - start.x;
    const pointDeltaY = point.y - start.y;
    return pointDeltaX * pointDeltaX + pointDeltaY * pointDeltaY <= 0.000001;
  }
  const cross =
    (point.y - start.y) * deltaX - (point.x - start.x) * deltaY;
  if (Math.abs(cross) > 0.000001) return false;
  const dot = (point.x - start.x) * deltaX + (point.y - start.y) * deltaY;
  return dot >= 0 && dot <= lengthSquared;
};

export const pointInAdventurePolygon = (
  point: Point,
  polygon: Pick<Polygon, "points">,
): boolean => {
  let inside = false;
  const points = polygon.points;
  for (
    let index = 0, previous = points.length - 1;
    index < points.length;
    previous = index, index += 1
  ) {
    const currentPoint = points[index];
    const previousPoint = points[previous];
    if (!currentPoint || !previousPoint) continue;
    if (pointOnSegment(point, previousPoint, currentPoint)) return true;
    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
};

export const pointInsideSceneCanvas = (point: Point, size: Size): boolean =>
  point.x >= 0 && point.y >= 0 && point.x <= size.width && point.y <= size.height;

export const polygonInsideSceneCanvas = (
  polygon: Pick<Polygon, "points">,
  size: Size,
): boolean => polygon.points.every((point) => pointInsideSceneCanvas(point, size));

export const adventurePolygonArea = (
  polygon: Pick<Polygon, "points">,
): number => {
  let area = 0;
  for (
    let index = 0, previous = polygon.points.length - 1;
    index < polygon.points.length;
    previous = index, index += 1
  ) {
    const currentPoint = polygon.points[index];
    const previousPoint = polygon.points[previous];
    if (!currentPoint || !previousPoint) continue;
    area += previousPoint.x * currentPoint.y - currentPoint.x * previousPoint.y;
  }
  return Math.abs(area) / 2;
};

export const adventurePolygonCoveragePercent = (
  polygons: readonly Pick<Polygon, "points">[],
  size: Size,
): number => {
  if (polygons.length === 0) return 0;
  const step = Math.max(1, Math.floor(Math.min(size.width, size.height) / 50));
  let samples = 0;
  let covered = 0;
  for (let y = 0; y < size.height; y += step) {
    for (let x = 0; x < size.width; x += step) {
      samples += 1;
      const point = {
        x: Math.min(size.width - 0.000001, x + step / 2),
        y: Math.min(size.height - 0.000001, y + step / 2),
      };
      if (polygons.some((polygon) => pointInAdventurePolygon(point, polygon))) {
        covered += 1;
      }
    }
  }
  return samples === 0 ? 0 : Math.round((covered / samples) * 1000) / 10;
};

export const adventurePolygonVerticalSpanPercent = (
  polygons: readonly Pick<Polygon, "points">[],
  height: number,
): number => {
  const values = polygons.flatMap((polygon) =>
    polygon.points.map((point) => point.y),
  );
  if (values.length === 0 || height <= 0) return 0;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const percent = ((maximum - minimum) / height) * 100;
  return Math.round(Math.max(0, Math.min(100, percent)) * 10) / 10;
};

export const pointInsideSceneNavigation = (
  scene: AdventureScene,
  point: Point,
): boolean =>
  scene.navigationAreas.some((area) =>
    pointInAdventurePolygon(point, area.shape),
  );

export const hotspotChangesScene = (
  scene: AdventureScene,
  hotspotIndex: number,
): boolean => {
  const hotspot = scene.hotspots[hotspotIndex];
  return (
    hotspot?.interactions.some((interaction) =>
      interaction.actions.some((action) => action.kind === "change-scene"),
    ) ?? false
  );
};

export const createAdventureSceneOverlay = (
  scene: AdventureScene,
): AdventureSceneReadabilityOverlay => ({
  nativeSize: { width: scene.width, height: scene.height },
  navigationAreas: scene.navigationAreas.map((area) => ({
    id: area.id,
    elevation: area.elevation,
    points: area.shape.points.map((point) => ({ ...point })),
  })),
  depthBands: scene.depthBands.map((band) => ({
    id: band.id,
    farY: band.farY,
    nearY: band.nearY,
    farScale: band.farScale,
    nearScale: band.nearScale,
  })),
  entrances: scene.entrances.map((entrance) => ({
    id: entrance.id,
    position: { ...entrance.position },
    facing: entrance.facing,
  })),
  hotspots: scene.hotspots.map((hotspot, index) => ({
    id: hotspot.id,
    name: hotspot.name,
    points: hotspot.shape.points.map((point) => ({ ...point })),
    ...(hotspot.walkTo ? { walkTo: { ...hotspot.walkTo } } : {}),
    interactionCount: hotspot.interactions.length,
    changesScene: hotspotChangesScene(scene, index),
  })),
  occluders: scene.occluders.map((occluder) => ({
    id: occluder.id,
    position: { ...occluder.position },
    baselineY: occluder.baselineY,
    ...(occluder.mask
      ? { mask: occluder.mask.points.map((point) => ({ ...point })) }
      : {}),
  })),
});
