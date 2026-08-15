import {
  localisationPlaceholders,
  pseudoLocaliseText,
  type LocalisationEditorCommand,
} from "@evavo/adventure-project-schema/localisation";
import { type ReactNode, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import {
  studioBitmapFonts,
  studioFontProject,
  studioLocalisationManifest,
  studioLocalisationSupplementalSources,
  studioLocalisationTextFitProfile,
} from "./localisation-fixture.js";
import {
  createLocalisationWorkspace,
  filteredLocalisationSources,
  insertLocalisationLocaleCommand,
  localisationWorkspaceIsDirty,
  localisationWorkspaceManifest,
  localisationWorkspaceReducer,
  localisationWorkspaceReport,
  removeSelectedLocaleCommand,
  replaceSelectedLocaleCommand,
  replaceSelectedTranslationCommand,
  selectedLocalisationFit,
  selectedLocalisationIssues,
  selectedLocalisationLocale,
  selectedLocalisationSource,
  selectedLocalisationText,
  type LocalisationWorkspaceState,
} from "./localisation-workspace.js";
import "./localisation-editor.css";

const Button = ({
  children,
  onClick,
  disabled = false,
  className = "",
  active = false,
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly active?: boolean;
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

const Field = ({ label, children }: { readonly label: string; readonly children: ReactNode }) => (
  <label className="localisation-field">
    <span>{label}</span>
    {children}
  </label>
);

const percent = (value: number): string => `${Math.round(value * 100)}%`;

const downloadManifest = (state: LocalisationWorkspaceState): void => {
  const manifest = localisationWorkspaceManifest(state);
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(manifest, null, 2)}\n`], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "localisation.json";
  anchor.click();
  URL.revokeObjectURL(url);
};

const issueTone = (severity: "error" | "warning"): string =>
  severity === "error" ? "is-error" : "is-warning";

const sourceSurface = (key: string): string => {
  if (key.startsWith("frontEnd.")) return "Classic front end";
  if (key.startsWith("lifecycle.")) return "Lifecycle outcome";
  return "Project";
};

export const LocalisationApp = () => {
  const [state, dispatch] = useReducer(
    localisationWorkspaceReducer,
    createLocalisationWorkspace(
      studioFontProject,
      studioLocalisationManifest,
      studioBitmapFonts,
      studioLocalisationTextFitProfile,
      studioLocalisationSupplementalSources,
    ),
  );
  const [newLocale, setNewLocale] = useState("");
  const [newLocaleLabel, setNewLocaleLabel] = useState("");
  const report = useMemo(() => localisationWorkspaceReport(state), [state]);
  const sources = useMemo(() => filteredLocalisationSources(state, report), [state, report]);
  const locale = selectedLocalisationLocale(state);
  const source = selectedLocalisationSource(state);
  const translation = selectedLocalisationText(state);
  const fit = selectedLocalisationFit(state, report);
  const issues = selectedLocalisationIssues(state, report);
  const coverage = report.coverage.find(
    (candidate) => candidate.locale.toLowerCase() === state.selectedLocale.toLowerCase(),
  );
  const dirty = localisationWorkspaceIsDirty(state);
  const issueCountByKey = useMemo(() => {
    const counts = new Map<string, number>();
    for (const issue of report.issues) {
      if (!issue.key) continue;
      if (issue.locale && issue.locale.toLowerCase() !== state.selectedLocale.toLowerCase()) continue;
      counts.set(issue.key, (counts.get(issue.key) ?? 0) + 1);
    }
    return counts;
  }, [report, state.selectedLocale]);

  const save = useCallback(() => {
    downloadManifest(state);
    dispatch({ type: "mark-saved" });
  }, [state]);

  const runCommand = useCallback(
    (command: LocalisationEditorCommand, notice: string, selectedLocale?: string) => {
      try {
        dispatch({
          type: "execute",
          command,
          notice,
          ...(selectedLocale ? { selectedLocale } : {}),
        });
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Localisation edit failed.");
      }
    },
    [],
  );

  const addLocale = (): void => {
    const tag = newLocale.trim();
    if (!tag) return;
    try {
      const addition = insertLocalisationLocaleCommand(state, tag, newLocaleLabel.trim() || undefined);
      runCommand(addition.command, `Added ${addition.locale}.`, addition.locale);
      setNewLocale("");
      setNewLocaleLabel("");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Locale creation failed.");
    }
  };

  const replaceLocale = (next: typeof locale): void =>
    runCommand(replaceSelectedLocaleCommand(state, next), `Updated ${locale.locale} settings.`);

  const removeLocale = (): void =>
    runCommand(removeSelectedLocaleCommand(state), `Removed ${locale.locale}.`);

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

  return (
    <div className="studio-app localisation-app">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">E</span>
          <span>
            <strong>EVAVO</strong>
            <small>ADVENTURE STUDIO</small>
          </span>
        </div>
        <div className="document-title">
          <span>{state.project.title}</span>
          <strong>Localisation Studio</strong>
          {dirty ? <i>●</i> : null}
        </div>
        <div className="topbar-actions">
          <Button onClick={save} className="primary-button">
            Export Localisation
          </Button>
        </div>
      </header>

      <div className="toolbar localisation-toolbar">
        <div className="toolbar-group">
          <Button onClick={() => dispatch({ type: "undo" })} disabled={state.history.undoStack.length === 0}>
            ↶
          </Button>
          <Button onClick={() => dispatch({ type: "redo" })} disabled={state.history.redoStack.length === 0}>
            ↷
          </Button>
        </div>
        <div className="localisation-toolbar-summary">
          <span className="eyebrow">TRANSLATION CONTROL</span>
          <strong>
            {report.sourceEntries.length} strings · {state.supplementalSourceEntries.length} sidecar
            strings · {report.errorCount} errors · {report.warningCount} warnings
          </strong>
        </div>
        <div className="toolbar-group">
          <Button
            active={state.findingsOnly}
            onClick={() => dispatch({ type: "set-findings-only", value: !state.findingsOnly })}
          >
            Findings only
          </Button>
        </div>
      </div>

      <main className="localisation-workspace-grid">
        <aside className="sidebar localisation-locale-sidebar">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">TARGET LOCALES</span>
              <h2>{localisationWorkspaceManifest(state).sourceLocale} source</h2>
            </div>
          </div>

          <div className="localisation-locale-list">
            {localisationWorkspaceManifest(state).locales.map((candidate) => {
              const candidateCoverage = report.coverage.find(
                (summary) => summary.locale.toLowerCase() === candidate.locale.toLowerCase(),
              );
              return (
                <button
                  type="button"
                  key={candidate.locale}
                  className={candidate.locale === locale.locale ? "is-active" : undefined}
                  onClick={() => dispatch({ type: "select-locale", locale: candidate.locale })}
                >
                  <span>
                    <strong>{candidate.label ?? candidate.locale}</strong>
                    <small>{candidate.locale} · {candidate.status}</small>
                  </span>
                  <b>{candidateCoverage ? percent(candidateCoverage.directCoverage) : "0%"}</b>
                </button>
              );
            })}
          </div>

          <section className="localisation-add-locale">
            <span className="eyebrow">ADD TARGET</span>
            <input
              value={newLocale}
              placeholder="de-DE"
              aria-label="New locale tag"
              onChange={(event) => setNewLocale(event.currentTarget.value)}
            />
            <input
              value={newLocaleLabel}
              placeholder="Deutsch"
              aria-label="New locale label"
              onChange={(event) => setNewLocaleLabel(event.currentTarget.value)}
            />
            <Button onClick={addLocale} disabled={!newLocale.trim()}>
              ＋ Add locale
            </Button>
          </section>

          <div className="sidebar-footer">
            <span className={`save-indicator ${dirty ? "is-dirty" : ""}`} />
            <span>{dirty ? "UNEXPORTED CHANGES" : "MANIFEST EXPORTED"}</span>
          </div>
        </aside>

        <section className="localisation-catalogue-column">
          <div className="localisation-catalogue-head">
            <div>
              <span className="eyebrow">SOURCE CATALOGUE</span>
              <h2>{sources.length} visible strings</h2>
            </div>
            <input
              className="localisation-search"
              value={state.query}
              placeholder="Search key, role, source path or text"
              onChange={(event) => dispatch({ type: "set-query", query: event.currentTarget.value })}
            />
          </div>

          <div className="localisation-string-list">
            {sources.map((candidate) => {
              const count = issueCountByKey.get(candidate.key) ?? 0;
              const direct = locale.entries.find((entry) => entry.key === candidate.key)?.text ?? "";
              return (
                <button
                  type="button"
                  key={candidate.key}
                  className={candidate.key === source.key ? "is-active" : undefined}
                  onClick={() => dispatch({ type: "select-key", key: candidate.key })}
                >
                  <span className="localisation-string-role">{candidate.role}</span>
                  <strong>{candidate.text}</strong>
                  <small>{candidate.key}</small>
                  <span
                    className={`localisation-string-state ${
                      direct.trim() ? "is-translated" : "is-missing"
                    }`}
                  >
                    {direct.trim() ? "DIRECT" : "MISSING"}
                    {count > 0 ? ` · ${count} FINDING${count === 1 ? "" : "S"}` : ""}
                  </span>
                </button>
              );
            })}
          </div>

          <section className="localisation-editor-card">
            <div className="localisation-editor-heading">
              <div>
                <span className="eyebrow">TRANSLATION</span>
                <h2>{source.key}</h2>
              </div>
              <span>{source.role}</span>
            </div>
            <div className="localisation-source-copy">
              <span>CANONICAL {localisationWorkspaceManifest(state).sourceLocale}</span>
              <p>{source.text}</p>
            </div>
            <Field label={`${locale.label ?? locale.locale} · ${locale.locale}`}>
              <textarea
                value={translation}
                rows={5}
                spellCheck="true"
                placeholder="Enter translation. Empty text follows the locale fallback policy."
                onChange={(event) =>
                  runCommand(
                    replaceSelectedTranslationCommand(state, event.currentTarget.value),
                    `Updated ${source.key}.`,
                  )
                }
              />
            </Field>
            <div className="localisation-pseudo-preview">
              <span>PSEUDO PRESSURE TEST</span>
              <p>{pseudoLocaliseText(source.text, { expansionRatio: 0.35 })}</p>
            </div>
          </section>
        </section>

        <aside className="sidebar localisation-inspector">
          <div className="inspector-heading">
            <span className="eyebrow">LOCALE INSPECTOR</span>
            <h2>{locale.label ?? locale.locale}</h2>
            <code>{locale.locale}</code>
          </div>

          <section className="localisation-settings">
            <Field label="Status">
              <select
                value={locale.status}
                onChange={(event) =>
                  replaceLocale({ ...locale, status: event.currentTarget.value as typeof locale.status })
                }
              >
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="release">Release</option>
              </select>
            </Field>
            <Field label="Fallback locale">
              <select
                value={locale.fallbackLocale ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  const withoutFallback = {
                    locale: locale.locale,
                    ...(locale.label ? { label: locale.label } : {}),
                    status: locale.status,
                    entries: locale.entries,
                  };
                  replaceLocale(value ? { ...withoutFallback, fallbackLocale: value } : withoutFallback);
                }}
              >
                <option value="">Canonical source</option>
                {localisationWorkspaceManifest(state).locales
                  .filter((candidate) => candidate.locale !== locale.locale)
                  .map((candidate) => (
                    <option key={candidate.locale} value={candidate.locale}>
                      {candidate.label ?? candidate.locale}
                    </option>
                  ))}
              </select>
            </Field>
            <Button
              onClick={removeLocale}
              disabled={localisationWorkspaceManifest(state).locales.length <= 1}
              className="danger-button"
            >
              Remove locale
            </Button>
          </section>

          <section className="localisation-metrics">
            <span className="eyebrow">COVERAGE</span>
            <div className="localisation-metric-grid">
              <div>
                <strong>{coverage ? percent(coverage.directCoverage) : "0%"}</strong>
                <span>Direct</span>
              </div>
              <div>
                <strong>{coverage ? percent(coverage.resolvedCoverage) : "0%"}</strong>
                <span>Resolved</span>
              </div>
              <div>
                <strong>{coverage?.sourceFallback ?? 0}</strong>
                <span>Source fallbacks</span>
              </div>
              <div>
                <strong>{coverage?.fallback ?? 0}</strong>
                <span>Locale fallbacks</span>
              </div>
            </div>
          </section>

          <section className="localisation-source-inspector">
            <span className="eyebrow">SOURCE CONTRACT</span>
            <dl>
              <div><dt>Surface</dt><dd>{sourceSurface(source.key)}</dd></div>
              <div><dt>Owner</dt><dd>{source.ownerId}</dd></div>
              <div><dt>Path</dt><dd>{source.sourcePath}</dd></div>
              <div><dt>Role</dt><dd>{source.role}</dd></div>
              <div>
                <dt>Placeholders</dt>
                <dd>{localisationPlaceholders(source.text).join(", ") || "None"}</dd>
              </div>
            </dl>
          </section>

          <section className="localisation-fit-inspector">
            <span className="eyebrow">NATIVE TEXT FIT</span>
            {fit ? (
              <div className="localisation-fit-grid">
                <div><span>Rule</span><strong>{fit.ruleId}</strong></div>
                <div><span>Font</span><strong>{fit.fontId}</strong></div>
                <div><span>Width</span><strong>{fit.contentWidth}/{fit.maxWidth}px</strong></div>
                <div><span>Height</span><strong>{fit.contentHeight}/{fit.maxHeight}px</strong></div>
                <div><span>Lines</span><strong>{fit.lineCount}/{fit.maxLines}</strong></div>
                <div><span>Glyph gaps</span><strong>{fit.fallbackCodePoints.length}</strong></div>
              </div>
            ) : (
              <p>No text-fit rule resolves this string.</p>
            )}
          </section>

          <section className="localisation-findings">
            <span className="eyebrow">SELECTED FINDINGS</span>
            {issues.length === 0 ? (
              <p className="localisation-clean">No findings for this string.</p>
            ) : (
              issues.map((issue, index) => (
                <div key={`${issue.code}:${index}`} className={issueTone(issue.severity)}>
                  <strong>{issue.code}</strong>
                  <p>{issue.message}</p>
                </div>
              ))
            )}
          </section>

          {state.notice ? <div className="localisation-notice">{state.notice}</div> : null}
        </aside>
      </main>
    </div>
  );
};
