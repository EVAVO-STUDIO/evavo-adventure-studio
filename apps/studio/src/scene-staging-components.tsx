import type {
  AdventureSceneStagingFinding,
  AdventureSceneStagingReport,
  AdventureSceneStagingSeverity,
} from "@evavo/adventure-design/scene-staging";
import type { ReactNode } from "react";

export type StagingView = "stage" | "findings" | "layers" | "handoff";
export type StagingFindingFilter = "all" | AdventureSceneStagingSeverity;

export const StagingButton = ({
  children,
  active = false,
  disabled = false,
  onClick,
}: {
  readonly children: ReactNode;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}) => (
  <button
    type="button"
    className={`stg-button${active ? " is-active" : ""}`}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </button>
);

export const StatusPip = ({ status }: { readonly status: string }) => (
  <span className={`stg-status-pip is-${status}`} aria-hidden="true" />
);

export const Metric = ({ label, value }: { readonly label: string; readonly value: string | number }) => (
  <div>
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);

const polygonPoints = (points: readonly { readonly x: number; readonly y: number }[]): string =>
  points.map((point) => `${point.x},${point.y}`).join(" ");

const actorLabel = (value: string): string => value.split(".").at(-1) ?? value;

const StageLegend = () => (
  <div className="stg-legend" role="img" aria-label="Stage overlay legend">
    <span className="is-navigation">Navigation</span>
    <span className="is-portal">Portal</span>
    <span className="is-actor">Actor</span>
    <span className="is-object">Object</span>
    <span className="is-interaction">Interaction</span>
    <span className="is-entrance">Entrance</span>
  </div>
);

export const StageOverlay = ({ report }: { readonly report: AdventureSceneStagingReport }) => (
  <div className="stg-stage-view">
    <header>
      <div>
        <span className="stg-eyebrow">CANONICAL INITIAL STATE</span>
        <h1>Actors, props and portal handoffs</h1>
      </div>
      <StageLegend />
    </header>
    <div className="stg-native-shell">
      <svg
        viewBox={`0 0 ${report.overlay.nativeSize.width} ${report.overlay.nativeSize.height}`}
        role="img"
        aria-label={`${report.sceneName} staged native overlay`}
      >
        <defs>
          <pattern id="stg-grid-small" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M8 0H0V8" fill="none" className="stg-grid-small" />
          </pattern>
          <pattern id="stg-grid-large" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" className="stg-grid-large" />
          </pattern>
          <marker id="stg-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0 0L6 3L0 6Z" className="stg-portal-arrow" />
          </marker>
        </defs>
        <rect className="stg-stage-bg" width="100%" height="100%" />
        <path className="stg-stage-mass is-rear" d="M0 0H320V105L0 125Z" />
        <path className="stg-stage-mass is-floor" d="M0 125L320 105V200H0Z" />
        <rect width="100%" height="100%" fill="url(#stg-grid-small)" />
        <rect width="100%" height="100%" fill="url(#stg-grid-large)" />

        {report.overlay.navigationAreas.map((area) => (
          <g key={area.id}>
            <polygon className="stg-navigation" points={polygonPoints(area.points)} />
            <text
              className="stg-navigation-label"
              x={area.points[0]?.x ?? 0}
              y={(area.points[0]?.y ?? 0) - 4}
            >
              {actorLabel(area.id)}
            </text>
          </g>
        ))}
        {report.overlay.portals.map((portal) => (
          <g key={portal.id} className="stg-portal">
            <line
              x1={portal.fromPoint.x}
              y1={portal.fromPoint.y}
              x2={portal.toPoint.x}
              y2={portal.toPoint.y}
              markerEnd="url(#stg-arrow)"
            />
            <circle cx={portal.fromPoint.x} cy={portal.fromPoint.y} r="2.5" />
            <circle cx={portal.toPoint.x} cy={portal.toPoint.y} r="2.5" />
          </g>
        ))}
        {report.overlay.actors.map((actor) => (
          <g key={actor.instanceId} className={`stg-actor is-${actor.mobility}`}>
            <circle cx={actor.position.x} cy={actor.position.y} r="3" />
            <text x={actor.position.x + 5} y={actor.position.y - 5}>
              {actorLabel(actor.instanceId)}
            </text>
          </g>
        ))}
        {report.overlay.objects.map((object) => (
          <g key={object.instanceId} className="stg-object">
            <rect x={object.position.x - 3} y={object.position.y - 3} width="6" height="6" />
            {object.interactionShape ? (
              <polygon className="stg-interaction" points={polygonPoints(object.interactionShape.points)} />
            ) : null}
            <text x={object.position.x + 5} y={object.position.y + 8}>
              {actorLabel(object.instanceId)}
            </text>
          </g>
        ))}
        {report.overlay.entrances.map((entrance) => (
          <g key={entrance.id} className="stg-entrance">
            <circle cx={entrance.position.x} cy={entrance.position.y} r="4" />
            <text x={entrance.position.x + 5} y={entrance.position.y - 5}>
              {actorLabel(entrance.id)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  </div>
);

export const FindingsPanel = ({
  report,
  filter,
  onFilter,
}: {
  readonly report: AdventureSceneStagingReport;
  readonly filter: StagingFindingFilter;
  readonly onFilter: (filter: StagingFindingFilter) => void;
}) => {
  const findings = filter === "all" ? report.findings : report.findings.filter((entry) => entry.severity === filter);
  return (
    <div className="stg-findings-view">
      <header>
        <div>
          <span className="stg-eyebrow">SCENE READINESS</span>
          <h1>{report.sceneName}</h1>
        </div>
        <div className="stg-finding-filters">
          {(["all", "error", "warning", "note"] as const).map((candidate) => (
            <StagingButton key={candidate} active={filter === candidate} onClick={() => onFilter(candidate)}>
              {candidate}
            </StagingButton>
          ))}
        </div>
      </header>
      <div className="stg-findings-list">
        {findings.map((finding) => (
          <FindingCard key={finding.id} finding={finding} />
        ))}
        {findings.length === 0 ? <p className="stg-empty">No findings in this filter.</p> : null}
      </div>
    </div>
  );
};

const FindingCard = ({ finding }: { readonly finding: AdventureSceneStagingFinding }) => (
  <article className={`stg-finding is-${finding.severity}`}>
    <header>
      <span>{finding.severity}</span>
      <code>{finding.code}</code>
    </header>
    <h2>{finding.message}</h2>
    <p>{finding.recommendation}</p>
  </article>
);

export const LayerOrderPanel = ({ report }: { readonly report: AdventureSceneStagingReport }) => (
  <div className="stg-layer-view">
    <header>
      <span className="stg-eyebrow">RENDER ORDER</span>
      <h1>Canonical initial-state layer stack</h1>
    </header>
    <ol>
      {report.layerOrder.map((entry) => (
        <li key={`${entry.layer}:${entry.id}`}>
          <span>{entry.layer}</span>
          <strong>{entry.label}</strong>
          <code>{entry.id}</code>
          <small>e{entry.elevation} · y{Math.round(entry.baselineY)} · z{entry.zOffset}</small>
        </li>
      ))}
    </ol>
  </div>
);

export const HandoffPanel = ({ report }: { readonly report: AdventureSceneStagingReport }) => (
  <div className="stg-handoff-view">
    <header>
      <span className="stg-eyebrow">IMPLEMENTATION HANDOFF</span>
      <h1>What runtime and renderer receive</h1>
    </header>
    <div className="stg-handoff-grid">
      {report.handoff.map((item) => (
        <article key={item.id}>
          <span>{item.category}</span>
          <h2>{item.title}</h2>
          <p>{item.detail}</p>
        </article>
      ))}
    </div>
  </div>
);
