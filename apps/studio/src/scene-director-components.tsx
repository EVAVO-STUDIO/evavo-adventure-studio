import type { AdventureSceneStagingReport } from "@evavo/adventure-design/scene-staging";
import type { Point } from "@evavo/adventure-project-schema";
import { type PointerEvent as ReactPointerEvent, useState } from "react";
import type { SceneDirectorEditCommand } from "./scene-director-edit.js";
import {
  type SceneDirectorMode,
  type SceneDirectorOverlay,
  sceneDirectorModes,
  sceneDirectorModeSummary,
} from "./scene-director-model.js";
import { StagingButton } from "./scene-staging-components.js";
import "./scene-director.css";

const points = (value: readonly Point[]): string =>
  value.map((point) => `${point.x},${point.y}`).join(" ");

const modeLabel = (mode: SceneDirectorMode): string => mode.toUpperCase();

const show = (
  mode: SceneDirectorMode,
  ...modes: readonly SceneDirectorMode[]
): boolean => mode === "debug" || modes.includes(mode);

const svgId = (value: string): string => value.replace(/[^a-zA-Z0-9_-]+/gu, "-");
const shortId = (value: string): string => value.split(".").at(-1) ?? value;

export interface SceneDirectorEditingController {
  readonly onPreviewEdit: (command: SceneDirectorEditCommand) => void;
  readonly onCommitEdit: (command: SceneDirectorEditCommand) => void;
  readonly onCancelPreview: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly error: string | null;
}

type SceneDirectorDrag =
  | {
      readonly kind: "walk-point";
      readonly pointerId: number;
      readonly laneId: string;
      readonly pointIndex: number;
      readonly originalPoints: readonly Point[];
      readonly lastPoint: Point;
    }
  | {
      readonly kind: "approach-slot";
      readonly pointerId: number;
      readonly objectId: string;
      readonly slotId: string;
      readonly facing: string;
      readonly lastPoint: Point;
    }
  | {
      readonly kind: "depth-key";
      readonly pointerId: number;
      readonly curveId: string;
      readonly keyIndex: number;
      readonly scale: number;
      readonly lastPoint: Point;
    }
  | {
      readonly kind: "occlusion-baseline";
      readonly pointerId: number;
      readonly planeId: string;
      readonly lastPoint: Point;
    }
  | {
      readonly kind: "light-vertex";
      readonly pointerId: number;
      readonly zoneId: string;
      readonly pointIndex: number;
      readonly originalPoints: readonly Point[];
      readonly lastPoint: Point;
    }
  | {
      readonly kind: "surface-vertex";
      readonly pointerId: number;
      readonly zoneId: string;
      readonly pointIndex: number;
      readonly originalPoints: readonly Point[];
      readonly lastPoint: Point;
    }
  | {
      readonly kind: "entry-spawn";
      readonly pointerId: number;
      readonly entranceId: string;
      readonly originalPath: readonly Point[];
      readonly lastPoint: Point;
    }
  | {
      readonly kind: "entry-path-point";
      readonly pointerId: number;
      readonly entranceId: string;
      readonly originalSpawn?: Point;
      readonly pointIndex: number;
      readonly originalPath: readonly Point[];
      readonly lastPoint: Point;
    };

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export const roundAndClampNativePoint = (
  point: Point,
  nativeSize: { readonly width: number; readonly height: number },
): Point => ({
  x: clamp(Math.round(point.x), 0, nativeSize.width),
  y: clamp(Math.round(point.y), 0, nativeSize.height),
});

const nativePointFromPointer = (
  event: ReactPointerEvent<SVGSVGElement>,
  nativeSize: { readonly width: number; readonly height: number },
): Point => {
  const svg = event.currentTarget;
  const matrix = svg.getScreenCTM();
  if (matrix) {
    const screenPoint = svg.createSVGPoint();
    screenPoint.x = event.clientX;
    screenPoint.y = event.clientY;
    const native = screenPoint.matrixTransform(matrix.inverse());
    return roundAndClampNativePoint(native, nativeSize);
  }

  const bounds = svg.getBoundingClientRect();
  const width = bounds.width || 1;
  const height = bounds.height || 1;
  return roundAndClampNativePoint(
    {
      x: ((event.clientX - bounds.left) / width) * nativeSize.width,
      y: ((event.clientY - bounds.top) / height) * nativeSize.height,
    },
    nativeSize,
  );
};

const replacePoint = (
  source: readonly Point[],
  pointIndex: number,
  point: Point,
): readonly Point[] => source.map((candidate, index) => (index === pointIndex ? point : candidate));

const commandForDrag = (
  overlay: SceneDirectorOverlay,
  drag: SceneDirectorDrag,
  point: Point,
): SceneDirectorEditCommand => {
  switch (drag.kind) {
    case "walk-point":
      return {
        kind: "set-walk-lane-points",
        sceneId: overlay.sceneId,
        laneId: drag.laneId as never,
        points: replacePoint(drag.originalPoints, drag.pointIndex, point),
      };
    case "approach-slot":
      return {
        kind: "move-approach-slot",
        sceneId: overlay.sceneId,
        objectId: drag.objectId as never,
        slotId: drag.slotId as never,
        position: point,
        facing: drag.facing as never,
      };
    case "depth-key":
      return {
        kind: "set-depth-key",
        sceneId: overlay.sceneId,
        curveId: drag.curveId as never,
        keyIndex: drag.keyIndex,
        y: point.y,
        scale: drag.scale,
      };
    case "occlusion-baseline":
      return {
        kind: "set-occlusion-baseline",
        sceneId: overlay.sceneId,
        planeId: drag.planeId as never,
        baselineY: point.y,
      };
    case "light-vertex":
      return {
        kind: "set-light-zone-shape",
        sceneId: overlay.sceneId,
        zoneId: drag.zoneId as never,
        shape: { points: replacePoint(drag.originalPoints, drag.pointIndex, point) },
      };
    case "surface-vertex":
      return {
        kind: "set-surface-zone-shape",
        sceneId: overlay.sceneId,
        zoneId: drag.zoneId as never,
        shape: { points: replacePoint(drag.originalPoints, drag.pointIndex, point) },
      };
    case "entry-spawn":
      return {
        kind: "set-entry-path",
        sceneId: overlay.sceneId,
        entranceId: drag.entranceId as never,
        spawnPosition: point,
        entryPath: drag.originalPath,
      };
    case "entry-path-point":
      return {
        kind: "set-entry-path",
        sceneId: overlay.sceneId,
        entranceId: drag.entranceId as never,
        ...(drag.originalSpawn ? { spawnPosition: drag.originalSpawn } : {}),
        entryPath: replacePoint(drag.originalPath, drag.pointIndex, point),
      };
  }
};

const FacingRay = ({ point, facing }: { readonly point: Point; readonly facing: string }) => {
  const vectors: Readonly<Record<string, Point>> = {
    north: { x: 0, y: -10 },
    "north-east": { x: 8, y: -8 },
    east: { x: 10, y: 0 },
    "south-east": { x: 8, y: 8 },
    south: { x: 0, y: 10 },
    "south-west": { x: -8, y: 8 },
    west: { x: -10, y: 0 },
    "north-west": { x: -8, y: -8 },
  };
  const vector = vectors[facing] ?? { x: 0, y: -10 };
  return (
    <line
      className="dir-facing"
      x1={point.x}
      y1={point.y}
      x2={point.x + vector.x}
      y2={point.y + vector.y}
    />
  );
};

const DirectorSvg = ({
  overlay,
  report,
  mode,
  editing,
}: {
  readonly overlay: SceneDirectorOverlay;
  readonly report: AdventureSceneStagingReport;
  readonly mode: SceneDirectorMode;
  readonly editing?: SceneDirectorEditingController;
}) => {
  const staging = overlay.staging;
  const [drag, setDrag] = useState<SceneDirectorDrag | null>(null);

  const capture = (event: ReactPointerEvent<SVGCircleElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startWalkDrag = (
    event: ReactPointerEvent<SVGCircleElement>,
    laneId: string,
    pointIndex: number,
    lanePoints: readonly Point[],
  ): void => {
    if (!editing || mode !== "walk") return;
    const point = lanePoints[pointIndex];
    if (!point) return;
    capture(event);
    setDrag({
      kind: "walk-point",
      pointerId: event.pointerId,
      laneId,
      pointIndex,
      originalPoints: [...lanePoints],
      lastPoint: point,
    });
  };

  const startApproachDrag = (
    event: ReactPointerEvent<SVGCircleElement>,
    objectId: string,
    slotId: string,
    facing: string,
    point: Point,
  ): void => {
    if (!editing || mode !== "approach") return;
    capture(event);
    setDrag({
      kind: "approach-slot",
      pointerId: event.pointerId,
      objectId,
      slotId,
      facing,
      lastPoint: point,
    });
  };

  const startDepthDrag = (
    event: ReactPointerEvent<SVGCircleElement>,
    curveId: string,
    keyIndex: number,
    scale: number,
    y: number,
  ): void => {
    if (!editing || mode !== "depth") return;
    capture(event);
    setDrag({
      kind: "depth-key",
      pointerId: event.pointerId,
      curveId,
      keyIndex,
      scale,
      lastPoint: { x: overlay.nativeSize.width - 9, y },
    });
  };

  const startOcclusionDrag = (
    event: ReactPointerEvent<SVGCircleElement>,
    planeId: string,
    baselineY: number,
  ): void => {
    if (!editing || mode !== "occlusion") return;
    capture(event);
    setDrag({
      kind: "occlusion-baseline",
      pointerId: event.pointerId,
      planeId,
      lastPoint: { x: overlay.nativeSize.width - 9, y: baselineY },
    });
  };

  const startVertexDrag = (
    event: ReactPointerEvent<SVGCircleElement>,
    kind: "light-vertex" | "surface-vertex",
    zoneId: string,
    pointIndex: number,
    sourcePoints: readonly Point[],
  ): void => {
    if (!editing) return;
    if (kind === "light-vertex" && mode !== "light") return;
    if (kind === "surface-vertex" && mode !== "surface") return;
    const point = sourcePoints[pointIndex];
    if (!point) return;
    capture(event);
    setDrag({
      kind,
      pointerId: event.pointerId,
      zoneId,
      pointIndex,
      originalPoints: [...sourcePoints],
      lastPoint: point,
    });
  };

  const startEntrySpawnDrag = (
    event: ReactPointerEvent<SVGCircleElement>,
    entranceId: string,
    spawnPosition: Point,
    entryPath: readonly Point[],
  ): void => {
    if (!editing || mode !== "entry") return;
    capture(event);
    setDrag({
      kind: "entry-spawn",
      pointerId: event.pointerId,
      entranceId,
      originalPath: [...entryPath],
      lastPoint: spawnPosition,
    });
  };

  const startEntryPathDrag = (
    event: ReactPointerEvent<SVGCircleElement>,
    entranceId: string,
    spawnPosition: Point | undefined,
    pointIndex: number,
    entryPath: readonly Point[],
  ): void => {
    if (!editing || mode !== "entry") return;
    const point = entryPath[pointIndex];
    if (!point) return;
    capture(event);
    setDrag({
      kind: "entry-path-point",
      pointerId: event.pointerId,
      entranceId,
      ...(spawnPosition ? { originalSpawn: spawnPosition } : {}),
      pointIndex,
      originalPath: [...entryPath],
      lastPoint: point,
    });
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!editing || !drag || drag.pointerId !== event.pointerId) return;
    const point = nativePointFromPointer(event, overlay.nativeSize);
    editing.onPreviewEdit(commandForDrag(overlay, drag, point));
    setDrag({ ...drag, lastPoint: point });
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!editing || !drag || drag.pointerId !== event.pointerId) return;
    const point = nativePointFromPointer(event, overlay.nativeSize);
    editing.onCommitEdit(commandForDrag(overlay, drag, point));
    setDrag(null);
  };

  const onPointerCancel = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!editing || !drag || drag.pointerId !== event.pointerId) return;
    editing.onCancelPreview();
    setDrag(null);
  };

  return (
    <svg
      className={`dir-svg is-${mode}${editing ? " is-editable" : ""}`}
      viewBox={`0 0 ${overlay.nativeSize.width} ${overlay.nativeSize.height}`}
      role="img"
      aria-label={`${overlay.sceneName} ${mode} Scene Director overlay`}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <defs>
        <pattern id="dir-grid-small" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M8 0H0V8" className="dir-grid-small" fill="none" />
        </pattern>
        <pattern id="dir-grid-large" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" className="dir-grid-large" fill="none" />
        </pattern>
        <marker id="dir-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0 0L6 3L0 6Z" className="dir-arrow" />
        </marker>
        {overlay.lightZones
          .filter(({ zone }) => zone.blendMode === "ordered-dither")
          .map(({ zone }) => (
            <clipPath key={zone.id} id={`dir-light-clip-${svgId(zone.id)}`}>
              <polygon points={points(zone.shape.points)} />
            </clipPath>
          ))}
      </defs>

      <rect className="dir-room-bg" width="100%" height="100%" />
      <path className="dir-room-rear" d="M0 0H320V105L0 125Z" />
      <path className="dir-room-floor" d="M0 125L320 105V200H0Z" />
      <rect width="100%" height="100%" fill="url(#dir-grid-small)" />
      <rect width="100%" height="100%" fill="url(#dir-grid-large)" />

      {show(mode, "walk", "control", "actors")
        ? overlay.navigationAreas.map((area) => (
            <polygon key={area.id} className="dir-navigation" points={points(area.shape.points)} />
          ))
        : null}

      {show(mode, "walk", "control")
        ? overlay.portals.map((portal) => (
            <g key={portal.id} className="dir-portal">
              <line
                x1={portal.fromPoint.x}
                y1={portal.fromPoint.y}
                x2={portal.toPoint.x}
                y2={portal.toPoint.y}
                markerEnd="url(#dir-arrow)"
              />
              <circle cx={portal.fromPoint.x} cy={portal.fromPoint.y} r="2.5" />
              <circle cx={portal.toPoint.x} cy={portal.toPoint.y} r="2.5" />
            </g>
          ))
        : null}

      {show(mode, "walk")
        ? staging?.preferredWalkLanes.map((lane) => (
            <g key={lane.id} className="dir-walk-lane">
              <polyline points={points(lane.points)} />
              {lane.points.map((point, index) => (
                <circle
                  key={`${lane.id}-${index}`}
                  className={editing && mode === "walk" ? "dir-edit-handle" : undefined}
                  cx={point.x}
                  cy={point.y}
                  r={editing && mode === "walk" ? 3.2 : 2}
                  onPointerDown={(event) => startWalkDrag(event, lane.id, index, lane.points)}
                />
              ))}
            </g>
          ))
        : null}

      {show(mode, "control")
        ? staging?.navigationStateModifiers.map((modifier, index) => (
            <text key={modifier.id} className="dir-control-label" x="8" y={12 + index * 9}>
              {modifier.objectId} gates {modifier.disabledPortalIds.length} portal(s)
            </text>
          ))
        : null}

      {show(mode, "surface")
        ? staging?.surfaceZones.map((zone) => (
            <g key={zone.id} className="dir-surface-zone">
              <polygon points={points(zone.shape.points)} />
              {editing && mode === "surface"
                ? zone.shape.points.map((point, index) => (
                    <circle
                      key={`${zone.id}-edit-${index}`}
                      className="dir-edit-handle"
                      cx={point.x}
                      cy={point.y}
                      r="3"
                      onPointerDown={(event) =>
                        startVertexDrag(event, "surface-vertex", zone.id, index, zone.shape.points)
                      }
                    />
                  ))
                : null}
              <text x={zone.shape.points[0]?.x ?? 0} y={(zone.shape.points[0]?.y ?? 0) - 3}>
                {zone.surface} ×{zone.movementMultiplier.toFixed(2)}
              </text>
            </g>
          ))
        : null}

      {show(mode, "light")
        ? overlay.lightZones.map(({ zone, map, bindingStatus }) => {
            const clipId = `dir-light-clip-${svgId(zone.id)}`;
            const target = map ? `${shortId(map.paletteAssetId)} +${map.paletteOffset}` : zone.paletteMapId;
            const transition = zone.blendMode === "ordered-dither" ? "B4 · 8px" : "hard";
            return (
              <g key={zone.id} className={`dir-light-zone is-${bindingStatus}`}>
                <polygon className="dir-light-zone-shape" points={points(zone.shape.points)} />
                {zone.blendMode === "ordered-dither" ? (
                  <polygon
                    className="dir-light-dither-band"
                    points={points(zone.shape.points)}
                    clipPath={`url(#${clipId})`}
                  />
                ) : null}
                {editing && mode === "light"
                  ? zone.shape.points.map((point, index) => (
                      <circle
                        key={`${zone.id}-edit-${index}`}
                        className="dir-edit-handle"
                        cx={point.x}
                        cy={point.y}
                        r="3"
                        onPointerDown={(event) =>
                          startVertexDrag(event, "light-vertex", zone.id, index, zone.shape.points)
                        }
                      />
                    ))
                  : null}
                <text x={zone.shape.points[0]?.x ?? 0} y={(zone.shape.points[0]?.y ?? 0) - 3}>
                  {target} · {transition} · {bindingStatus}
                </text>
              </g>
            );
          })
        : null}

      {show(mode, "depth")
        ? staging?.depthScaleCurves.flatMap((curve) =>
            curve.keys.map((key, keyIndex) => (
              <g key={`${curve.id}-${keyIndex}`} className="dir-depth-key">
                <line x1="0" y1={key.y} x2={overlay.nativeSize.width} y2={key.y} />
                {editing && mode === "depth" ? (
                  <circle
                    className="dir-edit-handle"
                    cx={overlay.nativeSize.width - 9}
                    cy={key.y}
                    r="3.2"
                    onPointerDown={(event) =>
                      startDepthDrag(event, curve.id, keyIndex, key.scale, key.y)
                    }
                  />
                ) : null}
                <text x="5" y={key.y - 2}>
                  {Math.round(key.scale * 100)}%
                </text>
              </g>
            )),
          )
        : null}

      {show(mode, "occlusion")
        ? staging?.occlusionPlanes.map((plane) => (
            <g key={plane.id} className="dir-occlusion-plane">
              <line x1="0" y1={plane.baselineY} x2={overlay.nativeSize.width} y2={plane.baselineY} />
              <circle cx={plane.position.x} cy={plane.position.y} r="3" />
              {editing && mode === "occlusion" ? (
                <circle
                  className="dir-edit-handle"
                  cx={overlay.nativeSize.width - 9}
                  cy={plane.baselineY}
                  r="3.2"
                  onPointerDown={(event) =>
                    startOcclusionDrag(event, plane.id, plane.baselineY)
                  }
                />
              ) : null}
              <text x={plane.position.x + 5} y={plane.position.y - 4}>
                {plane.id} · baseline {Math.round(plane.baselineY)}
              </text>
            </g>
          ))
        : null}

      {show(mode, "hotspots")
        ? report.overlay.objects.map((object) =>
            object.interactionShape ? (
              <polygon
                key={String(object.instanceId)}
                className="dir-hotspot-exact"
                points={points(object.interactionShape.points)}
              />
            ) : null,
          )
        : null}

      {show(mode, "hotspots")
        ? overlay.objects.flatMap((object) =>
            object.comfortRegions.map((region) => (
              <polygon
                key={region.id}
                className="dir-hotspot-comfort"
                points={points(region.shape.points)}
              />
            )),
          )
        : null}

      {show(mode, "approach")
        ? overlay.objects.flatMap((object) =>
            object.approachSlots.map((slot) => (
              <g key={slot.id} className="dir-approach-slot">
                <circle
                  className={editing && mode === "approach" ? "dir-edit-handle" : undefined}
                  cx={slot.position.x}
                  cy={slot.position.y}
                  r="4"
                  onPointerDown={(event) =>
                    startApproachDrag(event, object.instanceId, slot.id, slot.facing, slot.position)
                  }
                />
                <line x1={slot.position.x - 6} y1={slot.position.y} x2={slot.position.x + 6} y2={slot.position.y} />
                <line x1={slot.position.x} y1={slot.position.y - 6} x2={slot.position.x} y2={slot.position.y + 6} />
                <FacingRay point={slot.position} facing={slot.facing} />
                <text x={slot.position.x + 7} y={slot.position.y - 7}>
                  {slot.validVerbs.join("/") || "any"}
                </text>
              </g>
            )),
          )
        : null}

      {show(mode, "entry")
        ? staging?.entryChoreographies.map((entry) => {
            const entrance = overlay.entrances.find((candidate) => candidate.id === entry.entranceId);
            const spawn = entry.spawnPosition ?? entrance?.position;
            const route = [spawn, ...entry.entryPath].filter(
              (point): point is Point => Boolean(point),
            );
            return (
              <g key={entry.entranceId} className="dir-entry-path">
                {route.length > 1 ? <polyline points={points(route)} markerEnd="url(#dir-arrow)" /> : null}
                {spawn ? (
                  <circle
                    className={editing && mode === "entry" && entry.spawnPosition ? "dir-edit-handle" : undefined}
                    cx={spawn.x}
                    cy={spawn.y}
                    r="4"
                    onPointerDown={(event) => {
                      if (entry.spawnPosition) {
                        startEntrySpawnDrag(event, entry.entranceId, entry.spawnPosition, entry.entryPath);
                      }
                    }}
                  />
                ) : null}
                {editing && mode === "entry"
                  ? entry.entryPath.map((point, index) => (
                      <circle
                        key={`${entry.entranceId}-path-${index}`}
                        className="dir-edit-handle"
                        cx={point.x}
                        cy={point.y}
                        r="3.2"
                        onPointerDown={(event) =>
                          startEntryPathDrag(
                            event,
                            entry.entranceId,
                            entry.spawnPosition,
                            index,
                            entry.entryPath,
                          )
                        }
                      />
                    ))
                  : null}
                {entrance ? <circle className="is-arrival" cx={entrance.position.x} cy={entrance.position.y} r="4" /> : null}
                <text x={(route[0]?.x ?? 0) + 5} y={(route[0]?.y ?? 0) - 5}>
                  {entry.unlockControlAt}
                </text>
              </g>
            );
          })
        : null}

      {show(mode, "actors", "art")
        ? overlay.actors.map((actor) => {
            const footprint = actor.footprint;
            const width = footprint ? footprint.width + footprint.clearance * 2 : 0;
            const depth = footprint ? footprint.depth + footprint.clearance * 2 : 0;
            return (
              <g key={actor.instanceId} className={`dir-actor is-${actor.mobility}`}>
                {footprint ? (
                  <ellipse
                    className="dir-footprint"
                    cx={actor.position.x}
                    cy={actor.position.y}
                    rx={width / 2}
                    ry={depth / 2}
                  />
                ) : null}
                <circle cx={actor.position.x} cy={actor.position.y} r="3" />
                <FacingRay point={actor.position} facing={actor.facing} />
                <text x={actor.position.x + 5} y={actor.position.y - 6}>
                  {actor.name}
                </text>
              </g>
            );
          })
        : null}

      {show(mode, "art", "approach", "hotspots")
        ? overlay.objects.map((object) => (
            <g key={object.instanceId} className="dir-object-anchor">
              <rect x={object.position.x - 3} y={object.position.y - 3} width="6" height="6" />
              <text x={object.position.x + 5} y={object.position.y + 8}>
                {object.name}
              </text>
            </g>
          ))
        : null}

      {mode === "debug" ? (
        <g className="dir-debug-labels">
          <text x="7" y={overlay.nativeSize.height - 16}>
            {overlay.sceneId}
          </text>
          <text x="7" y={overlay.nativeSize.height - 7}>
            actors {overlay.actors.length} · objects {overlay.objects.length} · portals {overlay.portals.length}
          </text>
        </g>
      ) : null}
    </svg>
  );
};

const directlyEditableModes = new Set<SceneDirectorMode>([
  "walk",
  "depth",
  "occlusion",
  "approach",
  "surface",
  "light",
  "entry",
]);

export const SceneDirectorPanel = ({
  overlay,
  report,
  editing,
}: {
  readonly overlay: SceneDirectorOverlay;
  readonly report: AdventureSceneStagingReport;
  readonly editing?: SceneDirectorEditingController;
}) => {
  const [mode, setMode] = useState<SceneDirectorMode>("walk");
  const summary = sceneDirectorModeSummary(overlay, mode);

  const chooseMode = (candidate: SceneDirectorMode): void => {
    editing?.onCancelPreview();
    setMode(candidate);
  };

  return (
    <div className="dir-panel">
      <header className="dir-header">
        <div>
          <span className="stg-eyebrow">SCENE DIRECTOR · NATIVE 2.5D STAGE</span>
          <h1>{overlay.sceneName}</h1>
          <p>{summary.note}</p>
        </div>
        <div className="dir-mode-stat">
          <strong>{summary.count}</strong>
          <span>{summary.label} contracts</span>
        </div>
      </header>

      <nav className="dir-mode-bar" aria-label="Scene Director overlay modes">
        {sceneDirectorModes.map((candidate) => (
          <StagingButton key={candidate} active={mode === candidate} onClick={() => chooseMode(candidate)}>
            {modeLabel(candidate)}
          </StagingButton>
        ))}
        {editing ? (
          <div className="dir-edit-actions">
            <span className="dir-edit-status">EDIT</span>
            <StagingButton disabled={!editing.canUndo} onClick={editing.onUndo}>
              Undo
            </StagingButton>
            <StagingButton disabled={!editing.canRedo} onClick={editing.onRedo}>
              Redo
            </StagingButton>
          </div>
        ) : null}
      </nav>

      {editing?.error ? <div className="dir-edit-error" role="alert">{editing.error}</div> : null}

      <div className="dir-native-shell">
        <DirectorSvg
          key={mode}
          overlay={overlay}
          report={report}
          mode={mode}
          editing={editing}
        />
        <footer>
          <span>
            {modeLabel(mode)} · canonical native coordinates
            {editing && directlyEditableModes.has(mode) ? " · drag handles to edit" : ""}
          </span>
          <strong>{overlay.nativeSize.width} × {overlay.nativeSize.height} @ 1×</strong>
        </footer>
      </div>

      <section className="dir-contract-strip">
        <article>
          <span>Movement</span>
          <strong>{overlay.staging?.preferredWalkLanes.length ?? 0} directed lane(s)</strong>
          <p>Soft routing preference; never a forced spline.</p>
        </article>
        <article>
          <span>Interaction</span>
          <strong>{overlay.objects.reduce((total, object) => total + object.approachSlots.length, 0)} approach slot(s)</strong>
          <p>Standing position, facing and verb/item intent are authored together.</p>
        </article>
        <article>
          <span>Perspective</span>
          <strong>{overlay.staging?.depthScaleCurves.length ?? 0} scale curve(s)</strong>
          <p>Review the actor against the painting, not a generic linear depth rule.</p>
        </article>
        <article>
          <span>Arrival</span>
          <strong>{overlay.staging?.entryChoreographies.length ?? 0} entry beat(s)</strong>
          <p>Spawn, movement and control handoff stay deterministic.</p>
        </article>
      </section>
    </div>
  );
};
