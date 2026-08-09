import type { BitmapFontDefinition, BitmapGlyph, BitmapKerning } from "@evavo/adventure-bitmap-font";
import type { BitmapFontEditorCommand } from "@evavo/adventure-bitmap-font-editor-core";
import { type Dispatch, type ReactNode, useCallback, useEffect, useMemo, useReducer } from "react";
import { studioBitmapFonts, studioFontProject } from "./font-fixture.js";
import {
  type BitmapFontWorkspaceAction,
  type BitmapFontWorkspaceState,
  bitmapFontPreviewLayout,
  bitmapFontWorkspaceIsDirty,
  bitmapFontWorkspaceReducer,
  createBitmapFontWorkspace,
  insertBitmapGlyphCommand,
  insertKerningCommand,
  removeSelectedGlyphCommand,
  replaceSelectedFontCommand,
  replaceSelectedGlyphCommand,
  selectedBitmapFont,
  selectedBitmapGlyph,
} from "./font-workspace.js";
import "./font-editor.css";

type FontDispatch = Dispatch<BitmapFontWorkspaceAction>;

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
  minimum,
  maximum,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly minimum?: number;
  readonly maximum?: number;
}) => (
  <input
    type="number"
    value={value}
    {...(minimum === undefined ? {} : { min: minimum })}
    {...(maximum === undefined ? {} : { max: maximum })}
    onChange={(event) => {
      const next = Number(event.currentTarget.value);
      if (Number.isSafeInteger(next)) onChange(next);
    }}
  />
);

const displayCharacter = (codePoint: number): string => {
  if (codePoint === 32) return "␠";
  const value = String.fromCodePoint(codePoint);
  return /\s/u.test(value) ? `U+${codePoint.toString(16).toUpperCase()}` : value;
};

const codePointLabel = (codePoint: number): string =>
  `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;

const downloadManifest = (state: BitmapFontWorkspaceState): void => {
  const manifest = state.history.document.manifest;
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(manifest, null, 2)}\n`], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "bitmap-fonts.json";
  anchor.click();
  URL.revokeObjectURL(url);
};

const executeSafely = (
  state: BitmapFontWorkspaceState,
  dispatch: FontDispatch,
  command: BitmapFontEditorCommand,
  notice: string,
): void => {
  try {
    dispatch({ type: "execute", command, notice });
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "Bitmap font edit failed.");
  }
};

const FontMetrics = ({
  state,
  dispatch,
}: {
  readonly state: BitmapFontWorkspaceState;
  readonly dispatch: FontDispatch;
}) => {
  const font = selectedBitmapFont(state);
  const replace = (next: BitmapFontDefinition): void =>
    executeSafely(state, dispatch, replaceSelectedFontCommand(state, next), "Updated bitmap font metrics.");

  return (
    <section className="font-metrics-card">
      <div className="font-section-heading">
        <div>
          <span className="eyebrow">FONT METRICS</span>
          <h3>{font.name}</h3>
        </div>
        <code>{font.atlasAssetId}</code>
      </div>
      <div className="font-metric-grid">
        <Field label="Line height">
          <NumberInput
            value={font.lineHeight}
            minimum={1}
            onChange={(lineHeight) => replace({ ...font, lineHeight })}
          />
        </Field>
        <Field label="Baseline">
          <NumberInput
            value={font.baseline}
            minimum={0}
            onChange={(baseline) => replace({ ...font, baseline })}
          />
        </Field>
        <Field label="Space advance">
          <NumberInput
            value={font.spaceAdvance}
            minimum={0}
            onChange={(spaceAdvance) => replace({ ...font, spaceAdvance })}
          />
        </Field>
        <Field label="Letter spacing">
          <NumberInput
            value={font.letterSpacing}
            onChange={(letterSpacing) => replace({ ...font, letterSpacing })}
          />
        </Field>
      </div>
    </section>
  );
};

const GlyphInspector = ({
  state,
  dispatch,
}: {
  readonly state: BitmapFontWorkspaceState;
  readonly dispatch: FontDispatch;
}) => {
  const font = selectedBitmapFont(state);
  const glyph = selectedBitmapGlyph(state);
  const replace = (next: BitmapGlyph): void =>
    executeSafely(state, dispatch, replaceSelectedGlyphCommand(state, next), "Updated bitmap glyph metrics.");
  const makeFallback = (): void =>
    executeSafely(
      state,
      dispatch,
      replaceSelectedFontCommand(state, {
        ...font,
        fallbackCodePoint: glyph.codePoint,
      }),
      "Changed fallback glyph.",
    );

  return (
    <aside className="sidebar inspector-sidebar font-inspector">
      <div className="inspector-heading">
        <span className="eyebrow">GLYPH INSPECTOR</span>
        <h2>{displayCharacter(glyph.codePoint)}</h2>
        <code>{codePointLabel(glyph.codePoint)}</code>
      </div>
      <div className="font-glyph-stage">
        <div
          className="font-glyph-silhouette"
          style={{
            width: `${Math.max(1, glyph.sourceRect.width) * 8}px`,
            height: `${Math.max(1, glyph.sourceRect.height) * 8}px`,
          }}
        >
          {displayCharacter(glyph.codePoint)}
        </div>
        <span>native source rectangle × 8</span>
      </div>
      <div className="inspector-form">
        <section>
          <h3>Identity</h3>
          <Field label="Code point">
            <NumberInput
              value={glyph.codePoint}
              minimum={0}
              maximum={0x10ffff}
              onChange={(codePoint) => replace({ ...glyph, codePoint })}
            />
          </Field>
          <Button onClick={makeFallback} disabled={font.fallbackCodePoint === glyph.codePoint}>
            {font.fallbackCodePoint === glyph.codePoint ? "Current fallback" : "Use as fallback"}
          </Button>
        </section>
        <section>
          <h3>Source rectangle</h3>
          <div className="field-grid two-columns">
            <Field label="X">
              <NumberInput
                value={glyph.sourceRect.x}
                minimum={0}
                onChange={(x) =>
                  replace({
                    ...glyph,
                    sourceRect: { ...glyph.sourceRect, x },
                  })
                }
              />
            </Field>
            <Field label="Y">
              <NumberInput
                value={glyph.sourceRect.y}
                minimum={0}
                onChange={(y) =>
                  replace({
                    ...glyph,
                    sourceRect: { ...glyph.sourceRect, y },
                  })
                }
              />
            </Field>
            <Field label="Width">
              <NumberInput
                value={glyph.sourceRect.width}
                minimum={1}
                onChange={(width) =>
                  replace({
                    ...glyph,
                    sourceRect: { ...glyph.sourceRect, width },
                  })
                }
              />
            </Field>
            <Field label="Height">
              <NumberInput
                value={glyph.sourceRect.height}
                minimum={1}
                onChange={(height) =>
                  replace({
                    ...glyph,
                    sourceRect: { ...glyph.sourceRect, height },
                  })
                }
              />
            </Field>
          </div>
        </section>
        <section>
          <h3>Placement metrics</h3>
          <div className="field-grid two-columns">
            <Field label="Bearing X">
              <NumberInput
                value={glyph.bearing.x}
                onChange={(x) => replace({ ...glyph, bearing: { ...glyph.bearing, x } })}
              />
            </Field>
            <Field label="Bearing Y">
              <NumberInput
                value={glyph.bearing.y}
                onChange={(y) => replace({ ...glyph, bearing: { ...glyph.bearing, y } })}
              />
            </Field>
          </div>
          <Field label="Advance">
            <NumberInput
              value={glyph.advance}
              minimum={0}
              onChange={(advance) => replace({ ...glyph, advance })}
            />
          </Field>
        </section>
      </div>
    </aside>
  );
};

const KerningPanel = ({
  state,
  dispatch,
}: {
  readonly state: BitmapFontWorkspaceState;
  readonly dispatch: FontDispatch;
}) => {
  const font = selectedBitmapFont(state);
  const glyph = selectedBitmapGlyph(state);
  const pairs = font.kernings.filter((kerning) => kerning.leftCodePoint === glyph.codePoint);
  const replace = (previous: BitmapKerning, next: BitmapKerning): void =>
    executeSafely(
      state,
      dispatch,
      {
        kind: "replace-kerning",
        fontId: font.id,
        leftCodePoint: previous.leftCodePoint,
        rightCodePoint: previous.rightCodePoint,
        kerning: next,
      },
      "Updated kerning adjustment.",
    );
  const remove = (kerning: BitmapKerning): void =>
    executeSafely(
      state,
      dispatch,
      {
        kind: "remove-kerning",
        fontId: font.id,
        leftCodePoint: kerning.leftCodePoint,
        rightCodePoint: kerning.rightCodePoint,
      },
      "Removed kerning pair.",
    );

  return (
    <section className="font-kerning-panel">
      <div className="font-section-heading">
        <div>
          <span className="eyebrow">KERNING</span>
          <h3>{displayCharacter(glyph.codePoint)} pairs</h3>
        </div>
        <Button
          onClick={() => executeSafely(state, dispatch, insertKerningCommand(state), "Added kerning pair.")}
        >
          ＋ Pair
        </Button>
      </div>
      <div className="font-kerning-list">
        {pairs.length === 0 ? (
          <p>No authored kerning pairs begin with this glyph.</p>
        ) : (
          pairs.map((kerning) => (
            <div key={`${kerning.leftCodePoint}:${kerning.rightCodePoint}`} className="font-kerning-row">
              <strong>
                {displayCharacter(kerning.leftCodePoint)}
                {displayCharacter(kerning.rightCodePoint)}
              </strong>
              <NumberInput
                value={kerning.adjustment}
                onChange={(adjustment) => replace(kerning, { ...kerning, adjustment })}
              />
              <button type="button" onClick={() => remove(kerning)}>
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export const FontApp = () => {
  const [state, dispatch] = useReducer(
    bitmapFontWorkspaceReducer,
    createBitmapFontWorkspace(studioFontProject, studioBitmapFonts),
  );
  const font = selectedBitmapFont(state);
  const glyph = selectedBitmapGlyph(state);
  const layout = useMemo(() => bitmapFontPreviewLayout(state), [state]);
  const dirty = bitmapFontWorkspaceIsDirty(state);

  const save = useCallback(() => {
    downloadManifest(state);
    dispatch({ type: "mark-saved" });
  }, [state]);

  const addGlyph = (): void => {
    try {
      const addition = insertBitmapGlyphCommand(state);
      dispatch({
        type: "execute",
        command: addition.command,
        selectedGlyphId: addition.glyphId,
        notice: "Added bitmap glyph.",
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Glyph creation failed.");
    }
  };

  const removeGlyph = (): void =>
    executeSafely(state, dispatch, removeSelectedGlyphCommand(state), "Removed bitmap glyph.");

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
    <div className="studio-app font-app">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">E</span>
          <span>
            <strong>EVAVO</strong>
            <small>ADVENTURE STUDIO</small>
          </span>
        </div>
        <div className="document-title">
          <span>{font.name}</span>
          <strong>Bitmap Font</strong>
          {dirty ? <i>●</i> : null}
        </div>
        <div className="topbar-actions">
          <Button onClick={save} className="primary-button">
            Export Fonts
          </Button>
        </div>
      </header>

      <div className="toolbar font-toolbar">
        <div className="toolbar-group">
          <Button onClick={() => dispatch({ type: "undo" })} disabled={state.history.undoStack.length === 0}>
            ↶
          </Button>
          <Button onClick={() => dispatch({ type: "redo" })} disabled={state.history.redoStack.length === 0}>
            ↷
          </Button>
        </div>
        <div className="font-toolbar-title">
          <span className="eyebrow">NATIVE BITMAP TYPE</span>
          <strong>
            {font.glyphs.length} glyphs · {font.kernings.length} pairs
          </strong>
        </div>
        <div className="toolbar-group">
          <Button onClick={addGlyph}>＋ Glyph</Button>
          <Button onClick={removeGlyph}>⌫</Button>
        </div>
      </div>

      <main className="workspace-grid font-workspace-grid">
        <aside className="sidebar font-glyph-sidebar">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">GLYPH SET</span>
              <h2>{font.name}</h2>
            </div>
          </div>
          <div className="font-glyph-grid">
            {font.glyphs
              .slice()
              .sort((left, right) => left.codePoint - right.codePoint)
              .map((candidate) => (
                <button
                  type="button"
                  key={candidate.id}
                  className={candidate.id === glyph.id ? "is-active" : undefined}
                  title={`${displayCharacter(candidate.codePoint)} ${codePointLabel(candidate.codePoint)}`}
                  onClick={() => dispatch({ type: "select-glyph", glyphId: candidate.id })}
                >
                  <strong>{displayCharacter(candidate.codePoint)}</strong>
                  <small>{candidate.advance}px</small>
                </button>
              ))}
          </div>
          <div className="sidebar-footer">
            <span className={`save-indicator ${dirty ? "is-dirty" : ""}`} />
            <span>{dirty ? "UNSAVED FONT" : "FONT SAVED"}</span>
          </div>
        </aside>

        <section className="font-canvas-column">
          <FontMetrics state={state} dispatch={dispatch} />
          <section className="font-preview-card">
            <div className="font-section-heading">
              <div>
                <span className="eyebrow">NATIVE PREVIEW</span>
                <h3>{state.previewWidth}px wrap width</h3>
              </div>
              <span>
                {layout.lines.length} line{layout.lines.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="font-preview-controls">
              <input
                value={state.previewText}
                onChange={(event) =>
                  dispatch({
                    type: "set-preview-text",
                    text: event.currentTarget.value,
                  })
                }
              />
              <input
                type="range"
                min="64"
                max="300"
                value={state.previewWidth}
                onChange={(event) =>
                  dispatch({
                    type: "set-preview-width",
                    width: Number(event.currentTarget.value),
                  })
                }
              />
            </div>
            <div className="font-preview-scroll">
              <div
                className="font-native-surface"
                style={{
                  width: `${layout.width}px`,
                  height: `${Math.max(font.lineHeight, layout.height)}px`,
                }}
              >
                {layout.placements.map((placement, index) => (
                  <span
                    key={`${placement.glyphId}:${index}`}
                    className="font-preview-placement"
                    style={{
                      left: `${placement.x}px`,
                      top: `${placement.y}px`,
                      width: `${placement.glyph.sourceRect.width}px`,
                      height: `${placement.glyph.sourceRect.height}px`,
                    }}
                  >
                    {displayCharacter(placement.codePoint)}
                  </span>
                ))}
                {layout.lines.map((line) => (
                  <span
                    key={line.index}
                    className="font-preview-baseline"
                    style={{ top: `${line.y + font.baseline}px` }}
                  />
                ))}
              </div>
            </div>
            {layout.fallbackCodePoints.length > 0 ? (
              <p className="font-fallback-warning">
                Fallback used for {layout.fallbackCodePoints.map(codePointLabel).join(", ")}
              </p>
            ) : null}
          </section>
          <KerningPanel state={state} dispatch={dispatch} />
          {state.notice ? <div className="workspace-notice">{state.notice}</div> : null}
        </section>

        <GlyphInspector state={state} dispatch={dispatch} />
      </main>
    </div>
  );
};
