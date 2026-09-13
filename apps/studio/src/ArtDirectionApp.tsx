import {
  type ArtAssetRole,
  type ArtAssetRule,
  type ArtDirectionEditorCommand,
  type ArtDirectionProfile,
  type ArtPreset,
  applyArtDirectionEditorCommand,
} from "@evavo/adventure-art-direction";
import type { Id } from "@evavo/adventure-project-schema";
import { type Dispatch, type ReactNode, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { studioArtDirectionManifest, studioCompiledArtEvidence } from "./art-fixture.js";
import {
  type ArtDirectionWorkspaceAction,
  type ArtDirectionWorkspaceState,
  artDirectionIssuesForAsset,
  artDirectionWorkspaceIsDirty,
  artDirectionWorkspaceIssues,
  artDirectionWorkspaceReducer,
  createArtDirectionWorkspace,
  replaceArtPresetCommand,
  replaceSelectedArtRuleCommand,
  selectedArtDirectionRule,
} from "./art-workspace.js";
import { studioProject } from "./fixture.js";
import "./art-direction.css";

type ArtDispatch = Dispatch<ArtDirectionWorkspaceAction>;

const PRESETS: readonly { readonly id: ArtPreset; readonly label: string }[] = [
  { id: "ega-16-320x200", label: "EGA · 16" },
  { id: "vga-256-320x200", label: "VGA · 256" },
  { id: "rgba-pixel", label: "RGBA Pixel" },
  { id: "custom", label: "Custom" },
];

const ROLES: readonly ArtAssetRole[] = [
  "background",
  "actor",
  "object",
  "ui",
  "cursor",
  "font",
  "palette",
  "audio",
  "video",
  "other",
];

const Button = ({
  children,
  onClick,
  disabled = false,
  className = "",
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly className?: string;
}) => (
  <button type="button" className={`button ${className}`} disabled={disabled} onClick={onClick}>
    {children}
  </button>
);

const Field = ({ label, children }: { readonly label: string; readonly children: ReactNode }) => (
  <div className="field">
    <span>{label}</span>
    {children}
  </div>
);

const NumberInput = ({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
}) => (
  <input
    type="number"
    min={min}
    max={max}
    step={step}
    value={value}
    onChange={(event) => {
      const parsed = Number(event.currentTarget.value);
      if (!Number.isFinite(parsed)) return;
      const resolved = step >= 1 ? Math.round(parsed) : parsed;
      onChange(Math.min(max, Math.max(min, resolved)));
    }}
  />
);

const CommitTextarea = ({
  value,
  onCommit,
}: {
  readonly value: string;
  readonly onCommit: (value: string) => void;
}) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <textarea
      rows={4}
      value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
    />
  );
};

const shortId = (value: string): string => value.split(".").at(-1) ?? value;

const downloadManifest = (state: ArtDirectionWorkspaceState): void => {
  const manifest = state.history.document.manifest;
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(manifest, null, 2)}\n`], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${manifest.projectId}.art-direction.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const withoutExpectedSize = (rule: ArtAssetRule): ArtAssetRule => {
  const { expectedSize: _expectedSize, ...rest } = rule;
  return rest;
};

const withoutMaxColours = (rule: ArtAssetRule): ArtAssetRule => {
  const { maxColours: _maxColours, ...rest } = rule;
  return rest;
};

const withoutDither = (rule: ArtAssetRule): ArtAssetRule => {
  const { dither: _dither, ...rest } = rule;
  return rest;
};

const withoutNotes = (rule: ArtAssetRule): ArtAssetRule => {
  const { notes: _notes, ...rest } = rule;
  return rest;
};

const paletteSwatches = (profile: ArtDirectionProfile): readonly string[] => {
  const count = Math.min(32, profile.palette.maxColours);
  if (profile.preset === "ega-16-320x200") {
    return [
      "#000000",
      "#0000aa",
      "#00aa00",
      "#00aaaa",
      "#aa0000",
      "#aa00aa",
      "#aa5500",
      "#aaaaaa",
      "#555555",
      "#5555ff",
      "#55ff55",
      "#55ffff",
      "#ff5555",
      "#ff55ff",
      "#ffff55",
      "#ffffff",
    ];
  }
  return Array.from(
    { length: count },
    (_, index) => `hsl(${Math.round((index * 330) / Math.max(1, count - 1))} 62% ${24 + (index % 4) * 13}%)`,
  );
};

const evidenceSummary = (
  state: ArtDirectionWorkspaceState,
  assetId: Id<"asset">,
): readonly { readonly label: string; readonly value: string }[] => {
  const asset = state.compiledEvidence?.assets.find((candidate) => candidate.assetId === assetId);
  if (!asset) return [{ label: "Evidence", value: "missing" }];
  if (asset.kind === "image") {
    return [
      {
        label: "Compiled size",
        value: `${asset.metadata.width} × ${asset.metadata.height}`,
      },
      {
        label: "Output",
        value: asset.metadata.palette ? "indexed PNG" : "RGBA PNG",
      },
      { label: "Colours", value: String(asset.metadata.colourCount) },
      { label: "Bytes", value: String(asset.outputFiles[0]?.byteLength ?? 0) },
    ];
  }
  if (asset.kind === "spritesheet") {
    const minimumPadding = Math.min(...asset.metadata.frames.map((frame) => frame.padding));
    return [
      { label: "Atlas pages", value: String(asset.metadata.pages.length) },
      { label: "Frames", value: String(asset.metadata.frames.length) },
      { label: "Min padding", value: `${minimumPadding}px` },
      {
        label: "Page size",
        value: `${asset.metadata.pages[0]?.width ?? 0} × ${asset.metadata.pages[0]?.height ?? 0}`,
      },
    ];
  }
  return [
    { label: "Kind", value: asset.kind },
    { label: "Outputs", value: String(asset.outputFiles.length) },
  ];
};

const RuleInspector = ({
  state,
  execute,
}: {
  readonly state: ArtDirectionWorkspaceState;
  readonly execute: (command: ArtDirectionEditorCommand, notice?: string) => void;
}) => {
  const rule = selectedArtDirectionRule(state);
  const profile = state.history.document.manifest.profile;
  const projectAsset = state.project.assets.find((asset) => asset.id === rule.assetId);
  const issues = artDirectionIssuesForAsset(state, rule.assetId);

  const replaceRule = (next: ArtAssetRule, notice: string): void =>
    execute(replaceSelectedArtRuleCommand(state, next), notice);

  const resolvedMax = rule.maxColours ?? profile.palette.maxColours;
  const resolvedDither = rule.dither ?? profile.palette.dither;

  return (
    <aside className="sidebar inspector-sidebar art-inspector">
      <div className="inspector-heading">
        <span className="eyebrow">ASSET POLICY</span>
        <h2>{shortId(rule.assetId)}</h2>
        <code>{projectAsset?.path ?? rule.assetId}</code>
      </div>

      <div className="inspector-form">
        <section>
          <h3>Purpose and output</h3>
          <Field label="Role">
            <select
              value={rule.role}
              onChange={(event) =>
                replaceRule(
                  {
                    ...rule,
                    role: event.currentTarget.value as ArtAssetRole,
                  },
                  "Updated asset role.",
                )
              }
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Output mode">
            <select
              value={rule.outputMode}
              onChange={(event) =>
                replaceRule(
                  {
                    ...rule,
                    outputMode: event.currentTarget.value as ArtAssetRule["outputMode"],
                  },
                  "Updated output mode.",
                )
              }
            >
              <option value="inherit">Inherit profile</option>
              <option value="indexed">Indexed colour</option>
              <option value="rgba">RGBA</option>
            </select>
          </Field>
          <Field label="Transparency">
            <select
              value={rule.transparency}
              onChange={(event) =>
                replaceRule(
                  {
                    ...rule,
                    transparency: event.currentTarget.value as ArtAssetRule["transparency"],
                  },
                  "Updated transparency policy.",
                )
              }
            >
              <option value="inherit">Inherit profile</option>
              <option value="opaque">Opaque</option>
              <option value="binary">Binary alpha</option>
              <option value="full">Full alpha</option>
            </select>
          </Field>
          <Field label="Trim mode">
            <select
              value={rule.trimMode}
              onChange={(event) =>
                replaceRule(
                  {
                    ...rule,
                    trimMode: event.currentTarget.value as ArtAssetRule["trimMode"],
                  },
                  "Updated trim policy.",
                )
              }
            >
              <option value="none">Never trim</option>
              <option value="alpha">Alpha trim</option>
              <option value="either">Either</option>
            </select>
          </Field>
        </section>

        <section>
          <h3>Palette budget</h3>
          <label className="toggle-row">
            <span>Use profile colour limit</span>
            <input
              type="checkbox"
              checked={rule.maxColours === undefined}
              onChange={(event) =>
                replaceRule(
                  event.currentTarget.checked
                    ? withoutMaxColours(rule)
                    : { ...rule, maxColours: resolvedMax },
                  "Updated colour-budget inheritance.",
                )
              }
            />
          </label>
          <Field label="Maximum colours">
            <NumberInput
              value={resolvedMax}
              min={2}
              max={
                rule.outputMode === "rgba" ||
                (rule.outputMode === "inherit" && profile.palette.mode === "rgba")
                  ? 16_777_216
                  : 256
              }
              onChange={(maxColours) => replaceRule({ ...rule, maxColours }, "Updated asset colour budget.")}
            />
          </Field>
          <label className="toggle-row">
            <span>Use profile dithering</span>
            <input
              type="checkbox"
              checked={rule.dither === undefined}
              onChange={(event) =>
                replaceRule(
                  event.currentTarget.checked ? withoutDither(rule) : { ...rule, dither: resolvedDither },
                  "Updated dithering inheritance.",
                )
              }
            />
          </label>
          <Field label={`Dither ${resolvedDither.toFixed(2)}`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={resolvedDither}
              onChange={(event) =>
                replaceRule(
                  { ...rule, dither: Number(event.currentTarget.value) },
                  "Updated asset dithering.",
                )
              }
            />
          </Field>
        </section>

        <section>
          <h3>Geometry and sampling</h3>
          <Field label="Size policy">
            <select
              value={rule.sizePolicy}
              onChange={(event) => {
                const policy = event.currentTarget.value as ArtAssetRule["sizePolicy"];
                replaceRule(
                  policy === "any"
                    ? withoutExpectedSize({ ...rule, sizePolicy: policy })
                    : {
                        ...rule,
                        sizePolicy: policy,
                        expectedSize: rule.expectedSize ?? profile.nativeSize,
                      },
                  "Updated asset size policy.",
                );
              }}
            >
              <option value="any">Any dimensions</option>
              <option value="exact">Exact dimensions</option>
              <option value="minimum">Minimum dimensions</option>
            </select>
          </Field>
          {rule.sizePolicy !== "any" ? (
            <div className="field-grid two-columns">
              <Field label="Width">
                <NumberInput
                  value={rule.expectedSize?.width ?? profile.nativeSize.width}
                  min={1}
                  max={16_384}
                  onChange={(width) =>
                    replaceRule(
                      {
                        ...rule,
                        expectedSize: {
                          width,
                          height: rule.expectedSize?.height ?? profile.nativeSize.height,
                        },
                      },
                      "Updated expected width.",
                    )
                  }
                />
              </Field>
              <Field label="Height">
                <NumberInput
                  value={rule.expectedSize?.height ?? profile.nativeSize.height}
                  min={1}
                  max={16_384}
                  onChange={(height) =>
                    replaceRule(
                      {
                        ...rule,
                        expectedSize: {
                          width: rule.expectedSize?.width ?? profile.nativeSize.width,
                          height,
                        },
                      },
                      "Updated expected height.",
                    )
                  }
                />
              </Field>
            </div>
          ) : null}
          <label className="toggle-row">
            <span>Nearest sampling only</span>
            <input
              type="checkbox"
              checked={rule.nearestOnly}
              onChange={(event) =>
                replaceRule(
                  { ...rule, nearestOnly: event.currentTarget.checked },
                  "Updated sampling requirement.",
                )
              }
            />
          </label>
          <label className="toggle-row">
            <span>Allow resampling</span>
            <input
              type="checkbox"
              checked={rule.allowResample}
              onChange={(event) =>
                replaceRule(
                  { ...rule, allowResample: event.currentTarget.checked },
                  "Updated resize permission.",
                )
              }
            />
          </label>
          <Field label="Minimum atlas padding">
            <NumberInput
              value={rule.atlasPaddingMinimum}
              min={0}
              max={64}
              onChange={(atlasPaddingMinimum) =>
                replaceRule({ ...rule, atlasPaddingMinimum }, "Updated atlas padding requirement.")
              }
            />
          </Field>
        </section>

        <section>
          <h3>Production notes</h3>
          <CommitTextarea
            value={rule.notes ?? ""}
            onCommit={(value) =>
              replaceRule(
                value.trim() ? { ...rule, notes: value } : withoutNotes(rule),
                "Updated art-direction notes.",
              )
            }
          />
        </section>
      </div>

      <div className="art-inspector-issues">
        <span>{issues.length} diagnostics</span>
        {issues.slice(0, 5).map((entry) => (
          <div key={`${entry.code}:${entry.path}`} className={entry.severity}>
            <strong>{entry.code}</strong>
            <small>{entry.message}</small>
          </div>
        ))}
      </div>
    </aside>
  );
};

export const ArtDirectionApp = () => {
  const [state, dispatch] = useReducer(
    artDirectionWorkspaceReducer,
    createArtDirectionWorkspace(studioProject, studioCompiledArtEvidence, studioArtDirectionManifest),
  );
  const manifest = state.history.document.manifest;
  const profile = manifest.profile;
  const rule = selectedArtDirectionRule(state);
  const issues = artDirectionWorkspaceIssues(state);
  const dirty = artDirectionWorkspaceIsDirty(state);
  const errorCount = issues.filter((entry) => entry.severity === "error").length;
  const warningCount = issues.filter((entry) => entry.severity === "warning").length;
  const evidence = evidenceSummary(state, rule.assetId);
  const swatches = useMemo(() => paletteSwatches(profile), [profile]);

  const execute = useCallback(
    (command: ArtDirectionEditorCommand, notice?: string): void => {
      try {
        applyArtDirectionEditorCommand(state.project, manifest, command);
        dispatch({ type: "execute", command, ...(notice ? { notice } : {}) });
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Art direction edit failed.");
      }
    },
    [manifest, state.project],
  );

  const save = useCallback(() => {
    downloadManifest(state);
    dispatch({ type: "mark-saved" });
  }, [state]);

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
    <div className="studio-app art-direction-app">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">E</span>
          <span>
            <strong>EVAVO</strong>
            <small>ADVENTURE STUDIO</small>
          </span>
        </div>
        <div className="document-title">
          <span>{profile.name}</span>
          <strong>Art Direction &amp; Asset Evidence</strong>
          {dirty ? <i>●</i> : null}
        </div>
        <div className="topbar-actions">
          <Button onClick={save} className="primary-button">
            Export Art Policy
          </Button>
        </div>
      </header>

      <div className="toolbar art-toolbar">
        <div className="toolbar-group">
          <Button onClick={() => dispatch({ type: "undo" })} disabled={state.history.undoStack.length === 0}>
            ↶
          </Button>
          <Button onClick={() => dispatch({ type: "redo" })} disabled={state.history.redoStack.length === 0}>
            ↷
          </Button>
        </div>
        <div className="art-profile-tabs">
          {PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.id}
              className={profile.preset === preset.id ? "is-active" : ""}
              onClick={() =>
                execute(replaceArtPresetCommand(state, preset.id), `Applied ${preset.label} art profile.`)
              }
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="toolbar-group art-health">
          <span className={errorCount > 0 ? "has-errors" : "is-clear"}>{errorCount} errors</span>
          <span className={warningCount > 0 ? "has-warnings" : "is-clear"}>{warningCount} warnings</span>
        </div>
      </div>

      <main className="workspace-grid art-grid">
        <aside className="sidebar art-asset-library">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ASSET POLICY</span>
              <h2>{manifest.assets.length} assets</h2>
            </div>
          </div>
          <div className="art-asset-list">
            {manifest.assets.map((candidate) => {
              const assetIssues = artDirectionIssuesForAsset(state, candidate.assetId);
              const errors = assetIssues.filter((entry) => entry.severity === "error").length;
              const warnings = assetIssues.length - errors;
              const projectAsset = state.project.assets.find((asset) => asset.id === candidate.assetId);
              return (
                <button
                  type="button"
                  key={candidate.assetId}
                  className={`art-asset-row ${candidate.assetId === rule.assetId ? "is-active" : ""}`}
                  onClick={() =>
                    dispatch({
                      type: "select-asset",
                      assetId: candidate.assetId,
                    })
                  }
                >
                  <span className={`asset-role role-${candidate.role}`}>{candidate.role.slice(0, 2)}</span>
                  <span>
                    <strong>{shortId(candidate.assetId)}</strong>
                    <small>
                      {projectAsset?.kind ?? "unknown"} · {candidate.outputMode}
                    </small>
                  </span>
                  <em className={errors > 0 ? "has-errors" : warnings > 0 ? "has-warnings" : "is-clear"}>
                    {errors > 0 ? errors : warnings > 0 ? warnings : "✓"}
                  </em>
                </button>
              );
            })}
          </div>
          <div className="sidebar-footer">
            <span className={`save-indicator ${dirty ? "is-dirty" : ""}`} />
            <span>{dirty ? "UNSAVED POLICY" : "POLICY SYNCHRONIZED"}</span>
          </div>
        </aside>

        <section className="art-dashboard">
          <div className="art-profile-summary">
            <div>
              <span className="eyebrow">ERA PROFILE</span>
              <h1>{profile.name}</h1>
              <p>
                {profile.nativeSize.width} × {profile.nativeSize.height} · {profile.pixelAspect} pixels ·
                fixed logical ticks
              </p>
            </div>
            <div className="art-profile-metrics">
              <div>
                <span>Palette mode</span>
                <strong>{profile.palette.mode}</strong>
              </div>
              <div>
                <span>Colour budget</span>
                <strong>{profile.palette.maxColours}</strong>
              </div>
              <div>
                <span>Dither</span>
                <strong>{profile.palette.dither.toFixed(2)}</strong>
              </div>
              <div>
                <span>Alpha</span>
                <strong>{profile.transparency}</strong>
              </div>
            </div>
          </div>

          <div className="palette-board">
            <div className="palette-heading">
              <div>
                <span className="eyebrow">PALETTE LANGUAGE</span>
                <h2>{swatches.length} representative entries</h2>
              </div>
              <span>
                {profile.palette.reserveTransparentIndex
                  ? "transparent index reserved"
                  : "RGBA alpha channel"}
              </span>
            </div>
            <div className="palette-grid">
              {swatches.map((color, index) => (
                <span
                  key={`${color}:${index}`}
                  style={{ background: color }}
                  title={`Palette sample ${index}`}
                />
              ))}
            </div>
          </div>

          <div className="compiled-evidence-card">
            <div className="compiled-evidence-heading">
              <div>
                <span className="eyebrow">COMPILED EVIDENCE</span>
                <h2>{shortId(rule.assetId)}</h2>
              </div>
              <code>{rule.role}</code>
            </div>
            <div className="compiled-evidence-grid">
              {evidence.map((entry) => (
                <div key={entry.label}>
                  <span>{entry.label}</span>
                  <strong>{entry.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="art-diagnostics-panel">
            <div className="art-diagnostics-heading">
              <div>
                <span className="eyebrow">QUALITY GATES</span>
                <h2>{issues.length} diagnostics</h2>
              </div>
              <span>
                {errorCount > 0 ? "compile blocked" : warningCount > 0 ? "review required" : "ready"}
              </span>
            </div>
            <div className="art-diagnostics-list">
              {issues.length === 0 ? (
                <div className="art-diagnostic-empty">
                  All authored policy and compiled evidence checks pass.
                </div>
              ) : (
                issues.slice(0, 12).map((entry) => (
                  <div
                    key={`${entry.code}:${entry.path}:${entry.message}`}
                    className={`art-diagnostic ${entry.severity}`}
                  >
                    <span>{entry.severity === "error" ? "!" : "△"}</span>
                    <div>
                      <strong>{entry.code}</strong>
                      <p>{entry.message}</p>
                      <code>{entry.path}</code>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <RuleInspector state={state} execute={execute} />
      </main>

      <footer className="statusbar">
        <span>
          <i className={`status-dot ${errorCount > 0 ? "is-warning" : ""}`} />
          {errorCount > 0
            ? "Art direction has blocking errors"
            : "Art direction evidence is structurally ready"}
        </span>
        <span>{state.notice ?? "Policies compile against verified asset manifests"}</span>
        <span>revision {state.history.document.operationRevision}</span>
      </footer>
    </div>
  );
};
