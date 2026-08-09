import type {
  DepthBand,
  Id,
  NavigationArea,
  Occluder,
  Point,
  Polygon,
  PresentationProfile,
} from "@evavo/adventure-project-schema";

const EPSILON = 1e-7;

const sortCopy = <T>(values: readonly T[], compare: (left: T, right: T) => number): T[] =>
  [...values].sort(compare);

const squaredDistance = (left: Point, right: Point): number => {
  const x = left.x - right.x;
  const y = left.y - right.y;
  return x * x + y * y;
};

export const pointOnSegment = (point: Point, start: Point, end: Point): boolean => {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > EPSILON) {
    return false;
  }

  const dot = (point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y);
  if (dot < -EPSILON) {
    return false;
  }

  return dot <= squaredDistance(start, end) + EPSILON;
};

export const pointInPolygon = (point: Point, polygon: Polygon): boolean => {
  const points = polygon.points;
  let inside = false;

  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const currentPoint = points[index];
    const previousPoint = points[previous];
    if (!currentPoint || !previousPoint) {
      continue;
    }

    if (pointOnSegment(point, previousPoint, currentPoint)) {
      return true;
    }

    const crosses =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x;

    if (crosses) {
      inside = !inside;
    }
  }

  return inside;
};

export const findNavigationAreasAtPoint = (
  point: Point,
  areas: readonly NavigationArea[],
): readonly NavigationArea[] =>
  sortCopy(
    areas.filter((area) => pointInPolygon(point, area.shape)),
    (left, right) => {
      if (left.elevation !== right.elevation) {
        return right.elevation - left.elevation;
      }
      return left.id.localeCompare(right.id);
    },
  );

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export interface ScaleSolution {
  readonly bandId: Id<"depth-band">;
  readonly scale: number;
  readonly zOffset: number;
}

const distanceToBand = (band: DepthBand, y: number): number => {
  const minimum = Math.min(band.farY, band.nearY);
  const maximum = Math.max(band.farY, band.nearY);
  if (y < minimum) {
    return minimum - y;
  }
  if (y > maximum) {
    return y - maximum;
  }
  return 0;
};

const bandSpan = (band: DepthBand): number => Math.abs(band.nearY - band.farY);

export const resolveScaleAtY = (bands: readonly DepthBand[], y: number): ScaleSolution | null => {
  const selected = sortCopy(bands, (left, right) => {
    const distanceDifference = distanceToBand(left, y) - distanceToBand(right, y);
    if (Math.abs(distanceDifference) > EPSILON) {
      return distanceDifference;
    }

    const spanDifference = bandSpan(left) - bandSpan(right);
    if (Math.abs(spanDifference) > EPSILON) {
      return spanDifference;
    }

    return left.id.localeCompare(right.id);
  })[0];

  if (!selected) {
    return null;
  }

  const denominator = selected.nearY - selected.farY;
  const progress = Math.abs(denominator) <= EPSILON ? 0 : clamp01((y - selected.farY) / denominator);
  const scale = selected.farScale + (selected.nearScale - selected.farScale) * progress;

  return {
    bandId: selected.id,
    scale,
    zOffset: selected.zOffset ?? 0,
  };
};

export interface DepthKey {
  readonly layer: number;
  readonly elevation: number;
  readonly baselineY: number;
  readonly zOffset: number;
  readonly stableId: string;
}

export const compareDepthKeys = (left: DepthKey, right: DepthKey): number => {
  if (left.layer !== right.layer) {
    return left.layer - right.layer;
  }
  if (left.elevation !== right.elevation) {
    return left.elevation - right.elevation;
  }
  if (Math.abs(left.baselineY - right.baselineY) > EPSILON) {
    return left.baselineY - right.baselineY;
  }
  if (Math.abs(left.zOffset - right.zOffset) > EPSILON) {
    return left.zOffset - right.zOffset;
  }
  return left.stableId.localeCompare(right.stableId);
};

export const sortByDepth = <T>(values: readonly T[], getDepthKey: (value: T) => DepthKey): readonly T[] =>
  sortCopy(values, (left, right) => compareDepthKeys(getDepthKey(left), getDepthKey(right)));

export const isActorBehindBaseline = (actorFootY: number, occluder: Pick<Occluder, "baselineY">): boolean =>
  actorFootY < occluder.baselineY - EPSILON;

export const occluderMaskContainsPoint = (
  pointInScene: Point,
  occluder: Pick<Occluder, "position" | "mask">,
): boolean => {
  if (!occluder.mask) {
    return true;
  }

  return pointInPolygon(
    {
      x: pointInScene.x - occluder.position.x,
      y: pointInScene.y - occluder.position.y,
    },
    occluder.mask,
  );
};

export type DisplaySubject = "camera" | "entity" | "ui" | "cursor";

export const quantizeNativePoint = (
  point: Point,
  policy: PresentationProfile["pixelMotionPolicy"],
  subject: DisplaySubject,
): Point => {
  const shouldQuantize =
    policy === "strict" ||
    (policy === "camera-strict" && (subject === "camera" || subject === "ui" || subject === "cursor"));

  return shouldQuantize ? { x: Math.round(point.x), y: Math.round(point.y) } : point;
};

export interface PresentationTransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly hostWidth: number;
  readonly hostHeight: number;
  readonly nativeWidth: number;
  readonly nativeHeight: number;
}

export const createIntegerPresentationTransform = (
  nativeWidth: number,
  nativeHeight: number,
  hostWidth: number,
  hostHeight: number,
): PresentationTransform => {
  if (nativeWidth <= 0 || nativeHeight <= 0 || hostWidth <= 0 || hostHeight <= 0) {
    throw new RangeError("Presentation dimensions must be positive.");
  }

  const scale = Math.max(1, Math.floor(Math.min(hostWidth / nativeWidth, hostHeight / nativeHeight)));
  const displayWidth = nativeWidth * scale;
  const displayHeight = nativeHeight * scale;

  return {
    scale,
    offsetX: Math.floor((hostWidth - displayWidth) / 2),
    offsetY: Math.floor((hostHeight - displayHeight) / 2),
    hostWidth,
    hostHeight,
    nativeWidth,
    nativeHeight,
  };
};

export const hostPointToNative = (point: Point, transform: PresentationTransform): Point | null => {
  const x = (point.x - transform.offsetX) / transform.scale;
  const y = (point.y - transform.offsetY) / transform.scale;

  if (x < 0 || y < 0 || x >= transform.nativeWidth || y >= transform.nativeHeight) {
    return null;
  }

  return { x: Math.floor(x), y: Math.floor(y) };
};
