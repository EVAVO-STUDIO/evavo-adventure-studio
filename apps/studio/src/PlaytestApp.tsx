import { useRef, useState, type ChangeEvent } from "react";
import type {
  ReplayInspection,
  SaveGameInspection,
} from "@evavo/adventure-playtest-inspector";
import type { CanonicalSaveDiff } from "@evavo/adventure-playtest-inspector/canonical-diff";
import { reportPlaytestArtifactReadFailure } from "./playtest-file-controller.js";
import {
  clearPlaytestArtifact,
  createPlaytestInspectorWorkspace,
  loadPlaytestArtifactText,
  type PlaytestArtifactKind,
  type PlaytestInspectorWorkspaceState,
} from "./playtest-workspace.js";
import "./playtest.css";
import "./playtest-controls.css";
import "./playtest-audit.css";

interface ArtifactPickerProps {
  readonly kind: PlaytestArtifactKind;
  readonly label: string;
  readonly fileName: string | null;
  readonly error: string | null;
  readonly onLoad: (kind: PlaytestArtifactKind, file: File) => Promise<void>;
  readonly onClear: (kind: PlaytestArtifactKind) => void;
}

const ArtifactPicker = ({
  kind,
  label,
  fileName,
  error,
  onLoad,
  onClear,
}: ArtifactPickerProps) => {
  const inputId = `playtest-artifact-${kind}`;
  const statusId = `${inputId}-status`;
  const canClear = fileName !== null || error !== null;

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) void onLoad(kind, file);
    event.target.value = "";
  };

  return (
    <div className={`playtest-file-card${error ? " has-error" : ""}`}>
      <label className="playtest-file-target" htmlFor={inputId}>
        <span className="playtest-file-label">{label}</span>
        <strong>{fileName ?? "Choose JSON file"}</strong>
        <span id={statusId} role={error ? "alert" : undefined}>
          {error ?? "Validated locally against the loaded runtime bundle."}
        </span>
      </label>
      <input
        id={inputId}
        type="file"
        accept="application/json,.json"
        aria-describedby={statusId}
        onChange={handleChange}
      />
      {canClear ? (
        <button
          type="button"
          className="playtest-file-clear"
          aria-label={`Clear ${label}`}
          onClick={() => onClear(kind)}
        >
          Clear
        </button>
      ) : null}
    </div>
  );
};

const Metric = ({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | number;
}) => (
  <div className="playtest-metric">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const SaveSummary = ({
  title,
  inspection,
}: {
  readonly title: string;
  readonly inspection: SaveGameInspection;
}) => (
  <section className="playtest-card playtest-save-summary">
    <header>
      <div>
        <span className="playtest-eyebrow">{title}</span>
        <h2>{inspection.sceneName}</h2>
      </div>
      <code>{inspection.saveFingerprint}</code>
    </header>
    <div className="playtest-metric-grid">
      <Metric label="Tick" value={inspection.tick} />
      <Metric label="Score" value={inspection.score} />
      <Metric label="Inventory" value={inspection.inventory.length} />
      <Metric label="Actors" value={inspection.actors.length} />
      <Metric label="Moving" value={inspection.movementCount} />
      <Metric label="Pending" value={inspection.pendingCommandCount} />
    </div>
    <dl className="playtest-detail-list">
      <div>
        <dt>Scene</dt>
        <dd>{inspection.sceneId}</dd>
      </div>
      <div>
        <dt>Entrance</dt>
        <dd>{inspection.entranceId}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>{inspection.statusText || "—"}</dd>
      </div>
      <div>
        <dt>Selected verb</dt>
        <dd>{inspection.selectedVerbId ?? "—"}</dd>
      </div>
      <div>
        <dt>Selected item</dt>
        <dd>{inspection.selectedItemId ?? "—"}</dd>
      </div>
      <div>
        <dt>Dialogue</dt>
        <dd>
          {inspection.activeDialogue
            ? `${inspection.activeDialogue.dialogueName} / ${inspection.activeDialogue.nodeId}`
            : "—"}
        </dd>
      </div>
    </dl>
    <div className="playtest-tags">
      {inspection.inventory.map((item) => (
        <span key={item.id}>{item.name}</span>
      ))}
      {inspection.trueFlags.map((flag) => (
        <span key={flag}>FLAG {flag}</span>
      ))}
      {inspection.activeSequences.map((sequence) => (
        <span key={sequence.sequenceId}>
          {sequence.sequenceName} · {sequence.elapsedTicks}t
        </span>
      ))}
    </div>
  </section>
);

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  const encoded = JSON.stringify(value);
  return encoded === undefined ? String(value) : encoded;
};

const CanonicalAudit = ({
  diff,
  semanticChanged,
}: {
  readonly diff: CanonicalSaveDiff;
  readonly semanticChanged: boolean;
}) => (
  <section className="playtest-card playtest-diff playtest-canonical-audit">
    <header>
      <div>
        <span className="playtest-eyebrow">Deterministic state audit</span>
        <h2>
          {diff.changed
            ? `${diff.entries.length}${diff.truncated ? "+" : ""} exact path changes`
            : "Canonical states match"}
        </h2>
      </div>
      <span
        className={`playtest-canonical-status${diff.changed ? " has-difference" : ""}`}
      >
        {diff.changed ? "Divergence found" : "Exact match"}
      </span>
    </header>
    <p className="playtest-canonical-copy">
      This audit compares every serialized world and interface field, including
      random streams, consumed interactions, dialogue choices and score-award
      identities that are intentionally summarized by the semantic view.
    </p>
    <div className="playtest-metric-grid">
      <Metric label="Exact paths" value={diff.entries.length} />
      <Metric label="Truncated" value={diff.truncated ? "Yes" : "No"} />
      <Metric label="Semantic changes" value={semanticChanged ? "Yes" : "No"} />
      <Metric
        label="Hidden divergence"
        value={diff.changed && !semanticChanged ? "Yes" : "No"}
      />
    </div>
    {diff.changed ? (
      <details
        className="playtest-canonical-details"
        open={!semanticChanged}
      >
        <summary>Review exact deterministic paths</summary>
        <div className="playtest-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Change</th>
                <th>Path</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {diff.entries.map((entry) => (
                <tr key={`${entry.kind}:${entry.path}`}>
                  <td>
                    <span className="playtest-badge">{entry.kind}</span>
                  </td>
                  <td>
                    <code>{entry.path}</code>
                  </td>
                  <td>{formatValue(entry.before)}</td>
                  <td>{formatValue(entry.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {diff.truncated ? (
          <p className="playtest-canonical-note">
            The audit reached its 250-path display limit. The saves still differ
            beyond the paths shown here.
          </p>
        ) : null}
      </details>
    ) : null}
  </section>
);

const ReplayTimeline = ({
  inspection,
}: {
  readonly inspection: ReplayInspection;
}) => (
  <section className="playtest-card playtest-replay">
    <header>
      <div>
        <span className="playtest-eyebrow">Replay timeline</span>
        <h2>{inspection.eventCount} deliberate events</h2>
      </div>
      <code>{inspection.replayFingerprint}</code>
    </header>
    <div className="playtest-metric-grid">
      <Metric label="Initial tick" value={inspection.initialTick} />
      <Metric label="Final tick" value={inspection.finalTick} />
      <Metric label="Duration" value={`${inspection.durationTicks}t`} />
      <Metric label="Checkpoints" value={inspection.timeline.length} />
    </div>
    <ol className="playtest-timeline">
      {inspection.timeline.map((group) => (
        <li key={group.tick}>
          <span className="playtest-tick">T{group.tick}</span>
          <div>
            {group.events.map((event) => (
              <article key={event.sequence}>
                <span>#{event.sequence}</span>
                <strong>{event.label}</strong>
                <code>{event.kind}</code>
              </article>
            ))}
          </div>
        </li>
      ))}
    </ol>
    <footer>
      Expected final save: {inspection.expectedFinalSaveFingerprint ?? "Not recorded"}
    </footer>
  </section>
);

const initialReadGeneration = (): Record<PlaytestArtifactKind, number> => ({
  bundle: 0,
  "before-save": 0,
  "after-save": 0,
  replay: 0,
});

export const PlaytestApp = () => {
  const [state, setState] = useState<PlaytestInspectorWorkspaceState>(() =>
    createPlaytestInspectorWorkspace(),
  );
  const readGeneration = useRef(initialReadGeneration());

  const loadFile = async (
    kind: PlaytestArtifactKind,
    file: File,
  ): Promise<void> => {
    const generation = readGeneration.current[kind] + 1;
    readGeneration.current[kind] = generation;

    try {
      const text = await file.text();
      if (readGeneration.current[kind] !== generation) return;
      setState((current) =>
        loadPlaytestArtifactText(current, kind, text, file.name),
      );
    } catch (error) {
      if (readGeneration.current[kind] !== generation) return;
      setState((current) =>
        reportPlaytestArtifactReadFailure(current, kind, file.name, error),
      );
    }
  };

  const clearFile = (kind: PlaytestArtifactKind): void => {
    readGeneration.current[kind] += 1;
    setState((current) => clearPlaytestArtifact(current, kind));
  };

  return (
    <main className="playtest-shell">
      <header className="playtest-header">
        <div>
          <span className="playtest-eyebrow">EVAVO Adventure Studio</span>
          <h1>Playtest Inspector</h1>
          <p>
            Validate packaged saves and replays, inspect canonical world state,
            and compare two checkpoints without starting the renderer.
          </p>
        </div>
        <div className="playtest-header-status">
          <span>{state.bundle ? "Bundle ready" : "Load a bundle"}</span>
          <strong>{state.bundle?.title ?? "No runtime selected"}</strong>
        </div>
      </header>

      <section className="playtest-file-grid" aria-label="Playtest artifact files">
        <ArtifactPicker
          kind="bundle"
          label="Runtime bundle"
          fileName={state.bundleName}
          error={state.errors.bundle}
          onLoad={loadFile}
          onClear={clearFile}
        />
        <ArtifactPicker
          kind="before-save"
          label="Save A · before"
          fileName={state.beforeSaveName}
          error={state.errors.beforeSave}
          onLoad={loadFile}
          onClear={clearFile}
        />
        <ArtifactPicker
          kind="after-save"
          label="Save B · after"
          fileName={state.afterSaveName}
          error={state.errors.afterSave}
          onLoad={loadFile}
          onClear={clearFile}
        />
        <ArtifactPicker
          kind="replay"
          label="Replay log"
          fileName={state.replayName}
          error={state.errors.replay}
          onLoad={loadFile}
          onClear={clearFile}
        />
      </section>

      {!state.bundle ? (
        <section className="playtest-empty">
          <strong>Start with game.bundle.json</strong>
          <p>
            Every save and replay is checked against the exact project, asset
            manifest and runtime-bundle fingerprint.
          </p>
        </section>
      ) : null}

      <section className="playtest-summary-grid">
        {state.beforeInspection ? (
          <SaveSummary title="Save A" inspection={state.beforeInspection} />
        ) : null}
        {state.afterInspection ? (
          <SaveSummary title="Save B" inspection={state.afterInspection} />
        ) : null}
      </section>

      {state.diff ? (
        <section className="playtest-card playtest-diff">
          <header>
            <div>
              <span className="playtest-eyebrow">Semantic state diff</span>
              <h2>
                {state.diff.changed
                  ? `${state.diff.entries.length} changes`
                  : "No semantic state changes"}
              </h2>
            </div>
          </header>
          <div className="playtest-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Path</th>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {state.diff.entries.map((entry) => (
                  <tr key={`${entry.code}:${entry.path}`}>
                    <td>
                      <span className="playtest-badge">{entry.code}</span>
                    </td>
                    <td>
                      <code>{entry.path}</code>
                    </td>
                    <td>{formatValue(entry.before)}</td>
                    <td>{formatValue(entry.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {state.canonicalDiff ? (
        <CanonicalAudit
          diff={state.canonicalDiff}
          semanticChanged={state.diff?.changed ?? false}
        />
      ) : null}

      {state.replayInspection ? (
        <ReplayTimeline inspection={state.replayInspection} />
      ) : null}
    </main>
  );
};
