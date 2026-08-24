import type { Id, Point, Polygon } from "@evavo/adventure-project-schema";
import type {
  ObjectDefinition,
  ObjectStateDefinition,
  SceneObjectInstance,
} from "@evavo/adventure-scene-instances";
import { sampleDepthScale } from "@evavo/adventure-scene-instances/staging";
import type { SceneDirectorDocuments } from "./scene-director-documents.js";

const EPSILON = 1e-7;

const squaredDistance = (left: Point, right: Point): number => {
  const x = left.x - right.x;
  const y = left.y - right.y;
  return x * x + y * y;
};

const pointOnSegment = (point: Point, start: Point, end: Point): boolean => {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > EPSILON) return false;
  const dot = (point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y);
  return dot >= -EPSILON && dot <= squaredDistance(start, end) + EPSILON;
};

export const directorPointInPolygon = (point: Point, polygon: Polygon): boolean => {
  let inside = false;
  const source = polygon.points;
  for (let index = 0, previous = source.length - 1; index < source.length; previous = index++) {
    const current = source[index];
    const prior = source[previous];
    if (!current || !prior) continue;
    if (pointOnSegment(point, prior, current)) return true;
    const crosses =
      current.y > point.y !== prior.y > point.y &&
      point.x <
        ((prior.x - current.x) * (point.y - current.y)) /
          (prior.y - current.y) +
          current.x;
    if (crosses) inside = !inside;
  }
  return inside;
};

const bandDistance = (
  band: SceneDirectorDocuments["project"]["scenes"][number]["depthBands"][number],
  y: number,
): number => {
  const minimum = Math.min(band.farY, band.nearY);
  const maximum = Math.max(band.farY, band.nearY);
  if (y < minimum) return minimum - y;
  if (y > maximum) return y - maximum;
  return 0;
};

export const directorBaseDepthScale = (
  bands: SceneDirectorDocuments["project"]["scenes"][number]["depthBands"],
  y: number,
): number => {
  const selected = [...bands].sort((left, right) => {
    const distance = bandDistance(left, y) - bandDistance(right, y);
    if (Math.abs(distance) > EPSILON) return distance;
    const span = Math.abs(left.nearY - left.farY) - Math.abs(right.nearY - right.farY);
    if (Math.abs(span) > EPSILON) return span;
    return left.id.localeCompare(right.id);
  })[0];
  if (!selected) return 1;
  const denominator = selected.nearY - selected.farY;
  const progress = denominator === 0
    ? 1
    : Math.min(1, Math.max(0, (y - selected.farY) / denominator));
  return selected.farScale + (selected.nearScale - selected.farScale) * progress;
};

export const directorObjectScale = (
  documents: SceneDirectorDocuments,
  sceneId: Id<"scene">,
  instance: SceneObjectInstance,
): number => {
  const scene = documents.project.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) return instance.scaleMultiplier;
  let scale = directorBaseDepthScale(scene.depthBands, instance.position.y);
  const staging = documents.staging.scenes.find((candidate) => candidate.sceneId === sceneId);
  const area = scene.navigationAreas
    .filter((candidate) => directorPointInPolygon(instance.position, candidate.shape))
    .sort((left, right) => right.elevation - left.elevation || left.id.localeCompare(right.id))[0];
  const override = area
    ? staging?.navigationScaleOverrides.find((candidate) => candidate.areaId === area.id)
    : undefined;
  if (override?.mode === "fixed" && override.fixedScale !== undefined) scale = override.fixedScale;
  if (override?.mode === "curve") {
    const curve = staging?.depthScaleCurves.find((candidate) => candidate.id === override.curveId);
    if (curve) scale = sampleDepthScale(curve, instance.position.y);
  }
  return scale * instance.scaleMultiplier;
};

export const directorActiveObjectState = (
  definition: ObjectDefinition,
  instance: SceneObjectInstance,
): ObjectStateDefinition | null => {
  const stateId = instance.initialStateId ?? definition.initialStateId;
  return definition.states.find((candidate) => candidate.id === stateId) ?? null;
};

export const directorTransformLocalPoint = (
  point: Point,
  anchor: Point,
  pivot: Point,
  scale: number,
  mirrored: boolean,
): Point => ({
  x: anchor.x + (point.x - pivot.x) * scale * (mirrored ? -1 : 1),
  y: anchor.y + (point.y - pivot.y) * scale,
});

export const directorInverseTransformPoint = (
  point: Point,
  anchor: Point,
  pivot: Point,
  scale: number,
  mirrored: boolean,
): Point => ({
  x: pivot.x + ((point.x - anchor.x) / scale) * (mirrored ? -1 : 1),
  y: pivot.y + (point.y - anchor.y) / scale,
});
