import type { ReactNode } from "react";
import type {
  AdventureProgressionFinding,
  AdventureProgressionMilestone,
  AdventureProgressionReport,
  AdventureProgressionSeverity,
  AdventureProgressionTerminalState,
} from "@evavo/adventure-design/progression";
import type { AdventureDesignDocument } from "@evavo/adventure-design";
import type { AdventureProject } from "@evavo/adventure-project-schema";

export type ProgressionView = "flow" | "milestones" | "risks";
export type ProgressionFindingFilter = "all" | AdventureProgressionSeverity;

export const ProgressionButton = ({
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
    className={`prg-button${active ? " is-active" : ""}`}
    onClick={onClick}
  >
    {children}
  </button>
);

export const StatusPip = ({ status }: { readonly status: string }) => (
  <span className={`prg-status-pip is-${status}`} aria-hidden="true" />
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

const shortId = (value: string): string => value.split(".").at(-1) ?? value;

const Witness = ({
  steps,
}: {
  readonly steps: AdventureProgressionMilestone["witness"]["steps"];
}) =>
  steps.length === 0 ? (
    <p className="prg-witness-empty">Initial canonical state.</p>
  ) : (
    <ol className="prg-witness">
      {steps.map((step, index) => (
        <li key={`${step.id}.${index}`}>
          <span>{index + 1}</span>
          <div>
            <strong>{step.label}</strong>
            <small>{step.actionSummary.join(" · ") || "authored feedback"}</small>
          </div>
        </li>
      ))}
    </ol>
  );

const locationByScene = (
  design: AdventureDesignDocument,
): ReadonlyMap<string, AdventureDesignDocument["map"]["locations"][number]> =>
  new Map(
    design.map.locations.flatMap((location) =>
      location.sceneId ? [[location.sceneId as string, location] as const] : [],
    ),
  );

const sceneNameById = (
  project: AdventureProject,
): ReadonlyMap<string, string> =>
  new Map(project.scenes.map((scene) => [scene.id as string, scene.name] as const));

export const WorldFlowView = ({
  project,
  design,
  report,
}: {
  readonly project: AdventureProject;
  readonly design: AdventureDesignDocument;
  readonly report: AdventureProgressionReport;
}) => {
  const locations = locationByScene(design);
  const sceneNames = sceneNameById(project);
  const reached = new Set(report.reachableSceneIds);
  const graphLocations = project.scenes.map((scene, index) => {
    const location = locations.get(scene.id);
    return {
      scene,
      x: location?.position.x ?? 48 + index * 100,
      y: location?.position.y ?? 100,
      name: location?.name ?? scene.name,
    };
  });
  const points = new Map(
    graphLocations.map((location) => [location.scene.id as string, location] as const),
  );

  return (
    <section className="prg-flow-view">
      <header>
        <div>
          <span className="prg-eyebrow">BOUNDED RUNTIME EXPLORATION</span>
          <h1>World and state flow</h1>
          <p>
            Edges are proven by executable hotspot, object, dialogue or sequence state
            transitions, not by an illustrated route line alone.
          </p>
        </div>
        <div className="prg-coverage-chip">
          <strong>{report.metrics.objectiveCoveragePercent}%</strong>
          <span>objective coverage</span>
        </div>
      </header>

      <div className="prg-map-shell">
        <svg viewBox="0 0 320 200" role="img" aria-label="Explored adventure progression graph">
          <defs>
            <pattern id="prg-grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M16 0H0V16" fill="none" className="prg-grid-line" />
            </pattern>
            <marker
              id="prg-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M0 0L10 5L0 10Z" className="prg-arrow-head" />
            </marker>
          </defs>
          <rect width="320" height="200" className="prg-map-background" />
          <rect width="320" height="200" fill="url(#prg-grid)" />

          {report.sceneEdges.map((edge) => {
            const from = points.get(edge.fromSceneId);
            const to = points.get(edge.toSceneId);
            if (!from || !to) return null;
            const middleX = (from.x + to.x) / 2;
            const middleY = (from.y + to.y) / 2;
            return (
              <g key={edge.id} className="prg-edge">
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  markerEnd="url(#prg-arrow)"
                />
                <text x={middleX} y={middleY - 7}>
                  {shortId(edge.via)}
                </text>
              </g>
            );
          })}

          {graphLocations.map(({ scene, x, y, name }) => {
            const isReached = reached.has(scene.id);
            const isStart = scene.id === project.startSceneId;
            return (
              <g
                key={scene.id}
                className={`prg-node${isReached ? " is-reached" : " is-unreached"}${
                  isStart ? " is-start" : ""
                }`}
                transform={`translate(${x} ${y})`}
              >
                <circle r="15" />
                <circle r="5" className="prg-node-core" />
                <text y="27">{name}</text>
                <title>
                  {sceneNames.get(scene.id) ?? scene.id}: {isReached ? "reachable" : "unreachable"}
                </title>
              </g>
            );
          })}
        </svg>
        <div className="prg-map-legend">
          <span className="is-start">Start</span>
          <span className="is-reached">Proven reachable</span>
          <span className="is-unreached">Unreachable</span>
        </div>
      </div>

      <div className="prg-flow-summary">
        <article>
          <span>State space</span>
          <strong>{report.metrics.exploredStates}</strong>
          <p>unique canonical progression states</p>
        </article>
        <article>
          <span>Transitions</span>
          <strong>{report.metrics.exploredTransitions}</strong>
          <p>state-changing player or narrative decisions</p>
        </article>
        <article>
          <span>Maximum depth</span>
          <strong>{report.metrics.maximumDepth}</strong>
          <p>shortest-path decisions explored from the start</p>
        </article>
        <article>
          <span>Terminal states</span>
          <strong>{report.metrics.terminalStateCount}</strong>
          <p>branches with no further canonical progression change</p>
        </article>
      </div>
    </section>
  );
};

const MilestoneCard = ({
  milestone,
}: {
  readonly milestone: AdventureProgressionMilestone;
}) => (
  <article className={`prg-milestone is-${milestone.kind}`}>
    <header>
      <div>
        <span>{milestone.kind}</span>
        <h2>{milestone.label}</h2>
        <code>{milestone.id}</code>
      </div>
      <strong>depth {milestone.depth}</strong>
    </header>
    <Witness steps={milestone.witness.steps} />
  </article>
);

export const MilestonesView = ({
  report,
}: {
  readonly report: AdventureProgressionReport;
}) => (
  <section className="prg-milestones-view">
    <header>
      <div>
        <span className="prg-eyebrow">SHORTEST PROVEN WITNESSES</span>
        <h1>{report.milestones.length} progression milestones</h1>
        <p>
          Each witness is the shortest explored sequence that first reaches a scene,
          item, dialogue, sequence or object state.
        </p>
      </div>
    </header>
    <div className="prg-milestone-list">
      {report.milestones.map((milestone) => (
        <MilestoneCard key={`${milestone.kind}.${milestone.id}`} milestone={milestone} />
      ))}
    </div>
  </section>
);

const FindingCard = ({
  finding,
}: {
  readonly finding: AdventureProgressionFinding;
}) => (
  <article className={`prg-finding is-${finding.severity}`}>
    <div className="prg-finding-rank">
      <span>{finding.severity}</span>
      <strong>{finding.code}</strong>
    </div>
    <section>
      <h3>{finding.message}</h3>
      <code>{finding.path}</code>
      <p>{finding.recommendation}</p>
      {finding.witness ? <Witness steps={finding.witness.steps} /> : null}
    </section>
  </article>
);

const TerminalCard = ({
  terminal,
  sceneName,
}: {
  readonly terminal: AdventureProgressionTerminalState;
  readonly sceneName: string;
}) => (
  <article className="prg-terminal-card">
    <header>
      <div>
        <span>TERMINAL BRANCH</span>
        <h3>{sceneName}</h3>
        <code>{terminal.stateId}</code>
      </div>
      <strong>{terminal.coveragePercent}%</strong>
    </header>
    <dl>
      <div>
        <dt>Depth</dt>
        <dd>{terminal.depth}</dd>
      </div>
      <div>
        <dt>Visited</dt>
        <dd>{terminal.visitedSceneIds.length}</dd>
      </div>
      <div>
        <dt>Held items</dt>
        <dd>{terminal.inventoryItemIds.length}</dd>
      </div>
      <div>
        <dt>Objective</dt>
        <dd>
          {terminal.objectiveCoverage}/{terminal.objectiveTotal}
        </dd>
      </div>
    </dl>
    <Witness steps={terminal.witness.steps} />
  </article>
);

export const RisksView = ({
  project,
  report,
  filter,
  onFilter,
}: {
  readonly project: AdventureProject;
  readonly report: AdventureProgressionReport;
  readonly filter: ProgressionFindingFilter;
  readonly onFilter: (filter: ProgressionFindingFilter) => void;
}) => {
  const findings = report.findings.filter(
    (finding) => filter === "all" || finding.severity === filter,
  );
  const names = sceneNameById(project);
  return (
    <section className="prg-risks-view">
      <header>
        <div>
          <span className="prg-eyebrow">SOFT-LOCK AND COVERAGE REVIEW</span>
          <h1>{report.findings.length} findings</h1>
          <p>
            Required objectives block the report. Optional draft content remains visible
            without pretending every unused branch is a release defect.
          </p>
        </div>
        <div className="prg-filter-row">
          {(["all", "error", "warning", "note"] as const).map((value) => (
            <ProgressionButton
              key={value}
              active={filter === value}
              onClick={() => onFilter(value)}
            >
              {value}
            </ProgressionButton>
          ))}
        </div>
      </header>

      {findings.length > 0 ? (
        <div className="prg-finding-list">
          {findings.map((finding, index) => (
            <FindingCard
              key={`${finding.code}.${finding.path}.${index}`}
              finding={finding}
            />
          ))}
        </div>
      ) : (
        <div className="prg-empty-state">
          <strong>No findings in this filter.</strong>
          <p>The bounded explorer found a recoverable route to every required objective.</p>
        </div>
      )}

      <section className="prg-terminal-section">
        <header>
          <span className="prg-eyebrow">TERMINAL STATE REVIEW</span>
          <h2>
            {report.terminalStates.length} of {report.metrics.terminalStateCount} branches
          </h2>
        </header>
        <div className="prg-terminal-grid">
          {report.terminalStates.map((terminal) => (
            <TerminalCard
              key={terminal.stateId}
              terminal={terminal}
              sceneName={names.get(terminal.currentSceneId) ?? terminal.currentSceneId}
            />
          ))}
        </div>
      </section>
    </section>
  );
};
