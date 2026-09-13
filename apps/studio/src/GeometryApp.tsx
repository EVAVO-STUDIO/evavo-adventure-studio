import type { ProjectEditorCommand } from "@evavo/adventure-project-editor-core";
import type {
  DepthBand,
  Entrance,
  Hotspot,
  Id,
  NavigationArea,
  Point,
} from "@evavo/adventure-project-schema";
import {
  type Dispatch,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useReducer,
  useState,
} from "react";
import { studioProject } from "./fixture.js";
import {
  createGeometryWorkspace,
  deleteGeometrySelectionCommand,
  type GeometrySelection,
  type GeometryTool,
  type GeometryWorkspaceAction,
  type GeometryWorkspaceState,
  geometryProject,
  geometryScene,
  geometryWorkspaceIsDirty,
  geometryWorkspaceReducer,
  insertGeometryEntityCommand,
  replaceEntrancePositionCommand,
  replaceHotspotVertexCommand,
  replaceNavigationVertexCommand,
  selectedGeometryEntity,
} from "./geometry-workspace.js";
import "./geometry.css";

type GeometryDispatch = Dispatch<GeometryWorkspaceAction>;

const asId = <T extends string>(value: string): Id<T> => value as Id<T>;

const Button = ({
  children,
  onClick,
  active = false,
  disabled = false,
  title,
  className = "",
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly className?: string;
}) => (
  <button
    type="button"
    className={`button ${active ? "is-active" : ""} ${className}`}
    disabled={disabled}
    title={title}
    onClick={onClick}
  >
    {children}
  </button>
);

const scenePoint = (event: ReactPointerEvent<SVGSVGElement>, width: number, height: number): Point => {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.min(width - 1, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * width)),
    y: Math.min(height - 1, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * height)),
  };
};

const points = (value: readonly Point[]): string => value.map((point) => `${point.x},${point.y}`).join(" ");

const GeometryBackdrop = ({ sceneId }: { readonly sceneId: Id<"scene"> }) =>
  sceneId === "scene.alley" ? (
    <g className="geometry-art">
      <rect width="320" height="200" fill="#0a0e14" />
      <path d="M0 20L320 4V108H0Z" fill="#242d36" />
      <rect x="18" y="45" width="78" height="66" fill="#11171d" />
      <rect x="226" y="30" width="70" height="82" fill="#11171d" />
      <path d="M0 110L320 101V200H0Z" fill="#12161b" />
      <path d="M6 145L310 126M10 176L310 157" stroke="#343b45" />
    </g>
  ) : (
    <g className="geometry-art">
      <rect width="320" height="200" fill="#11131a" />
      <rect width="320" height="112" fill="#252836" />
      <rect y="112" width="320" height="88" fill="#19171d" />
      <rect x="224" y="18" width="72" height="82" fill="#09111c" />
      <rect x="82" y="103" width="146" height="55" fill="#493932" />
      <rect x="276" y="63" width="39" height="89" fill="#171a22" />
      <path d="M0 130H320M0 154H320M0 178H320" stroke="#292832" />
    </g>
  );

interface VertexDrag {
  readonly pointerId: number;
  readonly kind: "navigation-area" | "hotspot" | "entrance";
  readonly entityId: string;
  readonly vertexIndex: number | null;
  readonly point: Point;
}

const GeometryCanvas = ({
  state,
  dispatch,
}: {
  readonly state: GeometryWorkspaceState;
  readonly dispatch: GeometryDispatch;
}) => {
  const scene = geometryScene(state);
  const [drag, setDrag] = useState<VertexDrag | null>(null);
  const scale = 2.55 * state.zoom;

  const beginVertexDrag = (
    event: ReactPointerEvent<SVGCircleElement>,
    dragState: Omit<VertexDrag, "pointerId">,
  ): void => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ ...dragState, pointerId: event.pointerId });
  };

  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDrag({
      ...drag,
      point: scenePoint(event, scene.width, scene.height),
    });
  };

  const commitDrag = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    let command: ProjectEditorCommand;
    if (drag.kind === "navigation-area") {
      command = replaceNavigationVertexCommand(
        state,
        asId<"navigation-area">(drag.entityId),
        drag.vertexIndex ?? 0,
        drag.point,
      );
    } else if (drag.kind === "hotspot") {
      command = replaceHotspotVertexCommand(
        state,
        asId<"hotspot">(drag.entityId),
        drag.vertexIndex ?? 0,
        drag.point,
      );
    } else {
      command = replaceEntrancePositionCommand(state, asId<"entrance">(drag.entityId), drag.point);
    }
    dispatch({
      type: "execute",
      command,
      notice: "Updated native scene geometry.",
    });
    setDrag(null);
  };

  const previewPolygon = (
    id: string,
    kind: "navigation-area" | "hotspot",
    source: readonly Point[],
  ): readonly Point[] => {
    if (!drag || drag.kind !== kind || drag.entityId !== id) return source;
    const next = [...source];
    if (drag.vertexIndex !== null) next[drag.vertexIndex] = drag.point;
    return next;
  };

  const previewEntrance = (entrance: Entrance): Point =>
    drag?.kind === "entrance" && drag.entityId === entrance.id ? drag.point : entrance.position;

  return (
    <div className="geometry-viewport-scroll">
      <div
        className="geometry-viewport-stage"
        style={{ width: scene.width * scale, height: scene.height * scale }}
      >
        <svg
          className="geometry-viewport"
          viewBox={`0 0 ${scene.width} ${scene.height}`}
          aria-label={`${scene.name} project geometry editor`}
          onPointerMove={moveDrag}
          onPointerUp={commitDrag}
          onPointerCancel={() => setDrag(null)}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              dispatch({ type: "select", selection: null });
            }
          }}
        >
          <GeometryBackdrop sceneId={scene.id} />
          {state.showGrid ? (
            <g className="grid-overlay">
              {Array.from({ length: Math.floor(scene.width / 16) + 1 }, (_, index) => (
                <line key={`x-${index}`} x1={index * 16} y1="0" x2={index * 16} y2={scene.height} />
              ))}
              {Array.from({ length: Math.floor(scene.height / 16) + 1 }, (_, index) => (
                <line key={`y-${index}`} x1="0" y1={index * 16} x2={scene.width} y2={index * 16} />
              ))}
            </g>
          ) : null}

          {state.tool === "walkmesh" ? (
            <g className="walkmesh-editor-layer">
              {scene.navigationAreas.map((area) => {
                const selected =
                  state.selection?.kind === "navigation-area" && state.selection.id === area.id;
                const displayPoints = previewPolygon(area.id, "navigation-area", area.shape.points);
                return (
                  <g key={area.id} className={selected ? "is-selected" : ""}>
                    <polygon
                      points={points(displayPoints)}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        dispatch({
                          type: "select",
                          selection: { kind: "navigation-area", id: area.id },
                        });
                      }}
                    />
                    {selected
                      ? displayPoints.map((point, vertexIndex) => (
                          <circle
                            key={`${area.id}-${vertexIndex}`}
                            cx={point.x}
                            cy={point.y}
                            r="3"
                            onPointerDown={(event) =>
                              beginVertexDrag(event, {
                                kind: "navigation-area",
                                entityId: area.id,
                                vertexIndex,
                                point,
                              })
                            }
                          />
                        ))
                      : null}
                  </g>
                );
              })}
            </g>
          ) : null}

          {state.tool === "hotspots" ? (
            <g className="hotspot-editor-layer">
              {scene.hotspots.map((hotspot) => {
                const selected = state.selection?.kind === "hotspot" && state.selection.id === hotspot.id;
                const displayPoints = previewPolygon(hotspot.id, "hotspot", hotspot.shape.points);
                return (
                  <g key={hotspot.id} className={selected ? "is-selected" : ""}>
                    <polygon
                      points={points(displayPoints)}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        dispatch({
                          type: "select",
                          selection: { kind: "hotspot", id: hotspot.id },
                        });
                      }}
                    />
                    {selected
                      ? displayPoints.map((point, vertexIndex) => (
                          <circle
                            key={`${hotspot.id}-${vertexIndex}`}
                            cx={point.x}
                            cy={point.y}
                            r="3"
                            onPointerDown={(event) =>
                              beginVertexDrag(event, {
                                kind: "hotspot",
                                entityId: hotspot.id,
                                vertexIndex,
                                point,
                              })
                            }
                          />
                        ))
                      : null}
                  </g>
                );
              })}
            </g>
          ) : null}

          {state.tool === "depth" ? (
            <g className="depth-editor-layer">
              {scene.depthBands.map((band) => {
                const selected = state.selection?.kind === "depth-band" && state.selection.id === band.id;
                return (
                  <g
                    key={band.id}
                    className={selected ? "is-selected" : ""}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      dispatch({
                        type: "select",
                        selection: { kind: "depth-band", id: band.id },
                      });
                    }}
                  >
                    <rect
                      x="0"
                      y={Math.min(band.farY, band.nearY)}
                      width={scene.width}
                      height={Math.abs(band.nearY - band.farY)}
                    />
                    <line x1="0" y1={band.farY} x2={scene.width} y2={band.farY} />
                    <line x1="0" y1={band.nearY} x2={scene.width} y2={band.nearY} />
                    <text x="8" y={band.farY - 3}>
                      {band.farScale.toFixed(2)}×
                    </text>
                    <text x="8" y={band.nearY - 3}>
                      {band.nearScale.toFixed(2)}×
                    </text>
                  </g>
                );
              })}
            </g>
          ) : null}

          {state.tool === "entrances" ? (
            <g className="entrance-editor-layer">
              {scene.entrances.map((entrance) => {
                const position = previewEntrance(entrance);
                const selected = state.selection?.kind === "entrance" && state.selection.id === entrance.id;
                return (
                  <g key={entrance.id} className={selected ? "is-selected" : ""}>
                    <circle
                      cx={position.x}
                      cy={position.y}
                      r="7"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        dispatch({
                          type: "select",
                          selection: { kind: "entrance", id: entrance.id },
                        });
                        beginVertexDrag(event, {
                          kind: "entrance",
                          entityId: entrance.id,
                          vertexIndex: null,
                          point: position,
                        });
                      }}
                    />
                    <line x1={position.x - 10} y1={position.y} x2={position.x + 10} y2={position.y} />
                    <line x1={position.x} y1={position.y - 10} x2={position.x} y2={position.y + 10} />
                  </g>
                );
              })}
            </g>
          ) : null}
        </svg>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { readonly label: string; readonly children: ReactNode }) => (
  <div className="field">
    <span>{label}</span>
    {children}
  </div>
);

const NumberInput = ({
  value,
  onChange,
  step = 1,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly step?: number;
}) => (
  <input
    type="number"
    value={Number.isInteger(value) ? value : Number(value.toFixed(3))}
    step={step}
    onChange={(event) => {
      const next = Number(event.currentTarget.value);
      if (Number.isFinite(next)) onChange(next);
    }}
  />
);

const GeometryInspector = ({
  state,
  dispatch,
}: {
  readonly state: GeometryWorkspaceState;
  readonly dispatch: GeometryDispatch;
}) => {
  const entity = selectedGeometryEntity(state);
  const scene = geometryScene(state);
  const execute = (command: ProjectEditorCommand, notice: string): void =>
    dispatch({ type: "execute", command, notice });

  const replaceArea = (area: NavigationArea): void =>
    execute(
      {
        kind: "replace-navigation-area",
        sceneId: scene.id,
        areaId: area.id,
        area,
      },
      "Updated walkmesh area.",
    );
  const replaceBand = (band: DepthBand): void =>
    execute(
      {
        kind: "replace-depth-band",
        sceneId: scene.id,
        bandId: band.id,
        band,
      },
      "Updated perspective band.",
    );
  const replaceHotspot = (hotspot: Hotspot): void =>
    execute(
      {
        kind: "replace-hotspot",
        sceneId: scene.id,
        hotspotId: hotspot.id,
        hotspot,
      },
      "Updated hotspot.",
    );
  const replaceEntrance = (entrance: Entrance): void =>
    execute(
      {
        kind: "replace-entrance",
        sceneId: scene.id,
        entranceId: entrance.id,
        entrance,
      },
      "Updated entrance.",
    );

  return (
    <aside className="sidebar inspector-sidebar geometry-inspector">
      <div className="inspector-heading">
        <span className="eyebrow">GEOMETRY INSPECTOR</span>
        <h2>{entity?.value.id.split(".").at(-1) ?? scene.name}</h2>
        <code>{entity?.value.id ?? scene.id}</code>
      </div>
      {!entity ? (
        <div className="inspector-empty">
          <span className="empty-mark">⌗</span>
          <h3>{state.tool}</h3>
          <p>Select geometry on the native canvas to edit its exact values.</p>
        </div>
      ) : null}
      {entity?.kind === "navigation-area" ? (
        <div className="inspector-form">
          <section>
            <h3>Walkmesh area</h3>
            <Field label="Elevation">
              <NumberInput
                value={entity.value.elevation}
                onChange={(elevation) => replaceArea({ ...entity.value, elevation })}
              />
            </Field>
            <div className="geometry-stat-row">
              <span>Vertices</span>
              <strong>{entity.value.shape.points.length}</strong>
            </div>
          </section>
        </div>
      ) : null}
      {entity?.kind === "depth-band" ? (
        <div className="inspector-form">
          <section>
            <h3>Perspective band</h3>
            <div className="field-grid two-columns">
              <Field label="Far Y">
                <NumberInput
                  value={entity.value.farY}
                  onChange={(farY) => replaceBand({ ...entity.value, farY })}
                />
              </Field>
              <Field label="Near Y">
                <NumberInput
                  value={entity.value.nearY}
                  onChange={(nearY) => replaceBand({ ...entity.value, nearY })}
                />
              </Field>
              <Field label="Far scale">
                <NumberInput
                  value={entity.value.farScale}
                  step={0.05}
                  onChange={(farScale) => replaceBand({ ...entity.value, farScale })}
                />
              </Field>
              <Field label="Near scale">
                <NumberInput
                  value={entity.value.nearScale}
                  step={0.05}
                  onChange={(nearScale) => replaceBand({ ...entity.value, nearScale })}
                />
              </Field>
            </div>
          </section>
        </div>
      ) : null}
      {entity?.kind === "hotspot" ? (
        <div className="inspector-form">
          <section>
            <h3>Hotspot</h3>
            <Field label="Name">
              <input
                value={entity.value.name}
                onChange={(event) =>
                  replaceHotspot({
                    ...entity.value,
                    name: event.currentTarget.value || "Untitled hotspot",
                  })
                }
              />
            </Field>
            <Field label="Cursor">
              <input
                value={entity.value.cursor ?? ""}
                placeholder="Automatic"
                onChange={(event) => {
                  const cursor = event.currentTarget.value.trim();
                  if (cursor) {
                    replaceHotspot({ ...entity.value, cursor });
                  } else {
                    const { cursor: _cursor, ...rest } = entity.value;
                    replaceHotspot(rest);
                  }
                }}
              />
            </Field>
            <div className="geometry-stat-row">
              <span>Interactions</span>
              <strong>{entity.value.interactions.length}</strong>
            </div>
          </section>
        </div>
      ) : null}
      {entity?.kind === "entrance" ? (
        <div className="inspector-form">
          <section>
            <h3>Entrance</h3>
            <div className="field-grid two-columns">
              <Field label="X">
                <NumberInput
                  value={entity.value.position.x}
                  onChange={(x) =>
                    replaceEntrance({
                      ...entity.value,
                      position: { ...entity.value.position, x },
                    })
                  }
                />
              </Field>
              <Field label="Y">
                <NumberInput
                  value={entity.value.position.y}
                  onChange={(y) =>
                    replaceEntrance({
                      ...entity.value,
                      position: { ...entity.value.position, y },
                    })
                  }
                />
              </Field>
            </div>
            <Field label="Facing">
              <select
                value={entity.value.facing}
                onChange={(event) =>
                  replaceEntrance({
                    ...entity.value,
                    facing: event.currentTarget.value as Entrance["facing"],
                  })
                }
              >
                {[
                  "north",
                  "north-east",
                  "east",
                  "south-east",
                  "south",
                  "south-west",
                  "west",
                  "north-west",
                ].map((facing) => (
                  <option key={facing} value={facing}>
                    {facing}
                  </option>
                ))}
              </select>
            </Field>
          </section>
        </div>
      ) : null}
    </aside>
  );
};

const toolLabel = (tool: GeometryTool): string => {
  switch (tool) {
    case "walkmesh":
      return "Walkmesh";
    case "depth":
      return "Depth scaling";
    case "hotspots":
      return "Hotspots";
    case "entrances":
      return "Entrances";
  }
};

const downloadProject = (state: GeometryWorkspaceState): void => {
  const project = geometryProject(state);
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(project, null, 2)}\n`], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "project.json";
  anchor.click();
  URL.revokeObjectURL(url);
};

export const GeometryApp = () => {
  const [state, dispatch] = useReducer(geometryWorkspaceReducer, createGeometryWorkspace(studioProject));
  const scene = geometryScene(state);
  const project = geometryProject(state);
  const dirty = geometryWorkspaceIsDirty(state);

  const add = (): void => {
    const addition = insertGeometryEntityCommand(state);
    dispatch({
      type: "execute",
      command: addition.command,
      selection: addition.selection,
      notice: `Added ${toolLabel(state.tool).toLowerCase()} geometry.`,
    });
  };

  const remove = useCallback(() => {
    const command = deleteGeometrySelectionCommand(state);
    if (!command) return;
    try {
      dispatch({ type: "execute", command, notice: "Removed project geometry." });
      dispatch({ type: "select", selection: null });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Geometry removal failed.");
    }
  }, [state]);

  const exportProject = useCallback(() => {
    downloadProject(state);
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
        exportProject();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        const target = event.target as HTMLElement | null;
        if (!target?.matches("input, select, textarea")) remove();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exportProject, remove]);

  return (
    <div className="studio-app geometry-app">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">E</span>
          <span>
            <strong>EVAVO</strong>
            <small>ADVENTURE STUDIO</small>
          </span>
        </div>
        <div className="document-title">
          <span>{project.title}</span>
          <strong>Project Geometry</strong>
          {dirty ? <i>●</i> : null}
        </div>
        <div className="topbar-actions">
          <a className="button" href="/">
            Scene composer
          </a>
          <Button onClick={exportProject} className="primary-button">
            Export Project
          </Button>
        </div>
      </header>

      <div className="toolbar geometry-toolbar">
        <div className="toolbar-group">
          <Button onClick={() => dispatch({ type: "undo" })} disabled={state.history.undoStack.length === 0}>
            ↶
          </Button>
          <Button onClick={() => dispatch({ type: "redo" })} disabled={state.history.redoStack.length === 0}>
            ↷
          </Button>
          <span className="toolbar-divider" />
          <Button onClick={add}>＋ Add</Button>
          <Button onClick={remove} disabled={!state.selection}>
            ⌫
          </Button>
        </div>
        <div className="toolbar-group center-tools">
          {(["walkmesh", "depth", "hotspots", "entrances"] as const).map((tool) => (
            <Button
              key={tool}
              active={state.tool === tool}
              onClick={() => dispatch({ type: "set-tool", tool })}
            >
              {toolLabel(tool)}
            </Button>
          ))}
        </div>
        <div className="toolbar-group zoom-tools">
          <Button onClick={() => dispatch({ type: "toggle-grid" })} active={state.showGrid}>
            Grid
          </Button>
          <Button onClick={() => dispatch({ type: "set-zoom", zoom: state.zoom - 0.25 })}>−</Button>
          <span>{Math.round(state.zoom * 100)}%</span>
          <Button onClick={() => dispatch({ type: "set-zoom", zoom: state.zoom + 0.25 })}>+</Button>
        </div>
      </div>

      <main className="workspace-grid geometry-grid">
        <aside className="sidebar scene-sidebar geometry-scene-sidebar">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">PROJECT SCENES</span>
              <h2>{toolLabel(state.tool)}</h2>
            </div>
          </div>
          <nav className="scene-list" aria-label="Project geometry scenes">
            {project.scenes.map((candidate, index) => (
              <button
                type="button"
                key={candidate.id}
                className={`scene-row ${candidate.id === state.activeSceneId ? "is-active" : ""}`}
                onClick={() => dispatch({ type: "select-scene", sceneId: candidate.id })}
              >
                <span className="scene-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="scene-copy">
                  <strong>{candidate.name}</strong>
                  <span>
                    {candidate.navigationAreas.length} areas · {candidate.hotspots.length} hotspots
                  </span>
                </span>
                <span className="scene-dot" />
              </button>
            ))}
          </nav>
          <div className="geometry-help">
            <span className="section-label">AUTHORING RULE</span>
            <p>
              Drag native vertices. Every commit becomes one reversible project command; start scenes and
              entrances remain protected.
            </p>
          </div>
          <div className="sidebar-footer">
            <span className={`save-indicator ${dirty ? "is-dirty" : ""}`} />
            {dirty ? "Unsaved project geometry" : "Project geometry saved"}
          </div>
        </aside>

        <section className="canvas-workspace">
          <div className="canvas-header">
            <div>
              <span className="eyebrow">PROJECT GEOMETRY</span>
              <h1>{scene.name}</h1>
            </div>
            <div className="canvas-meta">
              <span>{toolLabel(state.tool)}</span>
              <span>
                {scene.width} × {scene.height}
              </span>
              <span>Revision {state.history.document.operationRevision}</span>
            </div>
          </div>
          <GeometryCanvas state={state} dispatch={dispatch} />
          <footer className="canvas-footer">
            <span>{state.notice ?? "Select geometry, then drag native points."}</span>
            <span>{state.history.undoStack.length} undo steps</span>
          </footer>
        </section>

        <GeometryInspector state={state} dispatch={dispatch} />
      </main>
    </div>
  );
};
