import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import {
  createAdventureSceneStagingReports,
  type AdventureSceneStagingSeverity,
} from "@evavo/adventure-design/scene-staging";
import { studioProject, studioSceneInstances } from "./fixture.js";
import {
  FindingsPanel,
  HandoffPanel,
  LayerOrderPanel,
  Metric,
  StageOverlay,
  StagingButton,
  StatusPip,
  type StagingFindingFilter,
  type StagingView,
} from "./scene-staging-components.js";
import "./scene-staging.css";

const shortId = (value: string): string => value.split(".").at(-1) ?? value;

export const SceneStagingApp = () => {
  const reports = useMemo(
    () => createAdventureSceneStagingReports(studioProject, studioSceneInstances),
    [],
  );
  const [sceneIndex, setSceneIndex] = useState(0);
  const [view, setView] = useState<StagingView>("stage");
  const [filter, setFilter] = useState<StagingFindingFilter>("all");
  const report = reports[sceneIndex] ?? reports[0]!;

  useEffect(() => {
    setFilter("all");
  }, [sceneIndex]);

  const count = (severity: AdventureSceneStagingSeverity): number =>
    report.findings.filter((finding) => finding.severity === severity).length;

  return (
    <main className="stg-app">
      <header className="stg-topbar">
        <div className="stg-brand">
          <span className="stg-brand-mark">S</span>
          <div>
            <span>EVAVO ADVENTURE STUDIO</span>
            <strong>Native Staging Lab</strong>
          </div>
        </div>
        <label className="stg-scene-picker">
          <span>Scene composition</span>
          <select
            value={sceneIndex}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setSceneIndex(Number(event.currentTarget.value))
            }
          >
            {reports.map((candidate, index) => (
              <option key={candidate.sceneId} value={index}>
                {candidate.sceneName}
              </option>
            ))}
          </select>
        </label>
        <div className={`stg-ready-state is-${report.status}`}>
          <StatusPip status={report.status} />
          <span>{report.status}</span>
        </div>
      </header>

      <nav className="stg-toolbar" aria-label="Native Staging Lab views">
        <div>
          <StagingButton active={view === "stage"} onClick={() => setView("stage")}>
            Initial stage
          </StagingButton>
          <StagingButton
            active={view === "findings"}
            onClick={() => setView("findings")}
          >
            Findings
          </StagingButton>
          <StagingButton active={view === "layers"} onClick={() => setView("layers")}>
            Layer order
          </StagingButton>
          <StagingButton active={view === "handoff"} onClick={() => setView("handoff")}>
            Handoff
          </StagingButton>
        </div>
        <p>Scene instances · actor control · stateful props · portal handoffs</p>
      </nav>

      <div className="stg-workspace">
        <aside className="stg-rail">
          <section>
            <span className="stg-eyebrow">INITIAL PLAYABLE STAGE</span>
            <h1>{report.sceneName}</h1>
            <code>{report.sceneId}</code>
          </section>
          <dl className="stg-metrics">
            <Metric
              label="Canvas"
              value={`${report.overlay.nativeSize.width} × ${report.overlay.nativeSize.height}`}
            />
            <Metric label="Actors" value={report.metrics.actorCount} />
            <Metric label="Walkable" value={report.metrics.walkableActorCount} />
            <Metric label="Props" value={report.metrics.objectCount} />
            <Metric label="Interactive" value={report.metrics.interactiveObjectCount} />
            <Metric label="Portals" value={report.metrics.portalCount} />
            <Metric label="Layers" value={report.metrics.occupiedLayerCount} />
          </dl>
          <section className="stg-score">
            <span className="stg-eyebrow">STAGING READINESS</span>
            <div>
              <strong>{report.score}</strong>
              <span>/100</span>
            </div>
          </section>
          <section className="stg-severity-summary">
            <div className="is-error"><span>Errors</span><strong>{count("error")}</strong></div>
            <div className="is-warning"><span>Warnings</span><strong>{count("warning")}</strong></div>
            <div className="is-note"><span>Notes</span><strong>{count("note")}</strong></div>
          </section>
        </aside>

        <section className="stg-canvas">
          {view === "stage" ? <StageOverlay report={report} /> : null}
          {view === "findings" ? (
            <FindingsPanel report={report} filter={filter} onFilter={setFilter} />
          ) : null}
          {view === "layers" ? <LayerOrderPanel report={report} /> : null}
          {view === "handoff" ? <HandoffPanel report={report} /> : null}
        </section>

        <aside className="stg-inspector">
          <section>
            <span className="stg-eyebrow">CONTROL CONTRACT</span>
            <h2>
              {report.metrics.walkableActorCount === 1
                ? "One unambiguous player candidate"
                : `${report.metrics.walkableActorCount} walkable candidates`}
            </h2>
            <p>
              Packaged gameplay selects one implicit actor only when the start scene has
              exactly one walkable instance. Ambiguity produces a view-only runtime unless
              launch configuration requests an actor explicitly.
            </p>
          </section>
          <section>
            <span className="stg-eyebrow">STAGE DISCIPLINE</span>
            <h2>What this review protects</h2>
            <ul>
              <li>Actors begin on readable, reachable native foot positions.</li>
              <li>Stateful props expose visible targets and reachable approach points.</li>
              <li>Portals explain large geometric handoffs through authored traversal.</li>
              <li>Foreground and ambient layers frame rather than steal interaction.</li>
              <li>Stable ordering is intentional where silhouettes overlap.</li>
            </ul>
          </section>
          <section className="stg-next-action">
            <span className="stg-eyebrow">NEXT ACTION</span>
            <h2>{report.findings[0]?.message ?? "Review final actors and props at 1×"}</h2>
            <p>
              {report.findings[0]?.recommendation ??
                "Load the compiled actor atlases and object-state pixels over this " +
                  "exact staging contract, then play every arrival and interaction."}
            </p>
          </section>
          <footer>
            <span>Report v{report.reportVersion}</span>
            <code>{shortId(report.projectId)}</code>
          </footer>
        </aside>
      </div>
    </main>
  );
};
