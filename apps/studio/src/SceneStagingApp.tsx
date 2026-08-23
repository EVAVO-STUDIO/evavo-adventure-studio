import {
  type AdventureSceneStagingSeverity,
  createAdventureSceneStagingReports,
} from "@evavo/adventure-design/scene-staging";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { SceneDirectorPanel } from "./scene-director-components.js";
import { createSceneDirectorOverlay } from "./scene-director-model.js";
import { sceneDirectorSamples } from "./scene-director-samples.js";
import {
  FindingsPanel,
  HandoffPanel,
  LayerOrderPanel,
  Metric,
  StagingButton,
  type StagingFindingFilter,
  type StagingView,
  StatusPip,
} from "./scene-staging-components.js";
import "./scene-staging.css";
import "./scene-director-samples.css";

const shortId = (value: string): string => value.split(".").at(-1) ?? value;

export const SceneStagingApp = () => {
  const [sampleIndex, setSampleIndex] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [view, setView] = useState<StagingView>("stage");
  const [filter, setFilter] = useState<StagingFindingFilter>("all");
  const sample = sceneDirectorSamples[sampleIndex] ?? sceneDirectorSamples[0]!;
  const reports = useMemo(
    () =>
      createAdventureSceneStagingReports(
        sample.project,
        sample.sceneInstances,
        undefined,
        sample.staging,
      ),
    [sample],
  );
  const report = reports[sceneIndex] ?? reports[0]!;
  const directorOverlay = useMemo(
    () =>
      createSceneDirectorOverlay(
        sample.project,
        sample.sceneInstances,
        sample.staging,
        report.sceneId,
        sample.paletteMaps,
      ),
    [sample, report.sceneId],
  );

  useEffect(() => {
    setSceneIndex(0);
    setFilter("all");
  }, [sampleIndex]);

  useEffect(() => {
    setFilter("all");
  }, [sceneIndex]);

  const count = (severity: AdventureSceneStagingSeverity): number =>
    report.findings.filter((finding) => finding.severity === severity).length;
  const boundLights = directorOverlay.lightZones.filter(
    (entry) => entry.bindingStatus === "bound",
  ).length;

  return (
    <main className="stg-app">
      <header className="stg-topbar">
        <div className="stg-brand">
          <span className="stg-brand-mark">S</span>
          <div>
            <span>EVAVO ADVENTURE STUDIO</span>
            <strong>Scene Director</strong>
          </div>
        </div>
        <div className="stg-selector-group">
          <label className="stg-scene-picker">
            <span>Production proof</span>
            <select
              value={sampleIndex}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setSampleIndex(Number(event.currentTarget.value))
              }
            >
              {sceneDirectorSamples.map((candidate, index) => (
                <option key={candidate.id} value={index}>
                  {candidate.label}
                </option>
              ))}
            </select>
          </label>
          <label className="stg-scene-picker">
            <span>Directed scene</span>
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
          <span className="stg-sample-language">{sample.productionLanguage}</span>
        </div>
        <div className={`stg-ready-state is-${report.status}`}>
          <StatusPip status={report.status} />
          <span>{report.status}</span>
        </div>
      </header>

      <nav className="stg-toolbar" aria-label="Scene Director workspaces">
        <div>
          <StagingButton active={view === "stage"} onClick={() => setView("stage")}>
            Scene Director
          </StagingButton>
          <StagingButton active={view === "findings"} onClick={() => setView("findings")}>
            Findings
          </StagingButton>
          <StagingButton active={view === "layers"} onClick={() => setView("layers")}>
            Layer order
          </StagingButton>
          <StagingButton active={view === "handoff"} onClick={() => setView("handoff")}>
            Handoff
          </StagingButton>
        </div>
        <p>One 320 × 200 stage · art + control + perspective + interaction</p>
      </nav>

      <div className="stg-workspace">
        <aside className="stg-rail">
          <section>
            <span className="stg-eyebrow">{sample.productionLanguage}</span>
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
            <Metric
              label="Approaches"
              value={directorOverlay.objects.reduce(
                (sum, object) => sum + object.approachSlots.length,
                0,
              )}
            />
            <Metric label="Surfaces" value={directorOverlay.staging?.surfaceZones.length ?? 0} />
            <Metric label="Occlusion" value={directorOverlay.staging?.occlusionPlanes.length ?? 0} />
            <Metric label="Light zones" value={directorOverlay.lightZones.length} />
            <Metric label="Light bindings" value={`${boundLights}/${directorOverlay.lightZones.length}`} />
          </dl>
          <section className="stg-score">
            <span className="stg-eyebrow">STAGING READINESS</span>
            <div>
              <strong>{report.score}</strong>
              <span>/100</span>
            </div>
          </section>
          <section className="stg-severity-summary">
            <div className="is-error">
              <span>Errors</span>
              <strong>{count("error")}</strong>
            </div>
            <div className="is-warning">
              <span>Warnings</span>
              <strong>{count("warning")}</strong>
            </div>
            <div className="is-note">
              <span>Notes</span>
              <strong>{count("note")}</strong>
            </div>
          </section>
        </aside>

        <section className="stg-canvas">
          {view === "stage" ? <SceneDirectorPanel overlay={directorOverlay} report={report} /> : null}
          {view === "findings" ? (
            <FindingsPanel report={report} filter={filter} onFilter={setFilter} />
          ) : null}
          {view === "layers" ? <LayerOrderPanel report={report} /> : null}
          {view === "handoff" ? <HandoffPanel report={report} /> : null}
        </section>

        <aside className="stg-inspector">
          <section>
            <span className="stg-eyebrow">SCENE CONTRACT</span>
            <h2>One coordinate truth</h2>
            <p>
              Art, feet, walk geometry, depth, occlusion, click targets, approach positions, surfaces and entry
              paths all resolve against the same native scene rather than separate editor approximations.
            </p>
          </section>
          <section>
            <span className="stg-eyebrow">PRODUCTION LANGUAGE</span>
            <h2>{sample.label}</h2>
            <p>
              Switch production proofs without changing the Director model. The overlays should expose
              materially different room grammar while preserving the same deterministic engine contract.
            </p>
          </section>
          <section>
            <span className="stg-eyebrow">DIRECTOR DISCIPLINE</span>
            <h2>What the overlays protect</h2>
            <ul>
              <li>Characters cross painted perspective without looking pasted onto the room.</li>
              <li>Visible bodies retain clearance even though classic routing remains foot-point based.</li>
              <li>Props use deliberate standing positions, facing and forgiving invisible click regions.</li>
              <li>Foreground planes can hide and reveal actors using authored baseline priority.</li>
              <li>Entrances, surfaces and indexed palette-light regions remain deterministic through play.</li>
            </ul>
          </section>
          <section className="stg-next-action">
            <span className="stg-eyebrow">NEXT ACTION</span>
            <h2>{report.findings[0]?.message ?? "Play the room at 1× native size"}</h2>
            <p>
              {report.findings[0]?.recommendation ??
                "Switch through every Scene Director overlay, then run the room from every entrance and " +
                  "verify the final pixels, movement, occlusion and interactions agree."}
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
