import type { Id, Point, Polygon } from "@evavo/adventure-project-schema";
import type { SceneDirectorDocuments } from "./scene-director-documents.js";
import { directorPointInPolygon } from "./scene-director-object-geometry.js";

export type SceneDirectorClearanceKind = "approach" | "entrance" | "actor-start";

export interface SceneDirectorClearanceIssue {
  readonly kind: SceneDirectorClearanceKind;
  readonly sceneId: Id<"scene">;
  readonly targetId: string;
  readonly point: Point;
  readonly requiredClearance: number;
  readonly availableClearance: number;
  readonly message: string;
}

const distancePointToSegment = (point: Point, start: Point, end: Point): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const progress = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  return Math.hypot(
    point.x - (start.x + dx * progress),
    point.y - (start.y + dy * progress),
  );
};

export const distanceToPolygonBoundary = (point: Point, polygon: Polygon): number => {
  if (!directorPointInPolygon(point, polygon)) return 0;
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.points.length; index += 1) {
    const start = polygon.points[index];
    const end = polygon.points[(index + 1) % polygon.points.length];
    if (!start || !end) continue;
    nearest = Math.min(nearest, distancePointToSegment(point, start, end));
  }
  return Number.isFinite(nearest) ? nearest : 0;
};

const availableClearance = (
  point: Point,
  polygons: readonly Polygon[],
): number => {
  const containing = polygons.filter((polygon) => directorPointInPolygon(point, polygon));
  if (containing.length === 0) return 0;
  return Math.max(...containing.map((polygon) => distanceToPolygonBoundary(point, polygon)));
};

const requiredClearanceForActor = (
  documents: SceneDirectorDocuments,
  sceneId: Id<"scene">,
  actorId: Id<"actor">,
): number => {
  const staging = documents.staging.scenes.find((candidate) => candidate.sceneId === sceneId);
  const footprint = staging?.actorFootprints[actorId];
  if (!footprint) return 0;
  return footprint.width / 2 + footprint.clearance;
};

const primaryWalkableActor = (
  documents: SceneDirectorDocuments,
  sceneId: Id<"scene">,
) => {
  const composition = documents.sceneInstances.scenes.find((candidate) => candidate.sceneId === sceneId);
  return composition?.actorInstances
    .filter((instance) => instance.mobility === "walkable")
    .sort((left, right) => left.id.localeCompare(right.id))[0] ?? null;
};

const addIssue = (
  issues: SceneDirectorClearanceIssue[],
  kind: SceneDirectorClearanceKind,
  sceneId: Id<"scene">,
  targetId: string,
  point: Point,
  required: number,
  available: number,
): void => {
  if (required <= 0 || available + 0.001 >= required) return;
  issues.push({
    kind,
    sceneId,
    targetId,
    point,
    requiredClearance: required,
    availableClearance: available,
    message:
      `${kind} '${targetId}' has ${available.toFixed(1)}px boundary clearance; ` +
      `${required.toFixed(1)}px is required by the authored actor footprint.`,
  });
};

export const auditSceneDirectorClearance = (
  documents: SceneDirectorDocuments,
  sceneId?: Id<"scene">,
): readonly SceneDirectorClearanceIssue[] => {
  const issues: SceneDirectorClearanceIssue[] = [];
  const scenes = sceneId
    ? documents.project.scenes.filter((scene) => scene.id === sceneId)
    : documents.project.scenes;

  for (const scene of scenes) {
    const composition = documents.sceneInstances.scenes.find(
      (candidate) => candidate.sceneId === scene.id,
    );
    const staging = documents.staging.scenes.find((candidate) => candidate.sceneId === scene.id);
    const polygons = scene.navigationAreas.map((area) => area.shape);

    for (const actor of composition?.actorInstances ?? []) {
      if (actor.mobility !== "walkable") continue;
      addIssue(
        issues,
        "actor-start",
        scene.id,
        actor.id,
        actor.position,
        requiredClearanceForActor(documents, scene.id, actor.actorId),
        availableClearance(actor.position, polygons),
      );
    }

    const playerActor = primaryWalkableActor(documents, scene.id);
    if (!playerActor) continue;
    const required = requiredClearanceForActor(documents, scene.id, playerActor.actorId);

    for (const [objectId, slots] of Object.entries(staging?.approachSlotsByObject ?? {})) {
      for (const slot of slots) {
        addIssue(
          issues,
          "approach",
          scene.id,
          `${objectId}:${slot.id}`,
          slot.position,
          required,
          availableClearance(slot.position, polygons),
        );
      }
    }

    for (const entrance of scene.entrances) {
      addIssue(
        issues,
        "entrance",
        scene.id,
        entrance.id,
        entrance.position,
        required,
        availableClearance(entrance.position, polygons),
      );
    }
  }

  return issues.sort(
    (left, right) =>
      left.sceneId.localeCompare(right.sceneId) ||
      left.kind.localeCompare(right.kind) ||
      left.targetId.localeCompare(right.targetId),
  );
};
