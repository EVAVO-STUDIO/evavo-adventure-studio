import {
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import {
  parseSceneInstanceManifest,
  type SceneInstanceManifest,
} from "@evavo/adventure-scene-instances";
import { studioProject, studioSceneInstances } from "./fixture.js";
import {
  validateStudioManifest,
  type StudioValidationGroup,
} from "./validation.js";
import "./validation.css";

const createBrokenDemo = (): SceneInstanceManifest =>
  parseSceneInstanceManifest({
    ...studioSceneInstances,
    objectDefinitions: [
      {
        ...studioSceneInstances.objectDefinitions[0],
        initialStateId: "object-state.missing",
      },
      ...studioSceneInstances.objectDefinitions.slice(1),
    ],
    scenes: [
      {
        ...studioSceneInstances.scenes[0],
        actorInstances: [
          {
            ...studioSceneInstances.scenes[0]!.actorInstances[0],
            position: { x: 3, y: 3 },
            facing: "north",
          },
          ...studioSceneInstances.scenes[0]!.actorInstances.slice(1),
        ],
        navigationPortals: [
          {
            ...studioSceneInstances.scenes[0]!.navigationPortals[0],
            fromAreaId: "navigation.missing",
          },
        ],
      },
      ...studioSceneInstances.scenes.slice(1),
    ],
  });

const downloadReport = (
  manifest: SceneInstanceManifest,
  summary: ReturnType<typeof validateStudioManifest>,
): void => {
  const payload = {
    reportVersion: 1,
    projectId: studioProject.id,
    valid: summary.valid,
    issueCount: summary.issueCount,
    manifestRevision: manifest.manifestVersion,
    issues: summary.issues,
  };
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "scene-validation-report.json";
  anchor.click();
  URL.revokeObjectURL(url);
};

export const ValidationApp = () => {
  const [manifest, setManifest] = useState(studioSceneInstances);
  const [sourceName, setSourceName] = useState("Representative studio fixture");
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const summary = useMemo(
    () => validateStudioManifest(studioProject, manifest),
    [manifest],
  );
  const selectedGroup =
    summary.groups.find(
      (group) => `${group.kind}:${group.id}` === selectedGroupKey,
    ) ?? summary.groups[0] ?? null;

  const openManifest = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const loaded = parseSceneInstanceManifest(
        JSON.parse(await file.text()) as unknown,
      );
      if (loaded.projectId !== studioProject.id) {
        throw new Error(
          `Manifest project '${loaded.projectId}' does not match '${studioProject.id}'.`,
        );
      }
      setManifest(loaded);
      setSourceName(file.name);
      setSelectedGroupKey(null);
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "The manifest could not be loaded.",
      );
    }
  };

  return (
    <div className="studio-app validation-app">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">E</span>
          <span>
            <strong>EVAVO</strong>
            <small>ADVENTURE STUDIO</small>
          </span>
        </div>
        <div className="document-title">
          <span>{studioProject.title}</span>
          <strong>Validation Centre</strong>
        </div>
        <div className="topbar-actions">
          <label className="button validation-file-button">
            Open Manifest
            <input
              hidden
              type="file"
              accept="application/json,.json"
              onChange={(event) => void openManifest(event)}
            />
          </label>
          <button
            type="button"
            className="button primary-button"
            onClick={() => downloadReport(manifest, summary)}
          >
            Export Report
          </button>
        </div>
      </header>

      <div className="toolbar validation-toolbar">
        <div className="toolbar-group">
          <button
            type="button"
            className="button"
            onClick={() => {
              setManifest(studioSceneInstances);
              setSourceName("Representative studio fixture");
              setSelectedGroupKey(null);
              setLoadError(null);
            }}
          >
            Valid fixture
          </button>
          <button
            type="button"
            className="button"
            onClick={() => {
              setManifest(createBrokenDemo());
              setSourceName("Deliberately broken demonstration");
              setSelectedGroupKey(null);
              setLoadError(null);
            }}
          >
            Broken demo
          </button>
        </div>
        <div className="validation-status-line">
          <span className={summary.valid ? "is-valid" : "is-invalid"}>
            {summary.valid ? "VALID" : "BLOCKED"}
          </span>
          <strong>{summary.issueCount} issues</strong>
        </div>
        <div className="toolbar-group validation-source">{sourceName}</div>
      </div>

      <main className="validation-grid">
        <aside className="sidebar validation-summary-sidebar">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">VALIDATION GROUPS</span>
              <h2>{summary.groups.length} affected areas</h2>
            </div>
          </div>
          {loadError ? <div className="validation-load-error">{loadError}</div> : null}
          <div className="validation-groups">
            {summary.groups.map((group) => {
              const key = `${group.kind}:${group.id}`;
              return (
                <button
                  type="button"
                  key={key}
                  className={`validation-group-row ${
                    selectedGroup === group ? "is-active" : ""
                  }`}
                  onClick={() => setSelectedGroupKey(key)}
                >
                  <span>{group.kind === "scene" ? "S" : group.kind === "object-definition" ? "O" : "D"}</span>
                  <span>
                    <strong>{group.label}</strong>
                    <small>{group.issues.length} issues</small>
                  </span>
                  <em>{group.issues.length}</em>
                </button>
              );
            })}
            {summary.valid ? (
              <div className="validation-empty-summary">
                <span>✓</span>
                <strong>Composition is semantically valid</strong>
                <p>No missing references, invalid placement or object-state errors were found.</p>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="validation-results">
          <div className="validation-results-header">
            <div>
              <span className="eyebrow">SEMANTIC DIAGNOSTICS</span>
              <h1>{selectedGroup?.label ?? "No validation issues"}</h1>
            </div>
            <div className={`validation-score ${summary.valid ? "is-valid" : "is-invalid"}`}>
              <strong>{summary.valid ? "PASS" : "FAIL"}</strong>
              <span>{summary.issueCount}</span>
            </div>
          </div>
          <div className="validation-issue-list">
            {selectedGroup?.issues.map((issue, index) => (
              <article className="validation-issue" key={`${issue.code}-${issue.path}-${index}`}>
                <span className="issue-number">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <span className="issue-code">{issue.code}</span>
                  <h2>{issue.message}</h2>
                  <code>{issue.path}</code>
                </div>
              </article>
            ))}
            {!selectedGroup ? (
              <div className="validation-success-panel">
                <span>✓</span>
                <h2>Ready for compiled-asset validation</h2>
                <p>
                  The scene composition is structurally and semantically valid. Compilation must still verify source files, runtime outputs and atlas geometry.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="sidebar validation-rules-sidebar">
          <div className="inspector-heading">
            <span className="eyebrow">ACTIVE RULES</span>
            <h2>Scene composition</h2>
            <code>@evavo/adventure-scene-instances</code>
          </div>
          <div className="validation-rules">
            {[
              ["Project identity", "Sidecar must match the source project."],
              ["Stable IDs", "Definitions, states, instances and verbs must be unique."],
              ["Scene references", "Every composition must reference an existing scene."],
              ["Actor placement", "Walkable actors must begin inside enabled navigation."],
              ["Animation selection", "State and facing must resolve to an actor clip."],
              ["Object states", "Initial and overridden states must exist."],
              ["Navigation portals", "Portal endpoints must lie in their declared polygons."],
              ["Typed actions", "Object transitions and story actions must target real IDs."],
            ].map(([title, detail], index) => (
              <div className="validation-rule" key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
};
