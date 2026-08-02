import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import {
  createAdventureSceneReadabilityReports,
  type AdventureSceneReadabilitySeverity,
} from "@evavo/adventure-design/scene-readability";
import {
  showcaseAdventureDesigns,
  showcaseProjectShells,
} from "@evavo/adventure-design/showcases";
import { Button, Metric, StatusPip } from "./scene-readability-components.js";
import {
  FindingsView,
  HandoffView,
  OverlayView,
  type SceneReadabilityFindingFilter,
  type SceneReadabilityView,
} from "./scene-readability-views.js";
import "./scene-readability.css";

const shortId = (value: string): string => value.split(".").at(-1) ?? value;

export const SceneReadabilityApp = () => {
  const [projectIndex, setProjectIndex] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [view, setView] = useState<SceneReadabilityView>("overlay");
  const [filter, setFilter] = useState<SceneReadabilityFindingFilter>("all");
  const project = showcaseProjectShells[projectIndex] ?? showcaseProjectShells[0]!;
  const design = showcaseAdventureDesigns[projectIndex] ?? showcaseAdventureDesigns[0]!;
  const reports = useMemo(
    () => createAdventureSceneReadabilityReports(project, design),
    [project, design],
  );
  const report = reports[sceneIndex] ?? reports[0]!;

  useEffect(() => {
    setSceneIndex(0);
    setFilter("all");
  }, [projectIndex]);

  const severityCount = (severity: AdventureSceneReadabilitySeverity): number =>
    report.findings.filter((finding) => finding.severity === severity).length;

  return (
    <main className="cmp-app">
      <header className="cmp-topbar">
        <div className="cmp-brand">
          <span className="cmp-brand-mark">C</span>
          <div>
            <span>EVAVO ADVENTURE STUDIO</span>
            <strong>Native Composition Lab</strong>
          </div>
        </div>
        <div className="cmp-pickers">
          <label>
            <span>Production example</span>
            <select
              value={projectIndex}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setProjectIndex(Number(event.currentTarget.value))
              }
            >
              {showcaseProjectShells.map((candidate, index) => (
                <option key={candidate.id} value={index}>
                  {candidate.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Scene</span>
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
        </div>
        <div className={`cmp-ready-state is-${report.status}`}>
          <StatusPip status={report.status} />
          <span>{report.status}</span>
        </div>
      </header>

      <nav className="cmp-toolbar" aria-label="Native Composition Lab views">
        <div>
          <Button active={view === "overlay"} onClick={() => setView("overlay")}>
            Native overlay
          </Button>
          <Button active={view === "findings"} onClick={() => setView("findings")}>
            Findings
          </Button>
          <Button active={view === "handoff"} onClick={() => setView("handoff")}>
            Handoff
          </Button>
        </div>
        <p>Canonical project geometry · deterministic 1× production review</p>
      </nav>

      <div className="cmp-workspace">
        <aside className="cmp-rail">
          <section>
            <span className="cmp-eyebrow">SCENE CONTRACT</span>
            <h1>{report.sceneName}</h1>
            <code>{report.sceneId}</code>
          </section>
          <dl className="cmp-metric-list">
            <Metric
              label="Canvas"
              value={`${report.overlay.nativeSize.width} × ${report.overlay.nativeSize.height}`}
            />
            <Metric label="Walk areas" value={report.metrics.navigationAreaCount} />
            <Metric label="Depth bands" value={report.metrics.depthBandCount} />
            <Metric label="Entrances" value={report.metrics.entranceCount} />
            <Metric label="Hotspots" value={report.metrics.hotspotCount} />
            <Metric label="Occluders" value={report.metrics.occluderCount} />
          </dl>
          <section className="cmp-rail-score">
            <span className="cmp-eyebrow">READINESS</span>
            <strong>{report.score}</strong>
            <span>/100</span>
          </section>
          <section className="cmp-severity-summary">
            <div className="is-error">
              <span>Errors</span>
              <strong>{severityCount("error")}</strong>
            </div>
            <div className="is-warning">
              <span>Warnings</span>
              <strong>{severityCount("warning")}</strong>
            </div>
            <div className="is-note">
              <span>Notes</span>
              <strong>{severityCount("note")}</strong>
            </div>
          </section>
        </aside>

        <section className="cmp-canvas">
          {view === "overlay" ? <OverlayView report={report} /> : null}
          {view === "findings" ? (
            <FindingsView report={report} filter={filter} onFilter={setFilter} />
          ) : null}
          {view === "handoff" ? <HandoffView report={report} /> : null}
        </section>

        <aside className="cmp-inspector">
          <section>
            <span className="cmp-eyebrow">FIRST READ</span>
            <h2>{report.designLink?.locationName ?? "Unlinked scene"}</h2>
            <p>
              {report.designLink?.arrivalBeat ??
                "Link this canonical scene to an Adventure Design location before " +
                "final art and level review."}
            </p>
          </section>
          <section>
            <span className="cmp-eyebrow">OVERLAY DISCIPLINE</span>
            <h2>What each layer proves</h2>
            <ul>
              <li>Walk polygons prove the player has a deliberate stage.</li>
              <li>Depth lines prove actor scale across reachable foot positions.</li>
              <li>Hotspots prove target density and approach points.</li>
              <li>Entrances prove controlled arrival and immediate readability.</li>
              <li>Occluders prove foreground continuity before final masks ship.</li>
            </ul>
          </section>
          <section className="cmp-next-action">
            <span className="cmp-eyebrow">NEXT ACTION</span>
            <h2>
              {report.findings[0]?.message ?? "Review final pixels over this geometry"}
            </h2>
            <p>
              {report.findings[0]?.recommendation ??
                "Load the finished background, actor and interface in the Player and " +
                "inspect the scene at 1× native scale."}
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
