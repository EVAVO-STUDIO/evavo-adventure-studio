import type { ReactNode } from "react";
import type {
  AdventureSceneStagingFinding,
  AdventureSceneStagingReport,
  AdventureSceneStagingSeverity,
} from "@evavo/adventure-design/scene-staging";

export type StagingView = "stage" | "findings" | "layers" | "handoff";
export type StagingFindingFilter = "all" | AdventureSceneStagingSeverity;

export const StagingButton = ({
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
    className={`stg-button${active ? " is-active" : ""}`}
    onClick={onClick}
  >
    {children}
  </button>
);

export const StatusPip = ({ status }: { readonly status: string }) => (
  <span className={`stg-status-pip is-${status}`} aria-hidden="true" />
);

export const Metric = ({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | number;
}) => (
  <div>
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);

const polygonPoints = (
  points: readonly { readonly x: number; readonly y: number }[],
): string => points.map((point) => `${point.x},${point.y}`).join(" ");

const actorLabel = (value: string): string => value.split(".").at(-1) ?? value;

const StageLegend = () => (
  <div className="stg-legend" aria-label="Stage overlay legend">
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
            <polygon
              className="stg-navigation"
              points={polygonPoints(area.points)}
            />
            <text
              className="stg-navigation-label"
              x={area.points[0]?.x ?? 0}
              y={(area.points[0]?.y ?? 0) - 4}
            >
              e{area.elevation}
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
            {portal.bidirectional ? (
              <line
                x1={portal.toPoint.x}
                y1={portal.toPoint.y + 2}
                x2={portal.fromPoint.x}
                y2={portal.fromPoint.y + 2}
                markerEnd="url(#stg-arrow)"
              />
            ) : null}
            <circle cx={portal.fromPoint.x} cy={portal.fromPoint.y} r="3" />
            <circle cx={portal.toPoint.x} cy={portal.toPoint.y} r="3" />
          </g>
        ))}

        {report.overlay.objects.map((object) => (
          <g
            key={object.instanceId}
            className={`stg-object is-${object.layer}${object.visible ? "" : " is-hidden"}`}
          >
            {object.bounds ? (
              <rect
                x={object.bounds.x}
                y={object.bounds.y}
                width={object.bounds.width}
                height={object.bounds.height}
              />
            ) : (
              <rect x={object.position.x - 5} y={object.position.y - 5} width="10" height="10" />
            )}
            {object.interactionShape ? (
              <polygon
                className="stg-object-interaction"
                points={polygonPoints(object.interactionShape.points)}
              />
            ) : null}
            {object.walkTo ? (
              <g className="stg-walk-to">
                <line
                  x1={object.walkTo.x - 4}
                  y1={object.walkTo.y}
                  x2={object.walkTo.x + 4}
                  y2={object.walkTo.y}
                />
                <line
                  x1={object.walkTo.x}
                  y1={object.walkTo.y - 4}
                  x2={object.walkTo.x}
                  y2={object.walkTo.y + 4}
                />
              </g>
            ) : null}
            <text x={object.position.x} y={object.position.y + 10}>
              {actorLabel(String(object.instanceId))}
            </text>
          </g>
        ))}

        {report.overlay.actors.map((actor) => (
          <g key={actor.instanceId} className={`stg-actor is-${actor.mobility}`}>
            {actor.bounds ? (
              <rect
                x={actor.bounds.x}
                y={actor.bounds.y}
                width={actor.bounds.width}
                height={actor.bounds.height}
                rx="2"
              />
            ) : null}
            <circle cx={actor.position.x} cy={actor.position.y} r="3" />
            <line
              x1={actor.position.x - 5}
              y1={actor.position.y}
              x2={actor.position.x + 5}
              y2={actor.position.y}
            />
            <text x={actor.position.x} y={(actor.bounds?.y ?? actor.position.y) - 5}>
              {actor.actorName}
            </text>
          </g>
        ))}

        {report.overlay.entrances.map((entrance) => (
          <g key={entrance.id} className="stg-entrance">
            <circle cx={entrance.position.x} cy={entrance.position.y} r="6" />
            <circle cx={entrance.position.x} cy={entrance.position.y} r="2" />
          </g>
        ))}
      </svg>
      <footer>
        <span>1× native construction overlay</span>
        <strong>{report.overlay.nativeSize.width} × {report.overlay.nativeSize.height}</strong>
      </footer>
    </div>
    <section className="stg-stage-notes">
      <article>
        <span>Control</span>
        <strong>{report.metrics.walkableActorCount === 1 ? "Unambiguous" : "Review required"}</strong>
        <p>One implicit player actor is the safe packaged-runtime default.</p>
      </article>
      <article>
        <span>Interaction</span>
        <strong>{report.metrics.interactiveObjectCount} stateful targets</strong>
        <p>Approach points and visible states must agree with navigation and pixels.</p>
      </article>
      <article>
        <span>Traversal</span>
        <strong>{report.metrics.portalCount} portal handoffs</strong>
        <p>Large handoffs need authored movement or traversal animation.</p>
      </article>
    </section>
  </div>
);

const FindingCard = ({ finding }: { readonly finding: AdventureSceneStagingFinding }) => (
  <article className={`stg-finding is-${finding.severity}`}>
    <div className="stg-finding-rank">
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

export const FindingsPanel = ({
  report,
  filter,
  onFilter,
}: {
  readonly report: AdventureSceneStagingReport;
  readonly filter: StagingFindingFilter;
  readonly onFilter: (filter: StagingFindingFilter) => void;
}) => {
  const visible = report.findings.filter(
    (finding) => filter === "all" || finding.severity === filter,
  );
  return (
    <div className="stg-findings-view">
      <header>
        <div>
          <span className="stg-eyebrow">CORRECTIVE STAGING QUEUE</span>
          <h1>{report.findings.length === 0 ? "No findings" : `${report.findings.length} findings`}</h1>
        </div>
        <div className="stg-filter-row">
          {(["all", "error", "warning", "note"] as const).map((value) => (
            <StagingButton key={value} active={filter === value} onClick={() => onFilter(value)}>
              {value}
            </StagingButton>
          ))}
        </div>
      </header>
      {visible.length > 0 ? (
        <div className="stg-finding-list">
          {visible.map((finding) => <FindingCard key={`${finding.id}-${finding.path}`} finding={finding} />)}
        </div>
      ) : (
        <div className="stg-empty-state">
          <strong>Current staging satisfies this filter.</strong>
          <p>Continue with final atlas, object-state and playtest evidence.</p>
        </div>
      )}
    </div>
  );
};

export const LayerOrderPanel = ({ report }: { readonly report: AdventureSceneStagingReport }) => (
  <div className="stg-layer-view">
    <header>
      <span className="stg-eyebrow">DETERMINISTIC DRAW ORDER</span>
      <h1>{report.overlay.layerOrder.length} staged nodes</h1>
      <p>
        Layer, elevation, baseline, z-offset and stable ID decide the initial visual stack.
        Ties are deterministic but should still be deliberate when silhouettes overlap.
      </p>
    </header>
    <ol className="stg-layer-list">
      {report.overlay.layerOrder.map((node, index) => (
        <li key={node.id} className={`is-${node.kind}`}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>{node.label}</strong>
            <code>{node.id}</code>
          </div>
          <dl>
            <div><dt>Layer</dt><dd>{node.layer}</dd></div>
            <div><dt>Elevation</dt><dd>{node.elevation}</dd></div>
            <div><dt>Baseline</dt><dd>{Math.round(node.baselineY)}</dd></div>
            <div><dt>Z</dt><dd>{node.zOffset}</dd></div>
          </dl>
        </li>
      ))}
    </ol>
  </div>
);

export const HandoffPanel = ({ report }: { readonly report: AdventureSceneStagingReport }) => {
  const cards = [
    {
      title: "Background and level art",
      copy:
        "Protect actor feet, object targets, portal handoffs and entrance " +
        "clearance in the final 320 × 200 value structure.",
    },
    {
      title: "Character and animation",
      copy:
        "Verify initial clips, pivots, silhouette overlap, traversal states and " +
        "contact poses against the exact staged baselines.",
    },
    {
      title: "Interaction design",
      copy:
        "Ensure every stateful prop has readable pixels, reachable approach " +
        "geometry and feedback that survives hotspot-assist being disabled.",
    },
    {
      title: "Runtime engineering",
      copy:
        "Keep one unambiguous implicit player actor, deterministic layer ordering " +
        "and portal transitions consistent with save and replay state.",
    },
    {
      title: "Audio direction",
      copy:
        "Support arrivals, object-state changes and portal motion with authored " +
        "cues or intentional silence rather than generic UI confirmation.",
    },
    {
      title: "Playtest review",
      copy:
        "Enter from every entrance, activate every initial object state, traverse " +
        "every portal and inspect foreground ordering at 1× native scale.",
    },
  ] as const;
  return (
    <div className="stg-handoff-view">
      <header>
        <span className="stg-eyebrow">MULTI-DISCIPLINE HANDOFF</span>
        <h1>Turn the initial scene graph into finished production</h1>
        <p>
          The staging report is a shared contract. It does not replace final pixels, animation,
          interaction feedback, audio or deterministic runtime testing.
        </p>
      </header>
      <section className="stg-handoff-grid">
        {cards.map((card) => (
          <article key={card.title}>
            <span>{card.title}</span>
            <p>{card.copy}</p>
          </article>
        ))}
      </section>
      <section className="stg-exit-gate">
        <div>
          <span className="stg-eyebrow">EXIT GATE</span>
          <h2>Ready for final scene lock only when all evidence agrees</h2>
        </div>
        <ul>
          <li>Canonical scene-instance validation has no errors.</li>
          <li>The initial player-control contract is unambiguous.</li>
          <li>Actors, props and portals read over the final background at native scale.</li>
          <li>Object-state transitions preserve target geometry and layer intent.</li>
          <li>Save, load and replay reproduce the same staged state.</li>
        </ul>
      </section>
    </div>
  );
};
