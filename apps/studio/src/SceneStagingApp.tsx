import {
  type AdventureSceneStagingSeverity,
  createAdventureSceneStagingReports,
} from "@evavo/adventure-design/scene-staging";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { SceneDirectorCanonicalGeometryPanel } from "./scene-director-canonical-editor.js";
import { auditSceneDirectorClearance } from "./scene-director-clearance.js";
import { SceneDirectorPanel } from "./scene-director-components.js";
import {
  applySceneDirectorDocumentEdit,
  commitSceneDirectorDocumentEdit,
  createSceneDirectorDocumentHistory,
  redoSceneDirectorDocumentEdit,
  type SceneDirectorDocumentCommand,
  type SceneDirectorDocuments,
  SceneDirectorDocumentEditError,
  undoSceneDirectorDocumentEdit,
} from "./scene-director-documents.js";
import { downloadSceneDirectorDocuments } from "./scene-director-export.js";
import { SceneDirectorHotspotStateControls } from "./scene-director-hotspot-controls.js";
import { createSceneDirectorOverlay } from "./scene-director-model.js";
import {
  sceneDirectorPaletteBankAtOffset,
  sceneDirectorPaletteSpecByAssetId,
} from "./scene-director-palette-specs.js";
import { sceneDirectorSamples } from "./scene-director-samples.js";
import { NightShiftReadinessPanel } from "./night-shift-readiness-panel.js";
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

const documentsForSample = (
  sample: (typeof sceneDirectorSamples)[number],
): SceneDirectorDocuments => ({
  project: sample.project,
  sceneInstances: sample.sceneInstances,
  staging: sample.staging,
});

export const SceneStagingApp = () => {
  const [sampleIndex, setSampleIndex] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [view, setView] = useState<StagingView>("stage");
  const [filter, setFilter] = useState<StagingFindingFilter>("all");
  const sample = sceneDirectorSamples[sampleIndex] ?? sceneDirectorSamples[0]!;
  const [editHistory, setEditHistory] = useState(() =>
    createSceneDirectorDocumentHistory(documentsForSample(sceneDirectorSamples[0]!)),
  );
  const [previewDocuments, setPreviewDocuments] = useState<SceneDirectorDocuments | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const activeDocuments = previewDocuments ?? editHistory.present;

  const reports = useMemo(
    () =>
      createAdventureSceneStagingReports(
        activeDocuments.project,
        activeDocuments.sceneInstances,
        undefined,
        activeDocuments.staging,
      ),
    [activeDocuments],
  );
  const report = reports[sceneIndex] ?? reports[0]!;
  const directorOverlay = useMemo(
    () =>
      createSceneDirectorOverlay(
        activeDocuments.project,
        activeDocuments.sceneInstances,
        activeDocuments.staging,
        report.sceneId,
        sample.paletteMaps,
      ),
    [activeDocuments, report.sceneId, sample.paletteMaps],
  );
  const clearanceIssues = useMemo(
    () => auditSceneDirectorClearance(activeDocuments, report.sceneId),
    [activeDocuments, report.sceneId],
  );

  useEffect(() => {
    setSceneIndex(0);
    setFilter("all");
    setEditHistory(createSceneDirectorDocumentHistory(documentsForSample(sample)));
    setPreviewDocuments(null);
    setEditError(null);
  }, [sample]);

  useEffect(() => {
    setFilter("all");
    setPreviewDocuments(null);
    setEditError(null);
  }, [sceneIndex]);

  const previewEdit = (command: SceneDirectorDocumentCommand): void => {
    try {
      setPreviewDocuments(applySceneDirectorDocumentEdit(editHistory.present, command));
      setEditError(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : String(error));
    }
  };

  const commitEdit = (command: SceneDirectorDocumentCommand): void => {
    try {
      setEditHistory((history) => commitSceneDirectorDocumentEdit(history, command));
      setPreviewDocuments(null);
      setEditError(null);
    } catch (error) {
      setPreviewDocuments(null);
      setEditError(
        error instanceof SceneDirectorDocumentEditError || error instanceof Error
          ? error.message
          : String(error),
      );
    }
  };

  const cancelPreview = (): void => {
    setPreviewDocuments(null);
    setEditError(null);
  };

  const undoEdit = (): void => {
    setEditHistory((history) => undoSceneDirectorDocumentEdit(history));
    setPreviewDocuments(null);
    setEditError(null);
  };

  const redoEdit = (): void => {
    setEditHistory((history) => redoSceneDirectorDocumentEdit(history));
    setPreviewDocuments(null);
    setEditError(null);
  };

  const resetEdits = (): void => {
    setEditHistory(createSceneDirectorDocumentHistory(documentsForSample(sample)));
    setPreviewDocuments(null);
    setEditError(null);
  };

  const exportDocuments = (): void => {
    downloadSceneDirectorDocuments(editHistory.present, sample.id);
  };

  const count = (severity: AdventureSceneStagingSeverity): number =>
    report.findings.filter((finding) => finding.severity === severity).length;
  const boundLights = directorOverlay.lightZones.filter(
    (entry) => entry.bindingStatus === "bound",
  ).length;
  const editing = {
    onPreviewEdit: previewEdit,
    onCommitEdit: commitEdit,
    onCancelPreview: cancelPreview,
    onUndo: undoEdit,
    onRedo: redoEdit,
    canUndo: editHistory.past.length > 0,
    canRedo: editHistory.future.length > 0,
    error: editError,
  };

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
          <StagingButton disabled={editHistory.past.length === 0} onClick={resetEdits}>
            Reset edits
          </StagingButton>
          <StagingButton onClick={exportDocuments}>Export documents</StagingButton>
        </div>
        <p>One 320 × 200 stage · project + composition + staging in one edit history</p>
      </nav>

      <div className="stg-workspace">
        <aside className="stg-rail">
          <section>
            <span className="stg-eyebrow">{sample.productionLanguage}</span>
            <h1>{report.sceneName}</h1>
            <code>{report.sceneId}</code>
          </section>
          <dl className="stg-metrics">
            <Metric label="Canvas" value={`${report.overlay.nativeSize.width} × ${report.overlay.nativeSize.height}`} />
            <Metric label="Actors" value={report.metrics.actorCount} />
            <Metric label="Walkable" value={report.metrics.walkableActorCount} />
            <Metric label="Props" value={report.metrics.objectCount} />
            <Metric label="Interactive" value={report.metrics.interactiveObjectCount} />
            <Metric label="Portals" value={report.metrics.portalCount} />
            <Metric
              label="Approaches"
              value={directorOverlay.objects.reduce((sum, object) => sum + object.approachSlots.length, 0)}
            />
            <Metric label="Clearance risks" value={clearanceIssues.length} />
            <Metric label="Surfaces" value={directorOverlay.staging?.surfaceZones.length ?? 0} />
            <Metric label="Occlusion" value={directorOverlay.staging?.occlusionPlanes.length ?? 0} />
            <Metric label="Light zones" value={directorOverlay.lightZones.length} />
            <Metric label="Light bindings" value={`${boundLights}/${directorOverlay.lightZones.length}`} />
            <Metric label="Edited documents" value={editHistory.past.length > 0 ? "3 linked" : "canonical"} />
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
          {view === "stage" ? (
            <>
              <SceneDirectorPanel overlay={directorOverlay} report={report} editing={editing} />
              <SceneDirectorCanonicalGeometryPanel
                documents={activeDocuments}
                sceneId={report.sceneId}
                editing={editing}
              />
              <SceneDirectorHotspotStateControls
                documents={activeDocuments}
                sceneId={report.sceneId}
                editing={editing}
              />
            </>
          ) : null}
          {view === "findings" ? <FindingsPanel report={report} filter={filter} onFilter={setFilter} /> : null}
          {view === "layers" ? <LayerOrderPanel report={report} /> : null}
          {view === "handoff" ? <HandoffPanel report={report} /> : null}
        </section>

        <aside className="stg-inspector">
          <section>
            <span className="stg-eyebrow">SCENE CONTRACT</span>
            <h2>One coordinate truth</h2>
            <p>
              Project navigation, placed composition, staging geometry and the final native stage now share one
              Director edit history instead of drifting through separate editor approximations.
            </p>
          </section>
          <section>
            <span className="stg-eyebrow">PRODUCTION LANGUAGE</span>
            <h2>{sample.label}</h2>
            <p>
              Switch production proofs without changing the Director model. The overlays expose materially
              different room grammar while preserving the same deterministic engine contract.
            </p>
          </section>
          {sample.id === "night-shift" ? <NightShiftReadinessPanel /> : null}
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
          {clearanceIssues.length > 0 ? (
            <section>
              <span className="stg-eyebrow">BODY CLEARANCE REVIEW</span>
              <h2>{clearanceIssues.length} tight authored point(s)</h2>
              <ul>
                {clearanceIssues.slice(0, 6).map((issue) => (
                  <li key={`${issue.kind}:${issue.targetId}`}>
                    <strong>{issue.kind}</strong>{" · "}{shortId(issue.targetId)}{" · "}
                    {issue.availableClearance.toFixed(1)}px / {issue.requiredClearance.toFixed(1)}px
                  </li>
                ))}
              </ul>
              <p>
                These are not physics failures. They are period-staging warnings where the foot point remains
                legal but the visible actor body may scrape the authored walk boundary.
              </p>
            </section>
          ) : null}
          {directorOverlay.lightZones.length > 0 ? (
            <section>
              <span className="stg-eyebrow">INDEXED LIGHT BINDINGS</span>
              <h2>{boundLights}/{directorOverlay.lightZones.length} authored bindings</h2>
              <div className="stg-palette-bindings">
                {directorOverlay.lightZones.map(({ zone, map, bindingStatus }) => {
                  const spec = map ? sceneDirectorPaletteSpecByAssetId(map.paletteAssetId) : null;
                  const paletteBank = spec && map ? sceneDirectorPaletteBankAtOffset(spec, map.paletteOffset) : null;
                  return (
                    <article key={zone.id} className={`stg-palette-binding is-${bindingStatus}`}>
                      <header>
                        <strong>{shortId(zone.id)}</strong>
                        <span>{zone.blendMode === "ordered-dither" ? "Bayer-4 · 8 px" : "hard"}</span>
                      </header>
                      <code>{map ? `${map.paletteAssetId} +${map.paletteOffset}` : zone.paletteMapId}</code>
                      {paletteBank ? (
                        <>
                          <div className="stg-palette-bank-heading"><span>{paletteBank.label}</span><small>{paletteBank.role}</small></div>
                          <div className="stg-palette-swatches" aria-label={`${paletteBank.label} palette bank`}>
                            {paletteBank.colours.map((colour, index) => (
                              <span
                                key={`${paletteBank.offset + index}-${colour}`}
                                title={`Index ${paletteBank.offset + index} · ${colour}`}
                                style={{ backgroundColor: colour }}
                              />
                            ))}
                          </div>
                        </>
                      ) : null}
                      <footer>{bindingStatus}</footer>
                    </article>
                  );
                })}
              </div>
              <p>
                These bindings are authored at the project layer. Shipping still requires compiled palette
                binaries and indexed evidence to pass the CLI/runtime integrity gates.
              </p>
            </section>
          ) : null}
          <section>
            <span className="stg-eyebrow">ROUND-TRIP OUTPUT</span>
            <h2>Three canonical documents</h2>
            <p>
              Export emits one deterministic ZIP containing project.json, scene-instances.json and
              scene-staging.json from the same committed history. Drag preview state is never exported.
            </p>
          </section>
          <section className="stg-next-action">
            <span className="stg-eyebrow">NEXT ACTION</span>
            <h2>{report.findings[0]?.message ?? "Play the room at 1× native size"}</h2>
            <p>
              {report.findings[0]?.recommendation ??
                "Switch through every Scene Director overlay, then run the room from every entrance and verify the final pixels, movement, occlusion and interactions agree."}
            </p>
          </section>
          <footer><span>Report v{report.reportVersion}</span><code>{shortId(report.projectId)}</code></footer>
        </aside>
      </div>
    </main>
  );
};
