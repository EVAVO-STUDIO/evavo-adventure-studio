import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { EditorCommand } from "@evavo/adventure-editor-core";
import type { Id, Point } from "@evavo/adventure-project-schema";
import {
  parseSceneInstanceManifest,
  type SceneActorInstance,
  type SceneNavigationPortal,
  type SceneObjectInstance,
} from "@evavo/adventure-scene-instances";
import { studioProject, studioSceneInstances } from "./fixture.js";
import {
  activeProjectScene,
  activeSceneComposition,
  createStudioWorkspace,
  deleteSelectionCommand,
  insertActorCommand,
  insertObjectCommand,
  replaceSelectedPositionCommand,
  selectedEntity,
  selectionTitle,
  studioWorkspaceReducer,
  workspaceIsDirty,
  type StudioWorkspaceState,
  type WorkspaceSelection,
} from "./workspace.js";

const asId = <T extends string>(value: string): Id<T> => value as Id<T>;

const Icon = ({ children }: { readonly children: ReactNode }) => (
  <span className="icon" aria-hidden="true">
    {children}
  </span>
);

const Button = ({
  children,
  active = false,
  disabled = false,
  title,
  onClick,
  className = "",
}: {
  readonly children: ReactNode;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly onClick: () => void;
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

const ToolbarDivider = () => <span className="toolbar-divider" aria-hidden="true" />;

const scenePoint = (
  event: ReactPointerEvent<SVGSVGElement>,
  width: number,
  height: number,
): Point => {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.min(width - 1, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * width)),
    y: Math.min(height - 1, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * height)),
  };
};

const polygonPoints = (points: readonly Point[]): string =>
  points.map((point) => `${point.x},${point.y}`).join(" ");

interface DragState {
  readonly pointerId: number;
  readonly selection: Exclude<WorkspaceSelection, null>;
  readonly position: Point;
}

const entityPosition = (
  state: StudioWorkspaceState,
  selection: Exclude<WorkspaceSelection, null>,
): Point | null => {
  const composition = activeSceneComposition(state);
  switch (selection.kind) {
    case "actor":
      return composition.actorInstances.find((candidate) => candidate.id === selection.id)
        ?.position ?? null;
    case "object":
      return composition.objectInstances.find((candidate) => candidate.id === selection.id)
        ?.position ?? null;
    case "portal": {
      const portal = composition.navigationPortals.find(
        (candidate) => candidate.id === selection.id,
      );
      return portal?.fromPoint ?? null;
    }
  }
};

const previewPosition = (
  state: StudioWorkspaceState,
  selection: Exclude<WorkspaceSelection, null>,
  drag: DragState | null,
): Point | null =>
  drag && drag.selection.kind === selection.kind && drag.selection.id === selection.id
    ? drag.position
    : entityPosition(state, selection);

const OfficeBackdrop = () => (
  <g className="scene-art scene-art-office">
    <rect x="0" y="0" width="320" height="200" fill="#11131a" />
    <rect x="0" y="0" width="320" height="112" fill="#242735" />
    <rect x="0" y="112" width="320" height="88" fill="#18161c" />
    <rect x="224" y="18" width="72" height="82" fill="#090b12" stroke="#4a4e60" />
    <rect x="229" y="23" width="62" height="72" fill="#0a1b2a" />
    <line x1="260" y1="23" x2="260" y2="95" stroke="#4b5164" strokeWidth="2" />
    <line x1="229" y1="58" x2="291" y2="58" stroke="#4b5164" strokeWidth="2" />
    <circle cx="241" cy="72" r="1.5" fill="#f4c26a" />
    <circle cx="279" cy="44" r="1.5" fill="#ff244e" />
    <rect x="82" y="103" width="146" height="11" rx="1" fill="#795a46" />
    <rect x="91" y="113" width="128" height="46" fill="#443431" />
    <rect x="109" y="121" width="91" height="21" fill="#2b2427" stroke="#80604c" />
    <path d="M0 129H320M0 153H320M0 178H320" stroke="#292733" strokeWidth="1" />
    <rect x="276" y="64" width="38" height="88" fill="#151820" stroke="#565b6c" />
    <rect x="282" y="71" width="25" height="54" fill="#242936" />
  </g>
);

const AlleyBackdrop = () => (
  <g className="scene-art scene-art-alley">
    <rect x="0" y="0" width="320" height="200" fill="#090d13" />
    <rect x="0" y="0" width="320" height="106" fill="#18212a" />
    <path d="M0 24L320 5V104H0Z" fill="#202b35" />
    <rect x="18" y="42" width="76" height="70" fill="#11171d" stroke="#394653" />
    <rect x="225" y="28" width="70" height="84" fill="#10161c" stroke="#394653" />
    <path d="M0 111L320 101V200H0Z" fill="#11151a" />
    <path d="M7 145L307 126M10 174L309 157" stroke="#303741" strokeWidth="1" />
    <path d="M36 0L18 200M117 0L108 200M244 0L257 200" stroke="#8fa1ad" strokeOpacity="0.2" />
    <g fill="#6fa2b7" opacity="0.55">
      <circle cx="42" cy="36" r="1" />
      <circle cx="92" cy="68" r="1" />
      <circle cx="164" cy="22" r="1" />
      <circle cx="209" cy="58" r="1" />
      <circle cx="282" cy="76" r="1" />
    </g>
  </g>
);

const SceneBackdrop = ({ sceneId }: { readonly sceneId: Id<"scene"> }) =>
  sceneId === "scene.alley" ? <AlleyBackdrop /> : <OfficeBackdrop />;

const ActorGlyph = ({ selected }: { readonly selected: boolean }) => (
  <g className={`actor-glyph ${selected ? "is-selected" : ""}`}>
    <ellipse cx="0" cy="1" rx="8" ry="2.5" fill="#05060a" opacity="0.65" />
    <path d="M-5-17L5-17L8-4L5 0H-5L-8-4Z" fill="#273043" stroke="#d7d9e0" strokeWidth="0.65" />
    <rect x="-4" y="-23" width="8" height="7" rx="2" fill="#b88a71" />
    <path d="M-6-24H6L4-29H-4Z" fill="#31394b" stroke="#d7d9e0" strokeWidth="0.5" />
    {selected ? <circle cx="0" cy="-14" r="12" fill="none" stroke="#ff244e" strokeWidth="1" /> : null}
  </g>
);

const ObjectGlyph = ({ selected }: { readonly selected: boolean }) => (
  <g className={`object-glyph ${selected ? "is-selected" : ""}`}>
    <rect x="-7" y="-14" width="14" height="14" rx="1.5" fill="#8f6949" stroke="#e2c69f" strokeWidth="0.75" />
    <rect x="-3" y="-18" width="6" height="5" fill="#ff244e" opacity="0.85" />
    {selected ? <rect x="-11" y="-22" width="22" height="25" fill="none" stroke="#ff244e" strokeWidth="1" /> : null}
  </g>
);

const EditorViewport = ({
  state,
  dispatch,
}: {
  readonly state: StudioWorkspaceState;
  readonly dispatch: React.Dispatch<Parameters<typeof studioWorkspaceReducer>[1]>;
}) => {
  const scene = activeProjectScene(state);
  const composition = activeSceneComposition(state);
  const [drag, setDrag] = useState<DragState | null>(null);
  const scale = 2.45 * state.view.zoom;

  const beginDrag = (
    event: ReactPointerEvent<SVGGElement>,
    selection: Exclude<WorkspaceSelection, null>,
  ): void => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = entityPosition(state, selection);
    if (!position || selection.kind === "portal") {
      dispatch({ type: "select", selection });
      return;
    }
    dispatch({ type: "select", selection });
    setDrag({ pointerId: event.pointerId, selection, position });
  };

  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    setDrag({ ...drag, position: scenePoint(event, scene.width, scene.height) });
  };

  const finishDrag = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const temporary = { ...state, selection: drag.selection };
    const command = replaceSelectedPositionCommand(temporary, drag.position);
    if (command) {
      dispatch({
        type: "execute",
        command,
        selection: drag.selection,
        notice: "Moved scene instance.",
      });
    }
    setDrag(null);
  };

  return (
    <div className="viewport-scroll">
      <div
        className="viewport-stage"
        style={{ width: scene.width * scale, height: scene.height * scale }}
      >
        <svg
          className="scene-viewport"
          viewBox={`0 0 ${scene.width} ${scene.height}`}
          role="application"
          aria-label={`${scene.name} scene composition viewport`}
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          onPointerCancel={() => setDrag(null)}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              dispatch({ type: "select", selection: null });
            }
          }}
        >
          <SceneBackdrop sceneId={scene.id} />

          {state.view.showGrid ? (
            <g className="grid-overlay" aria-hidden="true">
              {Array.from({ length: Math.floor(scene.width / 16) + 1 }, (_, index) => (
                <line key={`x-${index}`} x1={index * 16} y1="0" x2={index * 16} y2={scene.height} />
              ))}
              {Array.from({ length: Math.floor(scene.height / 16) + 1 }, (_, index) => (
                <line key={`y-${index}`} x1="0" y1={index * 16} x2={scene.width} y2={index * 16} />
              ))}
            </g>
          ) : null}

          {state.view.showNavigation ? (
            <g className="navigation-overlay">
              {scene.navigationAreas.map((area) => (
                <polygon
                  key={area.id}
                  points={polygonPoints(area.shape.points)}
                  data-elevation={area.elevation}
                />
              ))}
            </g>
          ) : null}

          {state.view.showPortals ? (
            <g className="portal-overlay">
              {composition.navigationPortals.map((portal) => {
                const selected =
                  state.selection?.kind === "portal" && state.selection.id === portal.id;
                return (
                  <g
                    key={portal.id}
                    className={selected ? "is-selected" : ""}
                    role="button"
                    tabIndex={0}
                    onPointerDown={(event) =>
                      beginDrag(event, { kind: "portal", id: portal.id })
                    }
                  >
                    <line
                      x1={portal.fromPoint.x}
                      y1={portal.fromPoint.y}
                      x2={portal.toPoint.x}
                      y2={portal.toPoint.y}
                    />
                    <circle cx={portal.fromPoint.x} cy={portal.fromPoint.y} r="3" />
                    <circle cx={portal.toPoint.x} cy={portal.toPoint.y} r="3" />
                  </g>
                );
              })}
            </g>
          ) : null}

          <g className="instance-overlay">
            {composition.objectInstances.map((instance) => {
              const selection = { kind: "object", id: instance.id } as const;
              const position = previewPosition(state, selection, drag) ?? instance.position;
              const selected =
                state.selection?.kind === "object" && state.selection.id === instance.id;
              return (
                <g
                  key={instance.id}
                  className="scene-instance object-instance"
                  transform={`translate(${position.x} ${position.y})`}
                  role="button"
                  tabIndex={0}
                  onPointerDown={(event) => beginDrag(event, selection)}
                >
                  <ObjectGlyph selected={selected} />
                </g>
              );
            })}
            {composition.actorInstances.map((instance) => {
              const selection = { kind: "actor", id: instance.id } as const;
              const position = previewPosition(state, selection, drag) ?? instance.position;
              const selected =
                state.selection?.kind === "actor" && state.selection.id === instance.id;
              return (
                <g
                  key={instance.id}
                  className="scene-instance actor-instance"
                  transform={`translate(${position.x} ${position.y})`}
                  role="button"
                  tabIndex={0}
                  onPointerDown={(event) => beginDrag(event, selection)}
                >
                  <ActorGlyph selected={selected} />
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};

const SceneTree = ({
  state,
  dispatch,
}: {
  readonly state: StudioWorkspaceState;
  readonly dispatch: React.Dispatch<Parameters<typeof studioWorkspaceReducer>[1]>;
}) => (
  <aside className="sidebar scene-sidebar">
    <div className="panel-heading">
      <div>
        <span className="eyebrow">PROJECT</span>
        <h2>{state.project.title}</h2>
      </div>
      <button type="button" className="icon-button" title="Project settings">
        •••
      </button>
    </div>
    <nav className="scene-list" aria-label="Project scenes">
      {state.project.scenes.map((scene, index) => {
        const composition = state.history.document.manifest.scenes.find(
          (candidate) => candidate.sceneId === scene.id,
        );
        const active = state.activeSceneId === scene.id;
        return (
          <button
            type="button"
            key={scene.id}
            className={`scene-row ${active ? "is-active" : ""}`}
            onClick={() => dispatch({ type: "select-scene", sceneId: scene.id })}
          >
            <span className="scene-index">{String(index + 1).padStart(2, "0")}</span>
            <span className="scene-copy">
              <strong>{scene.name}</strong>
              <span>
                {composition?.actorInstances.length ?? 0} actors ·{" "}
                {composition?.objectInstances.length ?? 0} objects
              </span>
            </span>
            <span className="scene-dot" />
          </button>
        );
      })}
    </nav>
    <div className="sidebar-section">
      <span className="section-label">OBJECT DEFINITIONS</span>
      {state.history.document.manifest.objectDefinitions.map((definition) => (
        <div className="definition-row" key={definition.id}>
          <span className="definition-icon">◇</span>
          <span>
            <strong>{definition.name}</strong>
            <small>{definition.states.length} states</small>
          </span>
        </div>
      ))}
    </div>
    <div className="sidebar-footer">
      <span className={`save-indicator ${workspaceIsDirty(state) ? "is-dirty" : ""}`} />
      {workspaceIsDirty(state) ? "Unsaved scene edits" : "Scene document saved"}
    </div>
  </aside>
);

const LayersPanel = ({
  state,
  dispatch,
}: {
  readonly state: StudioWorkspaceState;
  readonly dispatch: React.Dispatch<Parameters<typeof studioWorkspaceReducer>[1]>;
}) => {
  const composition = activeSceneComposition(state);
  const actorName = (instance: SceneActorInstance): string =>
    state.project.actors.find((candidate) => candidate.id === instance.actorId)?.name ??
    instance.id;
  const objectName = (instance: SceneObjectInstance): string =>
    state.history.document.manifest.objectDefinitions.find(
      (candidate) => candidate.id === instance.definitionId,
    )?.name ?? instance.id;

  return (
    <section className="layers-panel">
      <div className="layers-heading">
        <span>SCENE LAYERS</span>
        <span>{composition.actorInstances.length + composition.objectInstances.length}</span>
      </div>
      <div className="layer-group">
        <div className="layer-group-title">Actors</div>
        {composition.actorInstances.map((instance) => (
          <button
            type="button"
            key={instance.id}
            className={`layer-row ${
              state.selection?.kind === "actor" && state.selection.id === instance.id
                ? "is-active"
                : ""
            }`}
            onClick={() =>
              dispatch({ type: "select", selection: { kind: "actor", id: instance.id } })
            }
          >
            <span className="layer-kind">A</span>
            <span>
              <strong>{actorName(instance)}</strong>
              <small>{instance.mobility}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="layer-group">
        <div className="layer-group-title">Objects</div>
        {composition.objectInstances.map((instance) => (
          <button
            type="button"
            key={instance.id}
            className={`layer-row ${
              state.selection?.kind === "object" && state.selection.id === instance.id
                ? "is-active"
                : ""
            }`}
            onClick={() =>
              dispatch({ type: "select", selection: { kind: "object", id: instance.id } })
            }
          >
            <span className="layer-kind">O</span>
            <span>
              <strong>{objectName(instance)}</strong>
              <small>{instance.layer}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="layer-group">
        <div className="layer-group-title">Navigation</div>
        {composition.navigationPortals.map((portal) => (
          <button
            type="button"
            key={portal.id}
            className={`layer-row ${
              state.selection?.kind === "portal" && state.selection.id === portal.id
                ? "is-active"
                : ""
            }`}
            onClick={() =>
              dispatch({ type: "select", selection: { kind: "portal", id: portal.id } })
            }
          >
            <span className="layer-kind">P</span>
            <span>
              <strong>{portal.id.split(".").at(-1)}</strong>
              <small>{portal.bidirectional ? "two-way" : "one-way"}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};

const Field = ({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) => (
  <label className="field">
    <span>{label}</span>
    {children}
  </label>
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
    value={Number.isInteger(value) ? value : Number(value.toFixed(2))}
    step={step}
    onChange={(event) => {
      const next = Number(event.currentTarget.value);
      if (Number.isFinite(next)) onChange(next);
    }}
  />
);

const executeReplacement = (
  state: StudioWorkspaceState,
  dispatch: React.Dispatch<Parameters<typeof studioWorkspaceReducer>[1]>,
  command: EditorCommand,
  notice: string,
): void => dispatch({ type: "execute", command, notice });

const Inspector = ({
  state,
  dispatch,
}: {
  readonly state: StudioWorkspaceState;
  readonly dispatch: React.Dispatch<Parameters<typeof studioWorkspaceReducer>[1]>;
}) => {
  const entity = selectedEntity(state);
  const scene = activeProjectScene(state);

  const updateActor = (next: SceneActorInstance): void =>
    executeReplacement(
      state,
      dispatch,
      {
        kind: "replace-actor-instance",
        sceneId: state.activeSceneId,
        instanceId: next.id,
        instance: next,
      },
      "Updated actor placement.",
    );

  const updateObject = (next: SceneObjectInstance): void =>
    executeReplacement(
      state,
      dispatch,
      {
        kind: "replace-object-instance",
        sceneId: state.activeSceneId,
        instanceId: next.id,
        instance: next,
      },
      "Updated object placement.",
    );

  const updatePortal = (next: SceneNavigationPortal): void =>
    executeReplacement(
      state,
      dispatch,
      {
        kind: "replace-navigation-portal",
        sceneId: state.activeSceneId,
        portalId: next.id,
        portal: next,
      },
      "Updated navigation portal.",
    );

  return (
    <aside className="sidebar inspector-sidebar">
      <div className="inspector-heading">
        <span className="eyebrow">INSPECTOR</span>
        <h2>{selectionTitle(state)}</h2>
        <code>{entity?.value.id ?? scene.id}</code>
      </div>

      {!entity ? (
        <div className="inspector-empty">
          <span className="empty-mark">⌖</span>
          <h3>Scene composition</h3>
          <p>Select an actor, object or portal to edit its authored placement.</p>
          <dl>
            <div>
              <dt>Native size</dt>
              <dd>
                {scene.width} × {scene.height}
              </dd>
            </div>
            <div>
              <dt>Walk areas</dt>
              <dd>{scene.navigationAreas.length}</dd>
            </div>
            <div>
              <dt>Depth bands</dt>
              <dd>{scene.depthBands.length}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {entity?.kind === "actor" ? (
        <div className="inspector-form">
          <section>
            <h3>Transform</h3>
            <div className="field-grid two-columns">
              <Field label="X">
                <NumberInput
                  value={entity.value.position.x}
                  onChange={(x) => updateActor({ ...entity.value, position: { ...entity.value.position, x } })}
                />
              </Field>
              <Field label="Y">
                <NumberInput
                  value={entity.value.position.y}
                  onChange={(y) => updateActor({ ...entity.value, position: { ...entity.value.position, y } })}
                />
              </Field>
            </div>
            <Field label="Scale">
              <NumberInput
                value={entity.value.scaleMultiplier}
                step={0.05}
                onChange={(scaleMultiplier) => updateActor({ ...entity.value, scaleMultiplier })}
              />
            </Field>
          </section>
          <section>
            <h3>Performance</h3>
            <Field label="Animation">
              <select
                value={entity.value.animationState}
                onChange={(event) =>
                  updateActor({ ...entity.value, animationState: event.currentTarget.value })
                }
              >
                {[...new Set(
                  state.project.actors
                    .find((candidate) => candidate.id === entity.value.actorId)
                    ?.animations.map((animation) => animation.state) ?? [],
                )].map((animationState) => (
                  <option key={animationState} value={animationState}>
                    {animationState}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Facing">
              <select
                value={entity.value.facing}
                onChange={(event) => updateActor({ ...entity.value, facing: event.currentTarget.value })}
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
            <Field label="Mobility">
              <select
                value={entity.value.mobility}
                onChange={(event) =>
                  updateActor({
                    ...entity.value,
                    mobility: event.currentTarget.value as SceneActorInstance["mobility"],
                  })
                }
              >
                <option value="walkable">Walkable</option>
                <option value="fixed">Fixed</option>
              </select>
            </Field>
          </section>
        </div>
      ) : null}

      {entity?.kind === "object" ? (
        <div className="inspector-form">
          <section>
            <h3>Transform</h3>
            <div className="field-grid two-columns">
              <Field label="X">
                <NumberInput
                  value={entity.value.position.x}
                  onChange={(x) => updateObject({ ...entity.value, position: { ...entity.value.position, x } })}
                />
              </Field>
              <Field label="Y">
                <NumberInput
                  value={entity.value.position.y}
                  onChange={(y) => updateObject({ ...entity.value, position: { ...entity.value.position, y } })}
                />
              </Field>
            </div>
            <Field label="Scale">
              <NumberInput
                value={entity.value.scaleMultiplier}
                step={0.05}
                onChange={(scaleMultiplier) => updateObject({ ...entity.value, scaleMultiplier })}
              />
            </Field>
          </section>
          <section>
            <h3>Composition</h3>
            <Field label="Layer">
              <select
                value={entity.value.layer}
                onChange={(event) =>
                  updateObject({
                    ...entity.value,
                    layer: event.currentTarget.value as SceneObjectInstance["layer"],
                  })
                }
              >
                <option value="rear-ambient">Rear ambient</option>
                <option value="world">World</option>
                <option value="occlusion">Occlusion</option>
                <option value="front-ambient">Front ambient</option>
              </select>
            </Field>
            <Field label="Initial state">
              <select
                value={entity.value.initialStateId ?? ""}
                onChange={(event) =>
                  updateObject({
                    ...entity.value,
                    ...(event.currentTarget.value
                      ? { initialStateId: asId<"object-state">(event.currentTarget.value) }
                      : { initialStateId: undefined }),
                  })
                }
              >
                <option value="">Definition default</option>
                {state.history.document.manifest.objectDefinitions
                  .find((candidate) => candidate.id === entity.value.definitionId)
                  ?.states.map((objectState) => (
                    <option key={objectState.id} value={objectState.id}>
                      {objectState.id.split(".").at(-1)}
                    </option>
                  ))}
              </select>
            </Field>
            <label className="toggle-row">
              <span>Mirror visual</span>
              <input
                type="checkbox"
                checked={entity.value.mirrored}
                onChange={(event) =>
                  updateObject({ ...entity.value, mirrored: event.currentTarget.checked })
                }
              />
            </label>
          </section>
        </div>
      ) : null}

      {entity?.kind === "portal" ? (
        <div className="inspector-form">
          <section>
            <h3>Portal endpoints</h3>
            <div className="field-grid two-columns">
              <Field label="From X">
                <NumberInput
                  value={entity.value.fromPoint.x}
                  onChange={(x) => updatePortal({ ...entity.value, fromPoint: { ...entity.value.fromPoint, x } })}
                />
              </Field>
              <Field label="From Y">
                <NumberInput
                  value={entity.value.fromPoint.y}
                  onChange={(y) => updatePortal({ ...entity.value, fromPoint: { ...entity.value.fromPoint, y } })}
                />
              </Field>
              <Field label="To X">
                <NumberInput
                  value={entity.value.toPoint.x}
                  onChange={(x) => updatePortal({ ...entity.value, toPoint: { ...entity.value.toPoint, x } })}
                />
              </Field>
              <Field label="To Y">
                <NumberInput
                  value={entity.value.toPoint.y}
                  onChange={(y) => updatePortal({ ...entity.value, toPoint: { ...entity.value.toPoint, y } })}
                />
              </Field>
            </div>
            <label className="toggle-row">
              <span>Bidirectional</span>
              <input
                type="checkbox"
                checked={entity.value.bidirectional}
                onChange={(event) =>
                  updatePortal({ ...entity.value, bidirectional: event.currentTarget.checked })
                }
              />
            </label>
          </section>
          <section>
            <h3>Navigation areas</h3>
            <Field label="From">
              <select
                value={entity.value.fromAreaId}
                onChange={(event) =>
                  updatePortal({
                    ...entity.value,
                    fromAreaId: asId<"navigation-area">(event.currentTarget.value),
                  })
                }
              >
                {scene.navigationAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.id.split(".").at(-1)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="To">
              <select
                value={entity.value.toAreaId}
                onChange={(event) =>
                  updatePortal({
                    ...entity.value,
                    toAreaId: asId<"navigation-area">(event.currentTarget.value),
                  })
                }
              >
                {scene.navigationAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.id.split(".").at(-1)}
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

const downloadManifest = (state: StudioWorkspaceState): void => {
  const text = `${JSON.stringify(state.history.document.manifest, null, 2)}\n`;
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "scene-instances.json";
  anchor.click();
  URL.revokeObjectURL(url);
};

export const App = () => {
  const [state, dispatch] = useReducer(
    studioWorkspaceReducer,
    createStudioWorkspace(studioProject, studioSceneInstances),
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const dirty = workspaceIsDirty(state);
  const composition = useMemo(() => activeSceneComposition(state), [state]);

  const save = useCallback(() => {
    downloadManifest(state);
    dispatch({ type: "mark-saved" });
  }, [state]);

  const removeSelection = useCallback(() => {
    const command = deleteSelectionCommand(state);
    if (command) {
      dispatch({
        type: "execute",
        command,
        selection: null,
        notice: "Removed scene instance.",
      });
    }
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
      } else if (event.key === "Delete" || event.key === "Backspace") {
        const target = event.target as HTMLElement | null;
        if (target?.matches("input, select, textarea")) return;
        removeSelection();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removeSelection, save]);

  const openManifest = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const manifest = parseSceneInstanceManifest(JSON.parse(await file.text()) as unknown);
      if (manifest.projectId !== state.project.id) {
        throw new Error(
          `Manifest project '${manifest.projectId}' does not match '${state.project.id}'.`,
        );
      }
      dispatch({ type: "replace-manifest", manifest });
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "The scene composition could not be opened.",
      );
    }
  };

  const addActor = (): void => {
    try {
      const addition = insertActorCommand(state);
      dispatch({
        type: "execute",
        command: addition.command,
        selection: addition.selection,
        notice: "Placed a new actor instance.",
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Actor placement failed.");
    }
  };

  const addObject = (): void => {
    try {
      const addition = insertObjectCommand(state);
      dispatch({
        type: "execute",
        command: addition.command,
        selection: addition.selection,
        notice: "Placed a new object instance.",
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Object placement failed.");
    }
  };

  return (
    <div className="studio-app">
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
          <strong>{activeProjectScene(state).name}</strong>
          {dirty ? <i>●</i> : null}
        </div>
        <div className="topbar-actions">
          <Button onClick={() => fileInput.current?.click()} title="Open scene instance manifest">
            Open
          </Button>
          <Button onClick={save} className="primary-button" title="Export scene instance manifest">
            Export JSON
          </Button>
          <input
            ref={fileInput}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(event) => void openManifest(event)}
          />
        </div>
      </header>

      <div className="toolbar">
        <div className="toolbar-group">
          <Button
            onClick={() => dispatch({ type: "undo" })}
            disabled={state.history.undoStack.length === 0}
            title="Undo (Ctrl+Z)"
          >
            <Icon>↶</Icon>
          </Button>
          <Button
            onClick={() => dispatch({ type: "redo" })}
            disabled={state.history.redoStack.length === 0}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Icon>↷</Icon>
          </Button>
          <ToolbarDivider />
          <Button onClick={addActor} title="Place actor instance">
            <Icon>＋A</Icon>
          </Button>
          <Button onClick={addObject} title="Place object instance">
            <Icon>＋O</Icon>
          </Button>
          <Button
            onClick={removeSelection}
            disabled={!state.selection}
            title="Delete selected instance"
          >
            <Icon>⌫</Icon>
          </Button>
        </div>
        <div className="toolbar-group center-tools">
          <Button
            active={state.view.showGrid}
            onClick={() => dispatch({ type: "toggle-grid" })}
            title="Toggle native pixel grid"
          >
            Grid
          </Button>
          <Button
            active={state.view.showNavigation}
            onClick={() => dispatch({ type: "toggle-navigation" })}
            title="Toggle navigation areas"
          >
            Walkmesh
          </Button>
          <Button
            active={state.view.showPortals}
            onClick={() => dispatch({ type: "toggle-portals" })}
            title="Toggle navigation portals"
          >
            Portals
          </Button>
        </div>
        <div className="toolbar-group zoom-tools">
          <Button
            onClick={() => dispatch({ type: "set-zoom", zoom: state.view.zoom - 0.25 })}
            title="Zoom out"
          >
            −
          </Button>
          <span>{Math.round(state.view.zoom * 100)}%</span>
          <Button
            onClick={() => dispatch({ type: "set-zoom", zoom: state.view.zoom + 0.25 })}
            title="Zoom in"
          >
            +
          </Button>
        </div>
      </div>

      <main className="workspace-grid">
        <SceneTree state={state} dispatch={dispatch} />
        <section className="canvas-workspace">
          <div className="canvas-header">
            <div>
              <span className="eyebrow">SCENE COMPOSER</span>
              <h1>{activeProjectScene(state).name}</h1>
            </div>
            <div className="canvas-meta">
              <span>{activeProjectScene(state).width} × {activeProjectScene(state).height}</span>
              <span>{composition.actorInstances.length} actors</span>
              <span>{composition.objectInstances.length} objects</span>
            </div>
          </div>
          <div className="canvas-body">
            <LayersPanel state={state} dispatch={dispatch} />
            <EditorViewport state={state} dispatch={dispatch} />
          </div>
          <footer className="canvas-footer">
            <span>{state.notice ?? "Drag instances to place them on native pixels."}</span>
            <span>
              Revision {state.history.document.operationRevision} ·{" "}
              {state.history.undoStack.length} undo steps
            </span>
          </footer>
        </section>
        <Inspector state={state} dispatch={dispatch} />
      </main>
    </div>
  );
};
