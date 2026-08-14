import type { ClassicFrontEndManifest } from "@evavo/adventure-project-schema/front-end";
import type {
  ClassicFrontEndEditorCommand,
  ClassicFrontEndMenuLabelKey,
  ClassicFrontEndMenuVisibilityKey,
} from "@evavo/adventure-project-schema/front-end-editor";
import { type ReactNode, useCallback, useEffect, useReducer, useState } from "react";
import { studioFrontEndManifest, studioFrontEndProject } from "./front-end-fixture.js";
import {
  createFrontEndWorkspace,
  frontEndWorkspaceIsDirty,
  frontEndWorkspaceManifest,
  frontEndWorkspaceReducer,
  type FrontEndPreviewScreen,
} from "./front-end-workspace.js";
import "./front-end-editor.css";

const Button = ({
  children,
  onClick,
  disabled = false,
  active = false,
  className = "",
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly active?: boolean;
  readonly className?: string;
}) => (
  <button
    type="button"
    className={`button ${active ? "is-active" : ""} ${className}`}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </button>
);

const TextDraft = ({
  label,
  value,
  maxLength,
  onCommit,
}: {
  readonly label: string;
  readonly value: string;
  readonly maxLength: number;
  readonly onCommit: (value: string) => void;
}) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = (): void => {
    const next = draft.trim();
    if (!next || next === value) {
      setDraft(value);
      return;
    }
    onCommit(next);
  };
  return (
    <label className="front-end-field">
      <span>{label}</span>
      <input
        value={draft}
        maxLength={maxLength}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(value);
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
};

const TimingDraft = ({
  manifest,
  onCommit,
}: {
  readonly manifest: ClassicFrontEndManifest;
  readonly onCommit: (durationTicks: number, skipAfterTicks: number) => void;
}) => {
  const [duration, setDuration] = useState(String(manifest.publisher.splashDurationTicks));
  const [skip, setSkip] = useState(String(manifest.publisher.splashSkipAfterTicks));
  useEffect(() => {
    setDuration(String(manifest.publisher.splashDurationTicks));
    setSkip(String(manifest.publisher.splashSkipAfterTicks));
  }, [manifest.publisher.splashDurationTicks, manifest.publisher.splashSkipAfterTicks]);
  const commit = (): void => {
    const durationTicks = Number.parseInt(duration, 10);
    const skipAfterTicks = Number.parseInt(skip, 10);
    if (
      !Number.isInteger(durationTicks) ||
      !Number.isInteger(skipAfterTicks) ||
      durationTicks < 1 ||
      durationTicks > 600 ||
      skipAfterTicks < 0 ||
      skipAfterTicks > durationTicks
    ) {
      setDuration(String(manifest.publisher.splashDurationTicks));
      setSkip(String(manifest.publisher.splashSkipAfterTicks));
      return;
    }
    onCommit(durationTicks, skipAfterTicks);
  };
  return (
    <div className="front-end-timing-grid">
      <label className="front-end-field">
        <span>Splash ticks</span>
        <input
          inputMode="numeric"
          value={duration}
          onChange={(event) => setDuration(event.currentTarget.value)}
          onBlur={commit}
        />
      </label>
      <label className="front-end-field">
        <span>Skip after</span>
        <input
          inputMode="numeric"
          value={skip}
          onChange={(event) => setSkip(event.currentTarget.value)}
          onBlur={commit}
        />
      </label>
    </div>
  );
};

const Toggle = ({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
}) => (
  <label className="front-end-toggle">
    <span>{label}</span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  </label>
);

const previewMenu = (manifest: ClassicFrontEndManifest): readonly string[] => {
  const labels = manifest.menu.labels;
  const items = [labels.newGame];
  if (manifest.menu.showContinue) items.push(labels.continueGame);
  if (manifest.menu.showLoad) items.push(labels.loadGame);
  if (manifest.menu.showOptions) items.push(labels.options);
  if (manifest.menu.showCredits) items.push(labels.credits);
  if (manifest.menu.showQuit) items.push(labels.quit);
  return items;
};

const FrontEndPreview = ({
  manifest,
  screen,
  title,
}: {
  readonly manifest: ClassicFrontEndManifest;
  readonly screen: FrontEndPreviewScreen;
  readonly title: string;
}) => (
  <div className="front-end-preview-stage">
    <div className="front-end-preview-frame" data-screen={screen}>
      {screen === "splash" ? (
        <div className="front-end-preview-splash">
          <strong>{manifest.publisher.name}</strong>
          <span>{manifest.publisher.presents}</span>
          <small>PRESS ANY KEY</small>
        </div>
      ) : (
        <>
          <header className="front-end-preview-title">
            <span>{manifest.title.kicker}</span>
            <h1>{title}</h1>
          </header>
          <section className="front-end-preview-menu">
            <h2>
              {screen === "title"
                ? "MAIN MENU"
                : screen === "options"
                  ? manifest.menu.labels.options
                  : screen === "credits"
                    ? manifest.menu.labels.credits
                    : manifest.menu.labels.quit}
            </h2>
            {screen === "title" ? (
              <div className="front-end-preview-items">
                {previewMenu(manifest).map((label, index) => (
                  <span key={`${index}:${label}`} className={index === 0 ? "is-selected" : undefined}>
                    {label}
                  </span>
                ))}
              </div>
            ) : screen === "options" ? (
              <div className="front-end-preview-items">
                {manifest.options.allowFullscreen ? (
                  <span className="is-selected">{manifest.menu.labels.fullscreen}</span>
                ) : null}
                <span className={manifest.options.allowFullscreen ? undefined : "is-selected"}>
                  {manifest.menu.labels.back}
                </span>
              </div>
            ) : screen === "credits" ? (
              <div className="front-end-preview-credits">
                <p>{title}</p>
                {manifest.credits.lines.map((line, index) => (
                  <p key={`${index}:${line}`}>{line}</p>
                ))}
                <span className="is-selected">{manifest.menu.labels.back}</span>
              </div>
            ) : (
              <div className="front-end-preview-quit">
                <p>CLOSE THE TAB OR RETURN TO THE TITLE SCREEN.</p>
                <span className="is-selected">{manifest.menu.labels.back}</span>
              </div>
            )}
          </section>
          <footer>↑ ↓ SELECT   ENTER CHOOSE   ESC BACK</footer>
        </>
      )}
    </div>
  </div>
);

const downloadManifest = (manifest: ClassicFrontEndManifest): void => {
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(manifest, null, 2)}\n`], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "front-end.json";
  anchor.click();
  URL.revokeObjectURL(url);
};

const LABEL_FIELDS: readonly [ClassicFrontEndMenuLabelKey, string][] = [
  ["newGame", "New Game"],
  ["continueGame", "Continue"],
  ["loadGame", "Load Game"],
  ["options", "Options"],
  ["credits", "Credits"],
  ["quit", "Quit"],
  ["quickSave", "Quick Save"],
  ["back", "Back"],
  ["fullscreen", "Fullscreen"],
];

const VISIBILITY_FIELDS: readonly [ClassicFrontEndMenuVisibilityKey, string][] = [
  ["showContinue", "Show Continue"],
  ["showLoad", "Show Load"],
  ["showOptions", "Show Options"],
  ["showCredits", "Show Credits"],
  ["showQuit", "Show Quit"],
];

export const FrontEndApp = () => {
  const [state, dispatch] = useReducer(
    frontEndWorkspaceReducer,
    createFrontEndWorkspace(studioFrontEndManifest),
  );
  const manifest = frontEndWorkspaceManifest(state);
  const dirty = frontEndWorkspaceIsDirty(state);
  const [creditsDraft, setCreditsDraft] = useState(manifest.credits.lines.join("\n"));
  useEffect(() => setCreditsDraft(manifest.credits.lines.join("\n")), [manifest.credits.lines]);

  const run = useCallback((command: ClassicFrontEndEditorCommand, notice?: string) => {
    dispatch({ type: "execute", command, ...(notice ? { notice } : {}) });
  }, []);

  const save = useCallback(() => {
    downloadManifest(manifest);
    dispatch({ type: "mark-saved" });
  }, [manifest]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      } else if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      } else if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  const setLabel = (label: ClassicFrontEndMenuLabelKey, value: string): void =>
    run({ kind: "set-menu-label", label, value }, `Updated ${label}.`);

  return (
    <div className="studio-app front-end-app">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">E</span>
          <span>
            <strong>EVAVO</strong>
            <small>ADVENTURE STUDIO</small>
          </span>
        </div>
        <div className="document-title">
          <span>{studioFrontEndProject.title}</span>
          <strong>Front End Studio</strong>
          {dirty ? <i>●</i> : null}
        </div>
        <div className="topbar-actions">
          <Button onClick={save} className="primary-button">Export Front End</Button>
        </div>
      </header>

      <div className="toolbar front-end-toolbar">
        <div className="toolbar-group">
          <Button onClick={() => dispatch({ type: "undo" })} disabled={state.history.undoStack.length === 0}>↶</Button>
          <Button onClick={() => dispatch({ type: "redo" })} disabled={state.history.redoStack.length === 0}>↷</Button>
        </div>
        <div className="front-end-preview-tabs">
          {(["splash", "title", "options", "credits", "quit"] as const).map((screen) => (
            <Button
              key={screen}
              active={state.preview === screen}
              onClick={() => dispatch({ type: "set-preview", preview: screen })}
            >
              {screen}
            </Button>
          ))}
        </div>
        <div className="front-end-toolbar-status">
          <span className={`save-indicator ${dirty ? "is-dirty" : ""}`} />
          {dirty ? "UNEXPORTED" : "EXPORTED"}
        </div>
      </div>

      <main className="front-end-workspace">
        <aside className="sidebar front-end-controls">
          <section>
            <span className="eyebrow">PUBLISHER SPLASH</span>
            <TextDraft
              label="Publisher"
              value={manifest.publisher.name}
              maxLength={48}
              onCommit={(value) => run({ kind: "set-publisher-name", value })}
            />
            <TextDraft
              label="Presents line"
              value={manifest.publisher.presents}
              maxLength={80}
              onCommit={(value) => run({ kind: "set-presents-line", value })}
            />
            <TimingDraft
              manifest={manifest}
              onCommit={(durationTicks, skipAfterTicks) =>
                run({ kind: "set-splash-timing", durationTicks, skipAfterTicks })
              }
            />
          </section>

          <section>
            <span className="eyebrow">TITLE</span>
            <TextDraft
              label="Kicker"
              value={manifest.title.kicker}
              maxLength={96}
              onCommit={(value) => run({ kind: "set-title-kicker", value })}
            />
          </section>

          <section>
            <span className="eyebrow">MENU POLICY</span>
            {VISIBILITY_FIELDS.map(([field, label]) => (
              <Toggle
                key={field}
                label={label}
                checked={manifest.menu[field]}
                onChange={(value) => run({ kind: "set-menu-visibility", field, value })}
              />
            ))}
            <Toggle
              label="Allow Fullscreen"
              checked={manifest.options.allowFullscreen}
              onChange={(value) => run({ kind: "set-fullscreen", value })}
            />
          </section>
        </aside>

        <section className="front-end-preview-column">
          <div className="front-end-preview-header">
            <div>
              <span className="eyebrow">NATIVE PREVIEW</span>
              <h2>320 × 200 front-end plate</h2>
            </div>
            <code>{state.preview}</code>
          </div>
          <FrontEndPreview
            manifest={manifest}
            screen={state.preview}
            title={studioFrontEndProject.title}
          />
          <div className="front-end-preview-notes">
            <span>Preview is logical-size geometry, not responsive webpage layout.</span>
            <span>Runtime save/replay state is intentionally absent from this authoring surface.</span>
          </div>
        </section>

        <aside className="sidebar front-end-inspector">
          <section>
            <span className="eyebrow">MENU WORDING</span>
            <div className="front-end-label-grid">
              {LABEL_FIELDS.map(([label, title]) => (
                <TextDraft
                  key={label}
                  label={title}
                  value={manifest.menu.labels[label]}
                  maxLength={48}
                  onCommit={(value) => setLabel(label, value)}
                />
              ))}
            </div>
          </section>

          <section>
            <span className="eyebrow">CREDITS</span>
            <label className="front-end-field">
              <span>One line per credit</span>
              <textarea
                rows={8}
                value={creditsDraft}
                onChange={(event) => setCreditsDraft(event.currentTarget.value)}
                onBlur={() => {
                  const lines = creditsDraft
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .slice(0, 24);
                  if (lines.some((line) => line.length > 96)) {
                    setCreditsDraft(manifest.credits.lines.join("\n"));
                    return;
                  }
                  run({ kind: "set-credits", lines });
                }}
              />
            </label>
          </section>

          <section className="front-end-contract-summary">
            <span className="eyebrow">RUNTIME CONTRACT</span>
            <dl>
              <div><dt>Project</dt><dd>{manifest.projectId}</dd></div>
              <div><dt>Manifest</dt><dd>v{manifest.manifestVersion}</dd></div>
              <div><dt>Splash</dt><dd>{manifest.publisher.splashDurationTicks} ticks</dd></div>
              <div><dt>Skip</dt><dd>after {manifest.publisher.splashSkipAfterTicks}</dd></div>
              <div><dt>Credits</dt><dd>{manifest.credits.lines.length} lines</dd></div>
            </dl>
          </section>

          {state.notice ? <div className="front-end-notice">{state.notice}</div> : null}
        </aside>
      </main>
    </div>
  );
};