import type { ReactNode } from "react";
import type {
  AdventureSceneReadabilityFinding,
  AdventureSceneReadabilityReport,
} from "@evavo/adventure-design/scene-readability";

const shortId = (value: string): string => value.split(".").at(-1) ?? value;

export const Button = ({
  children,
  active = false,
  onClick,
}: {
  readonly children: ReactNode;
  readonly active?: boolean;
  readonly onClick: () => void;
}) => (
  <button
    type="button"
    className={`cmp-button${active ? " is-active" : ""}`}
    onClick={onClick}
  >
    {children}
  </button>
);

export const StatusPip = ({ status }: { readonly status: string }) => (
  <span className={`cmp-status-pip is-${status}`} aria-hidden="true" />
);

const polygonPoints = (points: readonly { readonly x: number; readonly y: number }[]): string =>
  points.map((point) => `${point.x},${point.y}`).join(" ");

const facingVector = (facing: string): { readonly x: number; readonly y: number } => {
  switch (facing) {
    case "north":
      return { x: 0, y: -1 };
    case "north-east":
      return { x: 0.707, y: -0.707 };
    case "east":
      return { x: 1, y: 0 };
    case "south-east":
      return { x: 0.707, y: 0.707 };
    case "south":
      return { x: 0, y: 1 };
    case "south-west":
      return { x: -0.707, y: 0.707 };
    case "west":
      return { x: -1, y: 0 };
    case "north-west":
      return { x: -0.707, y: -0.707 };
    default:
      return { x: 1, y: 0 };
  }
};

export const FindingCard = ({ finding }: { readonly finding: AdventureSceneReadabilityFinding }) => (
  <article className={`cmp-finding is-${finding.severity}`}>
    <div className="cmp-finding-rank">
      <span>{finding.severity}</span>
      <strong>-{finding.impact}</strong>
    </div>
    <div>
      <span>{finding.area}</span>
      <h3>{finding.message}</h3>
      <code>{finding.path}</code>
      <p>{finding.recommendation}</p>
    </div>
  </article>
);

export const Metric = ({
  label,
  value,
  suffix = "",
}: {
  readonly label: string;
  readonly value: string | number;
  readonly suffix?: string;
}) => (
  <div>
    <dt>{label}</dt>
    <dd>
      {value}
      {suffix}
    </dd>
  </div>
);

export const SceneOverlay = ({ report }: { readonly report: AdventureSceneReadabilityReport }) => {
  const { overlay } = report;
  return (
    <figure className="cmp-native-stage">
      <svg
        viewBox={`0 0 ${overlay.nativeSize.width} ${overlay.nativeSize.height}`}
        role="img"
        aria-label={`${report.sceneName} native composition overlay`}
        style={{
          aspectRatio: `${overlay.nativeSize.width} / ${overlay.nativeSize.height}`,
        }}
      >
        <defs>
          <pattern id="cmp-grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0H0V16" fill="none" stroke="currentColor" strokeOpacity="0.1" />
          </pattern>
          <pattern id="cmp-pixel-grid" width="4" height="4" patternUnits="userSpaceOnUse">
            <path d="M4 0H0V4" fill="none" stroke="currentColor" strokeOpacity="0.035" />
          </pattern>
          <marker
            id="cmp-arrow"
            markerWidth="6"
            markerHeight="6"
            refX="3"
            refY="3"
            orient="auto-start-reverse"
          >
            <path d="M0 0L6 3L0 6Z" />
          </marker>
        </defs>
        <rect width="100%" height="100%" className="cmp-stage-base" />
        <rect width="100%" height="100%" fill="url(#cmp-grid)" />
        <rect width="100%" height="100%" fill="url(#cmp-pixel-grid)" />
        <line
          x1="0"
          y1={overlay.nativeSize.height / 3}
          x2={overlay.nativeSize.width}
          y2={overlay.nativeSize.height / 3}
          className="cmp-third-line"
        />
        <line
          x1="0"
          y1={(overlay.nativeSize.height * 2) / 3}
          x2={overlay.nativeSize.width}
          y2={(overlay.nativeSize.height * 2) / 3}
          className="cmp-third-line"
        />
        <line
          x1={overlay.nativeSize.width / 3}
          y1="0"
          x2={overlay.nativeSize.width / 3}
          y2={overlay.nativeSize.height}
          className="cmp-third-line"
        />
        <line
          x1={(overlay.nativeSize.width * 2) / 3}
          y1="0"
          x2={(overlay.nativeSize.width * 2) / 3}
          y2={overlay.nativeSize.height}
          className="cmp-third-line"
        />

        {overlay.navigationAreas.map((area) => (
          <g key={area.id}>
            <polygon
              points={polygonPoints(area.points)}
              className="cmp-navigation-polygon"
            />
            <text
              x={area.points[0]?.x ?? 0}
              y={(area.points[0]?.y ?? 0) - 5}
              className="cmp-overlay-label is-navigation"
            >
              WALK · E{area.elevation}
            </text>
          </g>
        ))}

        {overlay.depthBands.map((band) => (
          <g key={band.id}>
            <line
              x1="0"
              y1={band.farY}
              x2={overlay.nativeSize.width}
              y2={band.farY}
              className="cmp-depth-line is-far"
            />
            <line
              x1="0"
              y1={band.nearY}
              x2={overlay.nativeSize.width}
              y2={band.nearY}
              className="cmp-depth-line is-near"
            />
            <text x="5" y={band.farY - 3} className="cmp-overlay-label is-depth">
              {band.farScale.toFixed(2)}×
            </text>
            <text x="5" y={band.nearY - 3} className="cmp-overlay-label is-depth">
              {band.nearScale.toFixed(2)}×
            </text>
          </g>
        ))}

        {overlay.hotspots.map((hotspot) => (
          <g key={hotspot.id}>
            <polygon
              points={polygonPoints(hotspot.points)}
              className={`cmp-hotspot-polygon${hotspot.changesScene ? " is-exit" : ""}`}
            />
            <text
              x={hotspot.points[0]?.x ?? 0}
              y={(hotspot.points[0]?.y ?? 0) - 4}
              className="cmp-overlay-label is-hotspot"
            >
              {hotspot.name.toUpperCase()}
            </text>
            {hotspot.walkTo ? (
              <g className="cmp-walkto">
                <circle cx={hotspot.walkTo.x} cy={hotspot.walkTo.y} r="3" />
                <path
                  d={[
                    `M${hotspot.walkTo.x - 5} ${hotspot.walkTo.y}`,
                    `H${hotspot.walkTo.x + 5}`,
                    `M${hotspot.walkTo.x} ${hotspot.walkTo.y - 5}`,
                    `V${hotspot.walkTo.y + 5}`,
                  ].join("")}
                />
              </g>
            ) : null}
          </g>
        ))}

        {overlay.occluders.map((occluder) => (
          <g key={occluder.id}>
            {occluder.mask ? (
              <polygon points={polygonPoints(occluder.mask)} className="cmp-occluder-mask" />
            ) : null}
            <line
              x1="0"
              y1={occluder.baselineY}
              x2={overlay.nativeSize.width}
              y2={occluder.baselineY}
              className="cmp-occluder-line"
            />
          </g>
        ))}

        {overlay.entrances.map((entrance) => {
          const direction = facingVector(entrance.facing);
          return (
            <g key={entrance.id} className="cmp-entrance">
              <circle cx={entrance.position.x} cy={entrance.position.y} r="5" />
              <line
                x1={entrance.position.x}
                y1={entrance.position.y}
                x2={entrance.position.x + direction.x * 14}
                y2={entrance.position.y + direction.y * 14}
                markerEnd="url(#cmp-arrow)"
              />
              <text
                x={entrance.position.x + 7}
                y={entrance.position.y - 9}
                className="cmp-overlay-label is-entrance"
              >
                {shortId(entrance.id)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption>
        <div>
          <strong>
            {overlay.nativeSize.width} × {overlay.nativeSize.height}
          </strong>
          <span>native coordinate proof</span>
        </div>
        <ul aria-label="Overlay legend">
          <li className="is-navigation">walk</li>
          <li className="is-hotspot">hotspot</li>
          <li className="is-exit">exit</li>
          <li className="is-occluder">occlusion</li>
        </ul>
      </figcaption>
    </figure>
  );
};
