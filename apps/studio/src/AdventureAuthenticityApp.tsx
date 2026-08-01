import {
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  createAdventureSceneProductionBriefs,
  evaluateAdventureAuthenticity,
  type AdventureAuthenticityDimensionResult,
  type AdventureAuthenticityFinding,
  type AdventureAuthenticitySeverity,
  type AdventureDesignDocument,
  type AdventureSceneProductionBrief,
} from "@evavo/adventure-design";
import { showcaseAdventureDesigns } from "@evavo/adventure-design/showcases";
import "./adventure-authenticity.css";

type LabView = "scorecard" | "findings" | "scenes";
type FindingFilter = "all" | AdventureAuthenticitySeverity;

const labelForGrade = (grade: string): string =>
  grade
    .split("-")
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");

const shortId = (value: string): string => value.split(".").at(-1) ?? value;

const Button = ({
  children,
  onClick,
  active = false,
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly active?: boolean;
}) => (
  <button
    type="button"
    className={`auth-button${active ? " is-active" : ""}`}
    onClick={onClick}
  >
    {children}
  </button>
);

const StatusPip = ({ status }: { readonly status: string }) => (
  <span className={`auth-status-pip is-${status}`} aria-hidden="true" />
);

const NativeStudy = ({ document }: { readonly document: AdventureDesignDocument }) => {
  const anchors = document.creativeDirection.palette.keyColours;
  const colour = (index: number, fallback: string): string =>
    anchors[index % Math.max(anchors.length, 1)] ?? fallback;
  return (
    <figure className="auth-native-study">
      <svg viewBox="0 0 320 200" role="img" aria-label={`${document.title} native composition study`}>
        <rect width="320" height="200" fill={colour(0, "#080912")} />
        <path d="M0 0H320V112L0 130Z" fill={colour(1, "#17233a")} />
        <path d="M0 130L320 112V200H0Z" fill={colour(2, "#57413c")} />
        <path d="M17 122L74 42L136 121Z" fill={colour(3, "#8f6653")} opacity="0.78" />
        <path d="M168 117L231 31L309 110Z" fill={colour(4, "#5f7f7b")} opacity="0.75" />
        <rect x="220" y="55" width="45" height="80" fill={colour(0, "#080912")} />
        <rect x="226" y="62" width="33" height="66" fill={colour(5, "#be526d")} opacity="0.62" />
        <path d="M70 166L76 127L84 115L94 129L99 166Z" fill={colour(5, "#f05b70")} />
        <circle cx="85" cy="109" r="8" fill={colour(6, "#d8b58e")} />
        <path d="M79 106L84 92L92 107Z" fill={colour(0, "#080912")} />
        <path d="M0 176Q73 160 148 177T320 170V200H0Z" fill={colour(0, "#080912")} opacity="0.67" />
        <rect x="17" y="178" width="119" height="2" fill={colour(5, "#ff244e")} />
        <circle cx="285" cy="33" r="14" fill={colour(6, "#f5d57a")} opacity="0.24" />
      </svg>
      <figcaption>
        <strong>
          {document.creativeDirection.nativeSize.width} ×{
            " "
          }
          {document.creativeDirection.nativeSize.height}
        </strong>
        <span>native composition study</span>
      </figcaption>
    </figure>
  );
};

const DimensionCard = ({ dimension }: { readonly dimension: AdventureAuthenticityDimensionResult }) => (
  <article className={`auth-dimension-card is-${dimension.status}`}>
    <header>
      <div>
        <StatusPip status={dimension.status} />
        <h3>{dimension.label}</h3>
      </div>
      <strong>{dimension.score}/10</strong>
    </header>
    <div className="auth-meter" aria-label={`${dimension.label}: ${dimension.score} out of 10`}>
      <span style={{ width: `${dimension.score * 10}%` }} />
    </div>
    <p>
      {dimension.findings.length === 0
        ? "Authored evidence satisfies the current production gate."
        : `${dimension.findings.length} production ${
            dimension.findings.length === 1 ? "finding" : "findings"
          }.`}
    </p>
  </article>
);

const FindingCard = ({ finding }: { readonly finding: AdventureAuthenticityFinding }) => (
  <article className={`auth-finding is-${finding.severity}`}>
    <div className="auth-finding-severity">{finding.severity}</div>
    <div>
      <span>{finding.dimension}</span>
      <h3>{finding.message}</h3>
      <code>{finding.path}</code>
      <p>{finding.recommendation}</p>
    </div>
  </article>
);

const SceneBriefCard = ({ brief }: { readonly brief: AdventureSceneProductionBrief }) => (
  <article className="auth-scene-card">
    <header>
      <div>
        <span className="auth-eyebrow">NATIVE SCENE BRIEF</span>
        <h2>{brief.name}</h2>
        <code>{brief.sceneId ?? brief.locationId}</code>
      </div>
      <div className="auth-scene-spec">
        <strong>{brief.nativeSize.width} × {brief.nativeSize.height}</strong>
        <span>{brief.paletteBudget} colours</span>
      </div>
    </header>
    <p className="auth-scene-promise">{brief.visualPromise}</p>
    <div className="auth-scene-grid">
      <section>
        <h3>Interaction lane</h3>
        <p>{brief.interactionLane}</p>
      </section>
      <section>
        <h3>Actor read</h3>
        <p>{brief.actorReadability}</p>
      </section>
      <section>
        <h3>Animation</h3>
        <p>{brief.animationDirection}</p>
      </section>
      <section>
        <h3>Audio</h3>
        <p>{brief.audioDirection}</p>
      </section>
    </div>
    <div className="auth-scene-lists">
      <section>
        <h3>Focal hierarchy</h3>
        <ol>{brief.focalHierarchy.map((item) => <li key={item}>{item}</li>)}</ol>
      </section>
      <section>
        <h3>Layer plan</h3>
        <ol>{brief.layerPlan.map((item) => <li key={item}>{item}</li>)}</ol>
      </section>
    </div>
    <details>
      <summary>Native-size review questions</summary>
      <ul>{brief.reviewQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
    </details>
  </article>
);

const severityCounts = (findings: readonly AdventureAuthenticityFinding[]) => ({
  error: findings.filter((finding) => finding.severity === "error").length,
  warning: findings.filter((finding) => finding.severity === "warning").length,
  note: findings.filter((finding) => finding.severity === "note").length,
});

export const AdventureAuthenticityApp = () => {
  const [documentIndex, setDocumentIndex] = useState(0);
  const [view, setView] = useState<LabView>("scorecard");
  const [filter, setFilter] = useState<FindingFilter>("all");
  const document = showcaseAdventureDesigns[documentIndex] ?? showcaseAdventureDesigns[0]!;
  const report = useMemo(() => evaluateAdventureAuthenticity(document), [document]);
  const briefs = useMemo(() => createAdventureSceneProductionBriefs(document), [document]);
  const counts = severityCounts(report.findings);
  const visibleFindings = report.findings.filter(
    (finding) => filter === "all" || finding.severity === filter,
  );

  return (
    <main className="auth-app">
      <header className="auth-topbar">
        <div className="auth-brand">
          <span className="auth-brand-mark">A</span>
          <div>
            <span>EVAVO ADVENTURE STUDIO</span>
            <strong>Authenticity Lab</strong>
          </div>
        </div>
        <label className="auth-project-picker">
          <span>Production example</span>
          <select
            value={documentIndex}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setDocumentIndex(Number(event.currentTarget.value))
            }
          >
            {showcaseAdventureDesigns.map((candidate, index) => (
              <option key={candidate.projectId} value={index}>{candidate.title}</option>
            ))}
          </select>
        </label>
        <div className={`auth-ready-state is-${report.status}`}>
          <StatusPip status={report.status} />
          <span>{report.status}</span>
        </div>
      </header>

      <nav className="auth-toolbar" aria-label="Authenticity Lab views">
        <div>
          <Button active={view === "scorecard"} onClick={() => setView("scorecard")}>Scorecard</Button>
          <Button active={view === "findings"} onClick={() => setView("findings")}>Findings</Button>
          <Button active={view === "scenes"} onClick={() => setView("scenes")}>Scene briefs</Button>
        </div>
        <p>Evidence-led production review · not a substitute for final art or playtesting</p>
      </nav>

      <div className="auth-workspace">
        <aside className="auth-rail">
          <NativeStudy document={document} />
          <section className="auth-identity">
            <span className="auth-eyebrow">PRODUCTION IDENTITY</span>
            <h1>{document.title}</h1>
            <p>{document.playerPromise}</p>
            <dl>
              <div><dt>Mode</dt><dd>{document.creativeDirection.productionMode}</dd></div>
              <div><dt>Composition</dt><dd>{document.creativeDirection.compositionMode}</dd></div>
              <div><dt>Palette</dt><dd>{document.creativeDirection.palette.maxColours}</dd></div>
              <div><dt>Locations</dt><dd>{document.map.locations.length}</dd></div>
            </dl>
          </section>
          <section className="auth-palette">
            <span className="auth-eyebrow">ANCHOR PALETTE</span>
            <div>
              {document.creativeDirection.palette.keyColours.map((colour) => (
                <span key={colour} style={{ background: colour }} title={colour} />
              ))}
            </div>
          </section>
        </aside>

        <section className="auth-canvas">
          {view === "scorecard" ? (
            <>
              <section className="auth-score-hero">
                <div
                  className={`auth-score-ring is-${report.status}`}
                  style={{ "--score": report.score } as CSSProperties}
                >
                  <strong>{report.score}</strong>
                  <span>/ 100</span>
                </div>
                <div>
                  <span className="auth-eyebrow">AUTHENTIC PRODUCTION READINESS</span>
                  <h1>{labelForGrade(report.grade)}</h1>
                  <p>
                    Ten deterministic disciplines review the authored evidence behind native VGA composition,
                    palette control, game readability, puzzle fairness and cinematic continuity.
                  </p>
                </div>
                <dl className="auth-score-counts">
                  <div><dt>Errors</dt><dd>{counts.error}</dd></div>
                  <div><dt>Warnings</dt><dd>{counts.warning}</dd></div>
                  <div><dt>Notes</dt><dd>{counts.note}</dd></div>
                </dl>
              </section>
              <section className="auth-dimension-grid">
                {report.dimensions.map((dimension) => (
                  <DimensionCard key={dimension.id} dimension={dimension} />
                ))}
              </section>
              <section className="auth-doctrine-strip">
                <article><span>Silhouette</span><p>{document.creativeDirection.actorSilhouette}</p></article>
                <article>
                  <span>Interface</span>
                  <p>{document.creativeDirection.interfaceTreatment}</p>
                </article>
                <article><span>Animation</span><p>{document.creativeDirection.animationCadence}</p></article>
              </section>
            </>
          ) : null}

          {view === "findings" ? (
            <section className="auth-findings-view">
              <header>
                <div>
                  <span className="auth-eyebrow">CORRECTIVE PRODUCTION QUEUE</span>
                  <h1>
                    {report.findings.length === 0
                      ? "No findings"
                      : `${report.findings.length} findings`}
                  </h1>
                </div>
                <div className="auth-filter-row">
                  {(["all", "error", "warning", "note"] as const).map((value) => (
                    <Button key={value} active={filter === value} onClick={() => setFilter(value)}>
                      {value}
                    </Button>
                  ))}
                </div>
              </header>
              {visibleFindings.length > 0 ? (
                <div className="auth-finding-list">
                  {visibleFindings.map((finding) => <FindingCard key={finding.id} finding={finding} />)}
                </div>
              ) : (
                <div className="auth-empty-state">
                  <strong>Current authored evidence satisfies this filter.</strong>
                  <p>
                    Continue with native-size visual review, interaction testing and final
                    asset evidence.
                  </p>
                </div>
              )}
            </section>
          ) : null}

          {view === "scenes" ? (
            <section className="auth-scenes-view">
              <header>
                <span className="auth-eyebrow">SCENE PRODUCTION PACK</span>
                <h1>{briefs.length} native scene briefs</h1>
                <p>
                  Each brief translates the project bible into focal hierarchy, layer
                  structure, actor readability, animation, interface and audio direction
                  for one location.
                </p>
              </header>
              <div className="auth-scene-list">
                {briefs.map((brief) => <SceneBriefCard key={brief.locationId} brief={brief} />)}
              </div>
            </section>
          ) : null}
        </section>

        <aside className="auth-inspector">
          <section>
            <span className="auth-eyebrow">PRODUCTION RULES</span>
            <h2>Must remain true</h2>
            <ul>{document.creativeDirection.authenticityRules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
          </section>
          <section>
            <span className="auth-eyebrow">PROHIBITED SHORTCUTS</span>
            <h2>Reject in review</h2>
            <ul>
              {document.creativeDirection.prohibitedShortcuts.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>
          <section className="auth-next-action">
            <span className="auth-eyebrow">NEXT ACTION</span>
            <h2>
              {report.findings[0]?.message ?? "Review at 1× native size"}
            </h2>
            <p>
              {report.findings[0]?.recommendation ??
                "Confirm actor, obstacle, prop and exit remain readable without hotspot assistance."}
            </p>
          </section>
          <footer>
            <span>Report v{report.reportVersion}</span>
            <code>{shortId(String(document.projectId))}</code>
          </footer>
        </aside>
      </div>
    </main>
  );
};
