import type { AdventureSceneStagingReport } from "@evavo/adventure-design/scene-staging";
import type { Point } from "@evavo/adventure-project-schema";
import { useState } from "react";
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
}: {
  readonly overlay: SceneDirectorOverlay;
  readonly report: AdventureSceneStagingReport;
  readonly mode: SceneDirectorMode;
}) => {
  const staging = overlay.staging;
  return (
    <svg
      className={`dir-svg is-${mode}`}
      viewBox={`0 0 ${overlay.nativeSize.width} ${overlay.nativeSize.height}`}
      role="img"
      aria-label={`${overlay.sceneName} ${mode} Scene Director overlay`}
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
                <circle key={`${lane.id}-${index}`} cx={point.x} cy={point.y} r="2" />
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
              <text x={zone.shape.points[0]?.x ?? 0} y={(zone.shape.points[0]?.y ?? 0) - 3}>
                {zone.surface} ×{zone.movementMultiplier.toFixed(2)}
              </text>
            </g>
          ))
        : null}

      {show(mode, "light")
        ? staging?.paletteLightZones.map((zone) => (
            <g key={zone.id} className="dir-light-zone">
              <polygon points={points(zone.shape.points)} />
              <text x={zone.shape.points[0]?.x ?? 0} y={(zone.shape.points[0]?.y ?? 0) - 3}>
                {zone.paletteMapId} · {zone.blendMode}
              </text>
            </g>
          ))
        : null}

      {show(mode, "depth")
        ? staging?.depthScaleCurves.flatMap((curve) =>
            curve.keys.map((key) => (
              <g key={`${curve.id}-${key.y}`} className="dir-depth-key">
                <line x1="0" y1={key.y} x2={overlay.nativeSize.width} y2={key.y} />
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
                <circle cx={slot.position.x} cy={slot.position.y} r="4" />
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
            const route = [entry.spawnPosition ?? entrance?.position, ...entry.entryPath].filter(
              (point): point is Point => Boolean(point),
            );
            return (
              <g key={entry.entranceId} className="dir-entry-path">
                {route.length > 1 ? <polyline points={points(route)} markerEnd="url(#dir-arrow)" /> : null}
                {route[0] ? <circle cx={route[0].x} cy={route[0].y} r="4" /> : null}
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

export const SceneDirectorPanel = ({
  overlay,
  report,
}: {
  readonly overlay: SceneDirectorOverlay;
  readonly report: AdventureSceneStagingReport;
}) => {
  const [mode, setMode] = useState<SceneDirectorMode>("walk");
  const summary = sceneDirectorModeSummary(overlay, mode);

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
          <StagingButton key={candidate} active={mode === candidate} onClick={() => setMode(candidate)}>
            {modeLabel(candidate)}
          </StagingButton>
        ))}
      </nav>

      <div className="dir-native-shell">
        <DirectorSvg overlay={overlay} report={report} mode={mode} />
        <footer>
          <span>{modeLabel(mode)} · canonical native coordinates</span>
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
