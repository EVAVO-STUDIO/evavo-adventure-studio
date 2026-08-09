import type { Id } from "@evavo/adventure-project-schema";
import type {
  BitmapTextRenderNode,
  RenderNode,
  SolidRectangleRenderNode,
  SpriteRenderNode,
} from "@evavo/adventure-render-contract";
import type { UiSkin, UiVerb } from "@evavo/adventure-ui-skin";
import type { UiSkinEditorCommand } from "@evavo/adventure-ui-skin-editor-core";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { studioUiBitmapFonts, studioUiProject, studioUiSkins } from "./ui-skin-fixture.js";
import {
  createUiSkinWorkspace,
  insertUiVerbCommand,
  replaceSelectedUiSkinCommand,
  replaceUiVerbCommand,
  selectedUiSkin,
  type UiSkinWorkspaceAction,
  type UiSkinWorkspaceState,
  uiSkinIssuesForSelectedSkin,
  uiSkinWorkspaceIsDirty,
  uiSkinWorkspacePreviewNodes,
  uiSkinWorkspaceReducer,
} from "./ui-skin-workspace.js";
import "./ui-skin.css";

type UiDispatch = React.Dispatch<UiSkinWorkspaceAction>;

const MODE_LABELS: Readonly<Record<UiSkin["interactionMode"], string>> = {
  "icon-bar": "Icon Bar",
  "verb-list": "Verb List",
  "verb-coin": "Verb Coin",
  "two-button": "Two Button",
  context: "Context",
  "parser-assisted": "Parser",
};

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
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min: number;
  readonly max: number;
}) => (
  <input
    type="number"
    value={value}
    min={min}
    max={max}
    onChange={(event) => {
      const parsed = Number(event.currentTarget.value);
      if (!Number.isFinite(parsed)) return;
      onChange(Math.min(max, Math.max(min, Math.round(parsed))));
    }}
  />
);

const CommitInput = ({
  value,
  onCommit,
}: {
  readonly value: string;
  readonly onCommit: (value: string) => void;
}) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => {
        const resolved = draft.trim();
        if (resolved && resolved !== value) onCommit(resolved);
        else setDraft(value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
};

const packedColor = (value: number): string => `#${value.toString(16).padStart(6, "0")}`;

const colorCss = (color: number | readonly [number, number, number, number]): string =>
  typeof color === "number"
    ? packedColor(color)
    : `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;

const nodeStyle = (node: RenderNode): CSSProperties => ({
  position: "absolute",
  left: node.transform.position.x,
  top: node.transform.position.y,
  opacity: node.opacity,
  transformOrigin: `${node.transform.pivot.x}px ${node.transform.pivot.y}px`,
  transform: `scale(${node.transform.scale.x}, ${node.transform.scale.y}) rotate(${node.transform.rotationRadians}rad)`,
  zIndex: 100 + Math.round(node.order.zOffset),
  display: node.visible ? undefined : "none",
});

const PreviewNode = ({ node }: { readonly node: RenderNode }) => {
  if (node.kind === "solid-rectangle") {
    const rectangle = node as SolidRectangleRenderNode;
    return (
      <div
        className="ui-preview-rectangle"
        style={{
          ...nodeStyle(node),
          width: rectangle.size.width,
          height: rectangle.size.height,
          background: colorCss(rectangle.color),
        }}
      />
    );
  }
  if (node.kind === "bitmap-text") {
    const text = node as BitmapTextRenderNode;
    return (
      <div
        className="ui-preview-text"
        style={{
          ...nodeStyle(node),
          width: text.maximumWidth,
          lineHeight: `${text.lineHeight}px`,
          color: colorCss(text.color),
          textAlign: text.align,
          textShadow:
            text.outlineColor === undefined
              ? undefined
              : `-1px -1px ${colorCss(text.outlineColor)}, 1px 1px ${colorCss(text.outlineColor)}`,
        }}
      >
        {text.text}
      </div>
    );
  }
  if (node.kind === "sprite") {
    const sprite = node as SpriteRenderNode;
    return (
      <div
        className="ui-preview-sprite"
        title={`${sprite.assetId}${sprite.frameId ? ` / ${sprite.frameId}` : ""}`}
        style={{
          ...nodeStyle(node),
          width: sprite.originalSize.width,
          height: sprite.originalSize.height,
        }}
      >
        {String(sprite.assetId).includes("key") ? "K" : "◆"}
      </div>
    );
  }
  return null;
};

const downloadManifest = (state: UiSkinWorkspaceState): void => {
  const manifest = state.history.document.manifest;
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(manifest, null, 2)}\n`], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${manifest.projectId}.ui-skins.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const RegionEditor = ({
  title,
  skin,
  rect,
  padding,
  execute,
  update,
}: {
  readonly title: string;
  readonly skin: UiSkin;
  readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly padding: number;
  readonly execute: (command: UiSkinEditorCommand, notice?: string) => void;
  readonly update: (
    rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
    padding: number,
  ) => UiSkin;
}) => {
  const commit = (
    nextRect = rect,
    nextPadding = padding,
    notice = `Updated ${title.toLocaleLowerCase("en-US")} region.`,
  ): void =>
    execute(
      {
        kind: "replace-skin",
        skinId: skin.id,
        skin: update(nextRect, nextPadding),
      },
      notice,
    );

  return (
    <section className="ui-region-editor">
      <h3>{title}</h3>
      <div className="ui-region-grid">
        <Field label="X">
          <NumberInput
            value={rect.x}
            min={0}
            max={skin.nativeSize.width - rect.width}
            onChange={(x) => commit({ ...rect, x })}
          />
        </Field>
        <Field label="Y">
          <NumberInput
            value={rect.y}
            min={0}
            max={skin.nativeSize.height - rect.height}
            onChange={(y) => commit({ ...rect, y })}
          />
        </Field>
        <Field label="Width">
          <NumberInput
            value={rect.width}
            min={1}
            max={skin.nativeSize.width - rect.x}
            onChange={(width) => commit({ ...rect, width })}
          />
        </Field>
        <Field label="Height">
          <NumberInput
            value={rect.height}
            min={1}
            max={skin.nativeSize.height - rect.y}
            onChange={(height) => commit({ ...rect, height })}
          />
        </Field>
        <Field label="Padding">
          <NumberInput
            value={padding}
            min={0}
            max={32}
            onChange={(nextPadding) => commit(rect, nextPadding)}
          />
        </Field>
      </div>
    </section>
  );
};

const VerbInspector = ({
  state,
  execute,
}: {
  readonly state: UiSkinWorkspaceState;
  readonly execute: (command: UiSkinEditorCommand, notice?: string) => void;
}) => {
  const skin = selectedUiSkin(state);
  const canAdd = Boolean(skin.verbBar || skin.verbCoin) && skin.interactionMode !== "two-button";
  const addVerb = (): void => {
    const index = skin.verbs.length + 1;
    const id = `custom-${index}`;
    const next: UiVerb = {
      id: `ui-verb.${skin.id}.${id}` as Id<"ui-verb">,
      verb: id,
      label: `VERB ${index}`,
      cursorId: id,
      primary: false,
      ...(skin.interactionMode === "icon-bar" ? { iconAssetId: "asset.ui.icons" as Id<"asset"> } : {}),
    };
    execute(insertUiVerbCommand(state, next), "Added interface verb.");
  };

  return (
    <section className="ui-verbs-inspector">
      <div className="section-heading-row">
        <h3>Verb order</h3>
        <Button disabled={!canAdd} onClick={addVerb}>
          Add verb
        </Button>
      </div>
      {skin.verbs.length === 0 ? (
        <p className="empty-copy">This interaction mode uses contextual commands.</p>
      ) : (
        <div className="ui-verb-list">
          {skin.verbs.map((verb, index) => (
            <div className="ui-verb-row" key={verb.id}>
              <span className="ui-verb-index">{index + 1}</span>
              <CommitInput
                value={verb.label}
                onCommit={(label) =>
                  execute(replaceUiVerbCommand(state, { ...verb, label }), "Updated verb label.")
                }
              />
              <input
                aria-label={`${verb.label} shortcut`}
                maxLength={1}
                value={verb.shortcut ?? ""}
                onChange={(event) => {
                  const shortcut = event.currentTarget.value.slice(0, 1);
                  const { shortcut: _old, ...withoutShortcut } = verb;
                  execute(
                    replaceUiVerbCommand(
                      state,
                      shortcut ? { ...withoutShortcut, shortcut } : withoutShortcut,
                    ),
                    "Updated verb shortcut.",
                  );
                }}
              />
              <label className="ui-primary-toggle">
                <input
                  type="checkbox"
                  checked={verb.primary}
                  onChange={(event) =>
                    execute(
                      replaceUiVerbCommand(state, {
                        ...verb,
                        primary: event.currentTarget.checked,
                      }),
                      "Updated primary verb state.",
                    )
                  }
                />
                Primary
              </label>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export const UiSkinApp = () => {
  const [state, dispatch] = useReducer(uiSkinWorkspaceReducer, undefined, () =>
    createUiSkinWorkspace(studioUiProject, studioUiBitmapFonts, studioUiSkins),
  );
  const skin = selectedUiSkin(state);
  const issues = uiSkinIssuesForSelectedSkin(state);
  const nodes = useMemo(() => uiSkinWorkspacePreviewNodes(state), [state]);

  const execute = useCallback(
    (command: UiSkinEditorCommand, notice?: string): void =>
      dispatch({ type: "execute", command, ...(notice ? { notice } : {}) }),
    [],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLocaleLowerCase("en-US") === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      }
      if (event.key.toLocaleLowerCase("en-US") === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const replaceSkin = (next: UiSkin, notice: string): void =>
    execute(replaceSelectedUiSkinCommand(state, next), notice);

  const stageStyle = {
    "--ui-stage-width": `${skin.nativeSize.width}px`,
    "--ui-stage-height": `${skin.nativeSize.height}px`,
  } as CSSProperties;

  return (
    <main className="studio-shell ui-skin-shell">
      <header className="studio-header">
        <div>
          <span className="eyebrow">INTERFACE SYSTEM</span>
          <h1>Interaction & UI Skins</h1>
          <p>
            {MODE_LABELS[skin.interactionMode]} · {skin.nativeSize.width} × {skin.nativeSize.height}
          </p>
        </div>
        <div className="header-actions">
          <span className={`save-state ${uiSkinWorkspaceIsDirty(state) ? "is-dirty" : ""}`}>
            {uiSkinWorkspaceIsDirty(state) ? "UNSAVED" : "SAVED"}
          </span>
          <Button disabled={state.history.undoStack.length === 0} onClick={() => dispatch({ type: "undo" })}>
            Undo
          </Button>
          <Button disabled={state.history.redoStack.length === 0} onClick={() => dispatch({ type: "redo" })}>
            Redo
          </Button>
          <Button onClick={() => dispatch({ type: "mark-saved" })}>Mark saved</Button>
          <Button className="button-primary" onClick={() => downloadManifest(state)}>
            Export JSON
          </Button>
        </div>
      </header>

      <div className="studio-body ui-skin-body">
        <aside className="sidebar ui-skin-list-sidebar">
          <div className="sidebar-heading">
            <span className="eyebrow">SKIN LIBRARY</span>
            <h2>{state.history.document.manifest.skins.length} profiles</h2>
          </div>
          <div className="ui-skin-list">
            {state.history.document.manifest.skins.map((candidate) => (
              <button
                type="button"
                key={candidate.id}
                className={candidate.id === skin.id ? "is-active" : ""}
                onClick={() => dispatch({ type: "select-skin", skinId: candidate.id })}
              >
                <span>{candidate.name}</span>
                <small>{MODE_LABELS[candidate.interactionMode]}</small>
                {candidate.id === state.history.document.manifest.defaultSkinId ? (
                  <strong>DEFAULT</strong>
                ) : null}
              </button>
            ))}
          </div>
          <div className="ui-skin-library-actions">
            <Button
              disabled={
                skin.id === state.history.document.manifest.defaultSkinId ||
                skin.interactionMode !== state.project.presentation.interactionMode
              }
              onClick={() =>
                execute({ kind: "set-default-skin", skinId: skin.id }, "Changed the default runtime skin.")
              }
            >
              Set default
            </Button>
          </div>
        </aside>

        <section className="workspace ui-skin-workspace">
          <div className="workspace-toolbar">
            <div>
              <span className="eyebrow">NATIVE PREVIEW</span>
              <strong>{skin.name}</strong>
            </div>
            <div className="ui-preview-controls">
              <label>
                Status
                <input
                  value={state.preview.statusText}
                  onChange={(event) =>
                    dispatch({
                      type: "update-preview",
                      preview: { ...state.preview, statusText: event.currentTarget.value },
                    })
                  }
                />
              </label>
              <div className="ui-preview-field">
                <span>Score</span>
                <NumberInput
                  value={state.preview.score ?? 0}
                  min={0}
                  max={9999}
                  onChange={(score) =>
                    dispatch({
                      type: "update-preview",
                      preview: { ...state.preview, score },
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="ui-stage-wrap">
            <div className="ui-stage" style={stageStyle}>
              <div className="ui-stage-scene">
                <div className="ui-stage-window" />
                <div className="ui-stage-desk" />
                <div className="ui-stage-character" />
              </div>
              {nodes.map((node) => (
                <PreviewNode key={node.id} node={node} />
              ))}
            </div>
          </div>

          <div className="ui-runtime-controls">
            {skin.parser ? (
              <Field label="Parser preview">
                <input
                  value={state.preview.parserText ?? ""}
                  onChange={(event) =>
                    dispatch({
                      type: "update-preview",
                      preview: { ...state.preview, parserText: event.currentTarget.value },
                    })
                  }
                />
              </Field>
            ) : null}
            {skin.verbCoin ? (
              <div className="ui-coin-controls">
                <Field label="Coin X">
                  <NumberInput
                    value={state.preview.verbCoinPosition?.x ?? 160}
                    min={0}
                    max={skin.nativeSize.width}
                    onChange={(x) =>
                      dispatch({
                        type: "update-preview",
                        preview: {
                          ...state.preview,
                          verbCoinPosition: {
                            x,
                            y: state.preview.verbCoinPosition?.y ?? 100,
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Coin Y">
                  <NumberInput
                    value={state.preview.verbCoinPosition?.y ?? 100}
                    min={0}
                    max={skin.nativeSize.height}
                    onChange={(y) =>
                      dispatch({
                        type: "update-preview",
                        preview: {
                          ...state.preview,
                          verbCoinPosition: {
                            x: state.preview.verbCoinPosition?.x ?? 160,
                            y,
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
            ) : null}
          </div>

          {state.notice ? <div className="workspace-notice">{state.notice}</div> : null}
        </section>

        <aside className="sidebar inspector-sidebar ui-skin-inspector">
          <div className="inspector-heading">
            <span className="eyebrow">SKIN INSPECTOR</span>
            <h2>{skin.name}</h2>
            <code>{skin.id}</code>
          </div>
          <div className="inspector-form">
            <section>
              <h3>Identity</h3>
              <Field label="Name">
                <CommitInput
                  value={skin.name}
                  onCommit={(name) => replaceSkin({ ...skin, name }, "Renamed interface skin.")}
                />
              </Field>
              <div className="readout-grid">
                <div>
                  <span>Mode</span>
                  <strong>{MODE_LABELS[skin.interactionMode]}</strong>
                </div>
                <div>
                  <span>Native</span>
                  <strong>
                    {skin.nativeSize.width} × {skin.nativeSize.height}
                  </strong>
                </div>
              </div>
            </section>

            <RegionEditor
              title="Status"
              skin={skin}
              rect={skin.status.rect}
              padding={skin.status.padding}
              execute={execute}
              update={(rect, padding) => ({
                ...skin,
                status: { ...skin.status, rect, padding },
              })}
            />

            {skin.score ? (
              <RegionEditor
                title="Score"
                skin={skin}
                rect={skin.score.rect}
                padding={skin.score.padding}
                execute={execute}
                update={(rect, padding) => ({
                  ...skin,
                  score: { ...skin.score!, rect, padding },
                })}
              />
            ) : null}

            {skin.verbBar ? (
              <RegionEditor
                title="Verb bar"
                skin={skin}
                rect={skin.verbBar.region.rect}
                padding={skin.verbBar.region.padding}
                execute={execute}
                update={(rect, padding) => ({
                  ...skin,
                  verbBar: {
                    ...skin.verbBar!,
                    region: { ...skin.verbBar!.region, rect, padding },
                  },
                })}
              />
            ) : null}

            {skin.inventory ? (
              <RegionEditor
                title="Inventory"
                skin={skin}
                rect={skin.inventory.region.rect}
                padding={skin.inventory.region.padding}
                execute={execute}
                update={(rect, padding) => ({
                  ...skin,
                  inventory: {
                    ...skin.inventory!,
                    region: { ...skin.inventory!.region, rect, padding },
                  },
                })}
              />
            ) : null}

            {skin.parser ? (
              <RegionEditor
                title="Parser"
                skin={skin}
                rect={skin.parser.region.rect}
                padding={skin.parser.region.padding}
                execute={execute}
                update={(rect, padding) => ({
                  ...skin,
                  parser: {
                    ...skin.parser!,
                    region: { ...skin.parser!.region, rect, padding },
                  },
                })}
              />
            ) : null}

            <VerbInspector state={state} execute={execute} />

            <section className="ui-validation-summary">
              <h3>Validation</h3>
              {issues.length === 0 ? (
                <p className="validation-clean">No interface issues.</p>
              ) : (
                issues.map((issue) => (
                  <div key={`${issue.code}:${issue.path}`} className={`validation-row is-${issue.severity}`}>
                    <strong>{issue.code}</strong>
                    <span>{issue.message}</span>
                  </div>
                ))
              )}
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
};
