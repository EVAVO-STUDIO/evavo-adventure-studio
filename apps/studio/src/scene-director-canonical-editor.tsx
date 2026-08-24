import type { Id, Point, Polygon } from "@evavo/adventure-project-schema";
import type {
  ObjectDefinition,
  ObjectStateDefinition,
  SceneObjectInstance,
} from "@evavo/adventure-scene-instances";
import { sampleDepthScale } from "@evavo/adventure-scene-instances/staging";
import { type PointerEvent as ReactPointerEvent, useState } from "react";
import type {
  SceneDirectorDocumentCommand,
  SceneDirectorDocuments,
} from "./scene-director-documents.js";
import type { SceneDirectorEditingController } from "./scene-director-components.js";
import { StagingButton } from "./scene-staging-components.js";
import "./scene-director-canonical-editor.css";

export type CanonicalGeometryMode = "walk" | "control" | "hotspots" | "objects";

const points = (value: readonly Point[]): string =>
  value.map((point) => `${point.x},${point.y}`).join(" ");

const polygonContains = (point: Point, polygon: Polygon): boolean => {
  const source = polygon.points;
  let inside = false;
  for (let index = 0, previous = source.length - 1; index < source.length; previous = index++) {
    const current = source[index];
    const prior = source[previous];
    if (!current || !prior) continue;
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

const baseDepthScale = (
  bands: SceneDirectorDocuments["project"]["scenes"][number]["depthBands"],
  y: number,
): number => {
  if (bands.length === 0) return 1;
  const selected = [...bands].sort((left, right) => {
    const leftMin = Math.min(left.farY, left.nearY);
    const leftMax = Math.max(left.farY, left.nearY);
    const rightMin = Math.min(right.farY, right.nearY);
    const rightMax = Math.max(right.farY, right.nearY);
    const leftDistance = y < leftMin ? leftMin - y : y > leftMax ? y - leftMax : 0;
    const rightDistance = y < rightMin ? rightMin - y : y > rightMax ? y - rightMax : 0;
    return leftDistance - rightDistance || left.id.localeCompare(right.id);
  })[0];
  if (!selected) return 1;
  const span = selected.nearY - selected.farY;
  if (span === 0) return selected.nearScale;
  const progress = Math.max(0, Math.min(1, (y - selected.farY) / span));
  return selected.farScale + (selected.nearScale - selected.farScale) * progress;
};

const objectScale = (
  documents: SceneDirectorDocuments,
  sceneId: Id<"scene">,
  instance: SceneObjectInstance,
): number => {
  const scene = documents.project.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) return instance.scaleMultiplier;
  let scale = baseDepthScale(scene.depthBands, instance.position.y);
  const staging = documents.staging.scenes.find((candidate) => candidate.sceneId === sceneId);
  const area = scene.navigationAreas
    .filter((candidate) => polygonContains(instance.position, candidate.shape))
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

const activeState = (
  definition: ObjectDefinition,
  instance: SceneObjectInstance,
): ObjectStateDefinition | null => {
  const stateId = instance.initialStateId ?? definition.initialStateId;
  return definition.states.find((candidate) => candidate.id === stateId) ?? null;
};

const transformLocalPoint = (
  point: Point,
  anchor: Point,
  pivot: Point,
  scale: number,
  mirrored: boolean,
): Point => ({
  x: anchor.x + (point.x - pivot.x) * scale * (mirrored ? -1 : 1),
  y: anchor.y + (point.y - pivot.y) * scale,
});

const inverseTransformPoint = (
  point: Point,
  anchor: Point,
  pivot: Point,
  scale: number,
  mirrored: boolean,
): Point => ({
  x: pivot.x + ((point.x - anchor.x) / scale) * (mirrored ? -1 : 1),
  y: pivot.y + (point.y - anchor.y) / scale,
});

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const nativePoint = (
  event: ReactPointerEvent<SVGSVGElement>,
  width: number,
  height: number,
): Point => {
  const svg = event.currentTarget;
  const matrix = svg.getScreenCTM();
  if (matrix) {
    const candidate = svg.createSVGPoint();
    candidate.x = event.clientX;
    candidate.y = event.clientY;
    const resolved = candidate.matrixTransform(matrix.inverse());
    return {
      x: clamp(Math.round(resolved.x), 0, width),
      y: clamp(Math.round(resolved.y), 0, height),
    };
  }
  const bounds = svg.getBoundingClientRect();
  return {
    x: clamp(Math.round(((event.clientX - bounds.left) / Math.max(1, bounds.width)) * width), 0, width),
    y: clamp(Math.round(((event.clientY - bounds.top) / Math.max(1, bounds.height)) * height), 0, height),
  };
};

type CanonicalDrag =
  | {
      readonly kind: "navigation-vertex";
      readonly pointerId: number;
      readonly areaId: Id<"navigation-area">;
      readonly pointIndex: number;
      readonly source: readonly Point[];
    }
  | {
      readonly kind: "portal-endpoint";
      readonly pointerId: number;
      readonly portalId: Id<"navigation-portal">;
      readonly endpoint: "from" | "to";
    }
  | {
      readonly kind: "entrance";
      readonly pointerId: number;
      readonly entranceId: Id<"entrance">;
    }
  | {
      readonly kind: "object";
      readonly pointerId: number;
      readonly objectId: Id<"object">;
    }
  | {
      readonly kind: "hotspot-vertex";
      readonly pointerId: number;
      readonly definitionId: Id<"object-definition">;
      readonly stateId: Id<"object-state">;
      readonly pointIndex: number;
      readonly source: readonly Point[];
      readonly anchor: Point;
      readonly pivot: Point;
      readonly scale: number;
      readonly mirrored: boolean;
    };

const replacePoint = (source: readonly Point[], index: number, point: Point): Point[] =>
  source.map((candidate, candidateIndex) => (candidateIndex === index ? point : candidate));

const commandForDrag = (
  sceneId: Id<"scene">,
  drag: CanonicalDrag,
  point: Point,
): SceneDirectorDocumentCommand => {
  switch (drag.kind) {
    case "navigation-vertex":
      return {
        kind: "set-navigation-area-shape",
        sceneId,
        areaId: drag.areaId,
        shape: { points: replacePoint(drag.source, drag.pointIndex, point) },
      };
    case "portal-endpoint":
      return {
        kind: "set-navigation-portal-endpoint",
        sceneId,
        portalId: drag.portalId,
        endpoint: drag.endpoint,
        position: point,
      };
    case "entrance":
      return {
        kind: "set-entrance-position",
        sceneId,
        entranceId: drag.entranceId,
        position: point,
      };
    case "object":
      return {
        kind: "set-object-instance-position",
        sceneId,
        objectId: drag.objectId,
        position: point,
      };
    case "hotspot-vertex": {
      const local = inverseTransformPoint(point, drag.anchor, drag.pivot, drag.scale, drag.mirrored);
      return {
        kind: "set-object-state-interaction-shape",
        definitionId: drag.definitionId,
        stateId: drag.stateId,
        shape: {
          points: replacePoint(drag.source, drag.pointIndex, {
            x: Math.round(local.x * 100) / 100,
            y: Math.round(local.y * 100) / 100,
          }),
        },
      };
    }
  }
};

export const SceneDirectorCanonicalGeometryPanel = ({
  documents,
  sceneId,
  editing,
}: {
  readonly documents: SceneDirectorDocuments;
  readonly sceneId: Id<"scene">;
  readonly editing: SceneDirectorEditingController;
}) => {
  const [mode, setMode] = useState<CanonicalGeometryMode>("walk");
  const [drag, setDrag] = useState<CanonicalDrag | null>(null);
  const scene = documents.project.scenes.find((candidate) => candidate.id === sceneId);
  const composition = documents.sceneInstances.scenes.find((candidate) => candidate.sceneId === sceneId);
  if (!scene) return null;

  const definitions = new Map(
    documents.sceneInstances.objectDefinitions.map((definition) => [definition.id as string, definition] as const),
  );

  const begin = (event: ReactPointerEvent<SVGCircleElement>, next: CanonicalDrag): void => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag(next);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    editing.onPreviewEdit(commandForDrag(sceneId, drag, nativePoint(event, scene.width, scene.height)));
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    editing.onCommitEdit(commandForDrag(sceneId, drag, nativePoint(event, scene.width, scene.height)));
    setDrag(null);
  };

  const cancel = (): void => {
    editing.onCancelPreview();
    setDrag(null);
  };

  return (
    <section className="dir-canonical-editor">
      <header>
        <div>
          <span className="stg-eyebrow">CANONICAL GEOMETRY · MULTI-DOCUMENT</span>
          <h2>Project floor + composition control</h2>
          <p>These handles edit project.json and scene-instances.json directly, then re-run semantic validation.</p>
        </div>
        <nav aria-label="Canonical geometry modes">
          {(["walk", "control", "hotspots", "objects"] as const).map((candidate) => (
            <StagingButton
              key={candidate}
              active={mode === candidate}
              onClick={() => {
                cancel();
                setMode(candidate);
              }}
            >
              {candidate.toUpperCase()}
            </StagingButton>
          ))}
        </nav>
      </header>
      <div className="dir-canonical-shell">
        <svg
          viewBox={`0 0 ${scene.width} ${scene.height}`}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={cancel}
          aria-label={`${scene.name} canonical geometry editor`}
        >
          <rect className="dir-canonical-bg" width="100%" height="100%" />
          {mode === "walk"
            ? scene.navigationAreas.map((area) => (
                <g key={area.id} className="dir-canonical-nav">
                  <polygon points={points(area.shape.points)} />
                  {area.shape.points.map((point, pointIndex) => (
                    <circle
                      key={`${area.id}.${pointIndex}`}
                      className="dir-canonical-handle"
                      cx={point.x}
                      cy={point.y}
                      r="3"
                      onPointerDown={(event) =>
                        begin(event, {
                          kind: "navigation-vertex",
                          pointerId: event.pointerId,
                          areaId: area.id,
                          pointIndex,
                          source: area.shape.points,
                        })
                      }
                    />
                  ))}
                  <text x={area.shape.points[0]?.x ?? 0} y={(area.shape.points[0]?.y ?? 0) - 4}>{area.id}</text>
                </g>
              ))
            : null}

          {mode === "control"
            ? composition?.navigationPortals.map((portal) => (
                <g key={portal.id} className="dir-canonical-portal">
                  <line x1={portal.fromPoint.x} y1={portal.fromPoint.y} x2={portal.toPoint.x} y2={portal.toPoint.y} />
                  <circle
                    className="dir-canonical-handle"
                    cx={portal.fromPoint.x}
                    cy={portal.fromPoint.y}
                    r="4"
                    onPointerDown={(event) =>
                      begin(event, {
                        kind: "portal-endpoint",
                        pointerId: event.pointerId,
                        portalId: portal.id,
                        endpoint: "from",
                      })
                    }
                  />
                  <circle
                    className="dir-canonical-handle"
                    cx={portal.toPoint.x}
                    cy={portal.toPoint.y}
                    r="4"
                    onPointerDown={(event) =>
                      begin(event, {
                        kind: "portal-endpoint",
                        pointerId: event.pointerId,
                        portalId: portal.id,
                        endpoint: "to",
                      })
                    }
                  />
                </g>
              ))
            : null}

          {mode === "control"
            ? scene.entrances.map((entrance) => (
                <g key={entrance.id} className="dir-canonical-entrance">
                  <circle
                    className="dir-canonical-handle"
                    cx={entrance.position.x}
                    cy={entrance.position.y}
                    r="4"
                    onPointerDown={(event) =>
                      begin(event, {
                        kind: "entrance",
                        pointerId: event.pointerId,
                        entranceId: entrance.id,
                      })
                    }
                  />
                  <text x={entrance.position.x + 5} y={entrance.position.y - 5}>{entrance.id}</text>
                </g>
              ))
            : null}

          {mode === "objects"
            ? composition?.objectInstances.map((instance) => (
                <g key={instance.id} className="dir-canonical-object">
                  <circle
                    className="dir-canonical-handle"
                    cx={instance.position.x}
                    cy={instance.position.y}
                    r="4"
                    onPointerDown={(event) =>
                      begin(event, {
                        kind: "object",
                        pointerId: event.pointerId,
                        objectId: instance.id,
                      })
                    }
                  />
                  <text x={instance.position.x + 5} y={instance.position.y - 5}>{instance.id}</text>
                </g>
              ))
            : null}

          {mode === "hotspots"
            ? composition?.objectInstances.map((instance) => {
                const definition = definitions.get(instance.definitionId);
                if (!definition) return null;
                const state = activeState(definition, instance);
                if (!state?.interactionShape) return null;
                const pivot = state.visual?.pivot ?? { x: 0, y: 0 };
                const scale = objectScale(documents, sceneId, instance);
                const scenePoints = state.interactionShape.points.map((point) =>
                  transformLocalPoint(point, instance.position, pivot, scale, instance.mirrored),
                );
                return (
                  <g key={instance.id} className="dir-canonical-hotspot">
                    <polygon points={points(scenePoints)} />
                    {scenePoints.map((point, pointIndex) => (
                      <circle
                        key={`${instance.id}.${pointIndex}`}
                        className="dir-canonical-handle"
                        cx={point.x}
                        cy={point.y}
                        r="3"
                        onPointerDown={(event) =>
                          begin(event, {
                            kind: "hotspot-vertex",
                            pointerId: event.pointerId,
                            definitionId: definition.id,
                            stateId: state.id,
                            pointIndex,
                            source: state.interactionShape!.points,
                            anchor: instance.position,
                            pivot,
                            scale,
                            mirrored: instance.mirrored,
                          })
                        }
                      />
                    ))}
                    <text x={scenePoints[0]?.x ?? instance.position.x} y={(scenePoints[0]?.y ?? instance.position.y) - 4}>{definition.name}</text>
                  </g>
                );
              })
            : null}
        </svg>
        <footer>
          <span>{mode.toUpperCase()} · canonical owner document</span>
          <strong>{scene.width} × {scene.height} @ 1×</strong>
        </footer>
      </div>
    </section>
  );
};
