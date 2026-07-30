import { useState, type ChangeEvent } from "react";
import type {
  ReplayInspection,
  SaveGameInspection,
} from "@evavo/adventure-playtest-inspector";
import {
  createPlaytestInspectorWorkspace,
  loadPlaytestArtifactText,
  type PlaytestArtifactKind,
  type PlaytestInspectorWorkspaceState,
} from "./playtest-workspace.js";
import "./playtest.css";

interface ArtifactPickerProps {
  readonly kind: PlaytestArtifactKind;
  readonly label: string;
  readonly fileName: string | null;
  readonly error: string | null;
  readonly onLoad: (kind: PlaytestArtifactKind, file: File) => Promise<void>;
}

const ArtifactPicker = ({
  kind,
  label,
  fileName,
  error,
  onLoad,
}: ArtifactPickerProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) void onLoad(kind, file);
    event.target.value = "";
  };

  return (
    <label className={`playtest-file-card${error ? " has-error" : ""}`}>
      <span className="playtest-file-label">{label}</span>
      <strong>{fileName ?? "Choose JSON file"}</strong>
      <span>{error ?? "Validated locally against the loaded runtime bundle."}</span>
      <input type="file" accept="application/json,.json" onChange={handleChange} />
    </label>
  );
};

const Metric = ({ label, value }: { readonly label: string; readonly value: string | number }) => (
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

const ReplayTimeline = ({ inspection }: { readonly inspection: ReplayInspection }) => (
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

export const PlaytestApp = () => {
  const [state, setState] = useState<PlaytestInspectorWorkspaceState>(() =>
    createPlaytestInspectorWorkspace(),
  );

  const loadFile = async (
    kind: PlaytestArtifactKind,
    file: File,
  ): Promise<void> => {
    const text = await file.text();
    setState((current) =>
      loadPlaytestArtifactText(current, kind, text, file.name),
    );
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
        />
        <ArtifactPicker
          kind="before-save"
          label="Save A · before"
          fileName={state.beforeSaveName}
          error={state.errors.beforeSave}
          onLoad={loadFile}
        />
        <ArtifactPicker
          kind="after-save"
          label="Save B · after"
          fileName={state.afterSaveName}
          error={state.errors.afterSave}
          onLoad={loadFile}
        />
        <ArtifactPicker
          kind="replay"
          label="Replay log"
          fileName={state.replayName}
          error={state.errors.replay}
          onLoad={loadFile}
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
                  : "No state changes"}
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
                    <td><span className="playtest-badge">{entry.code}</span></td>
                    <td><code>{entry.path}</code></td>
                    <td>{formatValue(entry.before)}</td>
                    <td>{formatValue(entry.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {state.replayInspection ? (
        <ReplayTimeline inspection={state.replayInspection} />
      ) : null}
    </main>
  );
};
