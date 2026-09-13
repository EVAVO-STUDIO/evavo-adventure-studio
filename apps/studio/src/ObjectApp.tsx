import type { Interaction } from "@evavo/adventure-project-schema";
import type { ObjectStateDefinition } from "@evavo/adventure-scene-instances";
import { type Dispatch, type ReactNode, useCallback, useEffect, useReducer } from "react";
import { studioProject, studioSceneInstances } from "./fixture.js";
import {
  createObjectWorkspace,
  insertObjectStateCommand,
  insertStateInteractionCommand,
  type ObjectWorkspaceAction,
  type ObjectWorkspaceState,
  objectManifest,
  objectWorkspaceIsDirty,
  objectWorkspaceReducer,
  removeSelectedInteractionCommand,
  removeSelectedObjectStateCommand,
  replaceSelectedInteractionCommand,
  replaceSelectedObjectStateCommand,
  selectedObjectDefinition,
  selectedObjectInteraction,
  selectedObjectState,
  setInitialObjectStateCommand,
} from "./object-workspace.js";
import "./objects.css";

type ObjectDispatch = Dispatch<ObjectWorkspaceAction>;

const Button = ({
  children,
  onClick,
  active = false,
  disabled = false,
  className = "",
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly active?: boolean;
  readonly disabled?: boolean;
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

const Field = ({ label, children }: { readonly label: string; readonly children: ReactNode }) => (
  <div className="field">
    <span>{label}</span>
    {children}
  </div>
);

const stateLabel = (state: ObjectStateDefinition): string => state.id.split(".").at(-1) ?? state.id;

const firstSpeech = (interaction: Interaction): string =>
  interaction.actions.find(
    (action): action is Extract<Interaction["actions"][number], { kind: "say" }> => action.kind === "say",
  )?.text ?? "";

const withSpeech = (interaction: Interaction, text: string): Interaction => {
  const actions = [...interaction.actions];
  const index = actions.findIndex((action) => action.kind === "say");
  const speech = { kind: "say" as const, text: text || "Nothing unusual." };
  if (index >= 0) {
    actions[index] = speech;
  } else {
    actions.unshift(speech);
  }
  return { ...interaction, actions };
};

const removeOptionalCursor = (state: ObjectStateDefinition): ObjectStateDefinition => {
  const { cursor: _cursor, ...rest } = state;
  return rest;
};

const removeOptionalFallback = (state: ObjectStateDefinition): ObjectStateDefinition => {
  const { fallbackText: _fallbackText, ...rest } = state;
  return rest;
};

const downloadManifest = (state: ObjectWorkspaceState): void => {
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(objectManifest(state), null, 2)}\n`], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "scene-instances.json";
  anchor.click();
  URL.revokeObjectURL(url);
};

const StateInspector = ({
  state,
  dispatch,
}: {
  readonly state: ObjectWorkspaceState;
  readonly dispatch: ObjectDispatch;
}) => {
  const definition = selectedObjectDefinition(state);
  const objectState = selectedObjectState(state);
  const interaction = selectedObjectInteraction(state);

  const replaceState = (next: ObjectStateDefinition): void =>
    dispatch({
      type: "execute",
      command: replaceSelectedObjectStateCommand(state, next),
      notice: "Updated object state.",
    });

  const replaceInteraction = (next: Interaction): void =>
    dispatch({
      type: "execute",
      command: replaceSelectedInteractionCommand(state, next),
      notice: "Updated state interaction.",
    });

  return (
    <aside className="sidebar inspector-sidebar object-inspector">
      <div className="inspector-heading">
        <span className="eyebrow">OBJECT INSPECTOR</span>
        <h2>
          {interaction
            ? interaction.verb
            : objectState
              ? stateLabel(objectState)
              : (definition?.name ?? "Objects")}
        </h2>
        <code>{interaction?.id ?? objectState?.id ?? definition?.id ?? "No selection"}</code>
      </div>

      {objectState && !interaction ? (
        <div className="inspector-form">
          <section>
            <h3>State behavior</h3>
            <label className="toggle-row">
              <span>Visible in scene</span>
              <input
                type="checkbox"
                checked={objectState.visible}
                onChange={(event) =>
                  replaceState({
                    ...objectState,
                    visible: event.currentTarget.checked,
                  })
                }
              />
            </label>
            <Field label="Cursor override">
              <input
                value={objectState.cursor ?? ""}
                placeholder="Automatic"
                onChange={(event) => {
                  const cursor = event.currentTarget.value.trim();
                  replaceState(cursor ? { ...objectState, cursor } : removeOptionalCursor(objectState));
                }}
              />
            </Field>
            <Field label="Fallback response">
              <textarea
                rows={4}
                value={objectState.fallbackText ?? ""}
                placeholder="Optional fallback line"
                onChange={(event) => {
                  const fallbackText = event.currentTarget.value;
                  replaceState(
                    fallbackText ? { ...objectState, fallbackText } : removeOptionalFallback(objectState),
                  );
                }}
              />
            </Field>
          </section>
          <section>
            <h3>Definition state</h3>
            <label className="toggle-row">
              <span>Initial state</span>
              <input
                type="checkbox"
                checked={definition?.initialStateId === objectState.id}
                onChange={() =>
                  dispatch({
                    type: "execute",
                    command: setInitialObjectStateCommand(state, objectState.id),
                    notice: "Changed the definition initial state.",
                  })
                }
              />
            </label>
            <div className="object-stat-row">
              <span>Interactions</span>
              <strong>{objectState.interactions.length}</strong>
            </div>
            <div className="object-stat-row">
              <span>Visual</span>
              <strong>{objectState.visual?.kind ?? "none"}</strong>
            </div>
          </section>
        </div>
      ) : null}

      {interaction ? (
        <div className="inspector-form">
          <section>
            <h3>Verb response</h3>
            <Field label="Verb">
              <input
                value={interaction.verb}
                onChange={(event) =>
                  replaceInteraction({
                    ...interaction,
                    verb: event.currentTarget.value || "look",
                  })
                }
              />
            </Field>
            <Field label="Spoken response">
              <textarea
                rows={6}
                value={firstSpeech(interaction)}
                onChange={(event) => replaceInteraction(withSpeech(interaction, event.currentTarget.value))}
              />
            </Field>
            <label className="toggle-row">
              <span>Use once</span>
              <input
                type="checkbox"
                checked={interaction.once === true}
                onChange={(event) =>
                  replaceInteraction({
                    ...interaction,
                    ...(event.currentTarget.checked
                      ? { once: true }
                      : (() => {
                          const { once: _once, ...rest } = interaction;
                          return rest;
                        })()),
                  })
                }
              />
            </label>
          </section>
          <section>
            <h3>Actions</h3>
            <div className="action-list">
              {interaction.actions.map((action, index) => (
                <div className="action-row" key={`${action.kind}-${index}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{action.kind}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {!objectState ? (
        <div className="inspector-empty">
          <span className="empty-mark">◇</span>
          <h3>Select an object state</h3>
          <p>Object states define visual appearance, cursor language and verbs.</p>
        </div>
      ) : null}
    </aside>
  );
};

export const ObjectApp = () => {
  const [state, dispatch] = useReducer(
    objectWorkspaceReducer,
    createObjectWorkspace(studioProject, studioSceneInstances),
  );
  const manifest = objectManifest(state);
  const definition = selectedObjectDefinition(state);
  const objectState = selectedObjectState(state);
  const dirty = objectWorkspaceIsDirty(state);

  const addState = (): void => {
    try {
      const addition = insertObjectStateCommand(state);
      dispatch({
        type: "execute",
        command: addition.command,
        stateId: addition.stateId,
        interactionId: null,
        notice: "Added a new object state.",
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "State creation failed.");
    }
  };

  const removeState = (): void => {
    try {
      const removal = removeSelectedObjectStateCommand(state);
      dispatch({
        type: "execute",
        command: removal.command,
        stateId: removal.nextStateId,
        interactionId: null,
        notice: "Removed the object state.",
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "State removal failed.");
    }
  };

  const addInteraction = (): void => {
    try {
      const addition = insertStateInteractionCommand(state);
      dispatch({
        type: "execute",
        command: addition.command,
        interactionId: addition.interactionId,
        notice: "Added a state-specific verb.",
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Interaction creation failed.");
    }
  };

  const removeInteraction = (): void => {
    try {
      dispatch({
        type: "execute",
        command: removeSelectedInteractionCommand(state),
        interactionId: null,
        notice: "Removed the state interaction.",
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Interaction removal failed.");
    }
  };

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
    <div className="studio-app object-app">
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
          <strong>Object State Studio</strong>
          {dirty ? <i>●</i> : null}
        </div>
        <div className="topbar-actions">
          <a className="button" href="/">
            Scene composer
          </a>
          <Button onClick={save} className="primary-button">
            Export Objects
          </Button>
        </div>
      </header>

      <div className="toolbar object-toolbar">
        <div className="toolbar-group">
          <Button onClick={() => dispatch({ type: "undo" })} disabled={state.history.undoStack.length === 0}>
            ↶
          </Button>
          <Button onClick={() => dispatch({ type: "redo" })} disabled={state.history.redoStack.length === 0}>
            ↷
          </Button>
        </div>
        <div className="object-toolbar-title">
          <span className="eyebrow">STATE MACHINE</span>
          <strong>{definition?.name ?? "No object definition"}</strong>
        </div>
        <div className="toolbar-group">
          <Button onClick={addState} disabled={!definition}>
            ＋ State
          </Button>
          <Button onClick={removeState} disabled={!objectState}>
            − State
          </Button>
          <Button onClick={addInteraction} disabled={!objectState}>
            ＋ Verb
          </Button>
          <Button onClick={removeInteraction} disabled={!state.interactionId}>
            − Verb
          </Button>
        </div>
      </div>

      <main className="workspace-grid object-grid">
        <aside className="sidebar object-definition-sidebar">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">OBJECT LIBRARY</span>
              <h2>{manifest.objectDefinitions.length} definitions</h2>
            </div>
          </div>
          <div className="object-definition-list">
            {manifest.objectDefinitions.map((candidate) => (
              <button
                type="button"
                key={candidate.id}
                className={`object-definition-row ${candidate.id === state.definitionId ? "is-active" : ""}`}
                onClick={() =>
                  dispatch({
                    type: "select-definition",
                    definitionId: candidate.id,
                  })
                }
              >
                <span className="definition-symbol">◇</span>
                <span>
                  <strong>{candidate.name}</strong>
                  <small>{candidate.states.length} states</small>
                </span>
              </button>
            ))}
          </div>
          <div className="sidebar-footer">
            <span className={`save-indicator ${dirty ? "is-dirty" : ""}`} />
            {dirty ? "Unsaved object changes" : "Object definitions saved"}
          </div>
        </aside>

        <section className="object-workspace">
          <div className="object-workspace-header">
            <div>
              <span className="eyebrow">PERSISTENT OBJECT STATES</span>
              <h1>{definition?.name ?? "Object definitions"}</h1>
            </div>
            <span>{definition?.states.length ?? 0} states</span>
          </div>
          <div className="state-board">
            {definition?.states.map((candidate, index) => {
              const selected = candidate.id === state.stateId;
              const initial = candidate.id === definition.initialStateId;
              return (
                <button
                  type="button"
                  key={candidate.id}
                  className={`state-card ${selected ? "is-active" : ""}`}
                  onClick={() => dispatch({ type: "select-state", stateId: candidate.id })}
                >
                  <span className="state-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="state-preview">
                    <i className={candidate.visible ? "is-visible" : ""}>◇</i>
                  </span>
                  <span className="state-copy">
                    <strong>{stateLabel(candidate)}</strong>
                    <small>
                      {candidate.visible ? "visible" : "hidden"} · {candidate.interactions.length} verbs
                    </small>
                  </span>
                  {initial ? <span className="initial-pill">INITIAL</span> : null}
                </button>
              );
            })}
          </div>
          <div className="interaction-panel">
            <div className="interaction-heading">
              <span>STATE INTERACTIONS</span>
              <span>{objectState?.interactions.length ?? 0}</span>
            </div>
            <div className="interaction-list">
              {objectState?.interactions.map((interaction, index) => (
                <button
                  type="button"
                  key={interaction.id}
                  className={`interaction-row ${interaction.id === state.interactionId ? "is-active" : ""}`}
                  onClick={() =>
                    dispatch({
                      type: "select-interaction",
                      interactionId: interaction.id,
                    })
                  }
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{interaction.verb}</strong>
                  <small>{firstSpeech(interaction) || interaction.actions[0]?.kind}</small>
                  <em>{interaction.actions.length} actions</em>
                </button>
              ))}
              {objectState && objectState.interactions.length === 0 ? (
                <div className="interaction-empty">
                  This state has no authored verbs. Add one to define player response.
                </div>
              ) : null}
            </div>
          </div>
          <footer className="canvas-footer">
            <span>{state.notice ?? "Select a state to edit its visual and verbs."}</span>
            <span>Revision {state.history.document.operationRevision}</span>
          </footer>
        </section>

        <StateInspector state={state} dispatch={dispatch} />
      </main>
    </div>
  );
};
