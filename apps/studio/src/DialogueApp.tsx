import type { DialogueChoice, DialogueLine, DialogueNode, Id } from "@evavo/adventure-project-schema";
import { type Dispatch, type ReactNode, useCallback, useEffect, useReducer } from "react";
import { studioDialogueGraph } from "./dialogue-fixture.js";
import {
  createDialogueWorkspace,
  type DialogueWorkspaceAction,
  type DialogueWorkspaceState,
  dialogueGraph,
  dialogueWorkspaceIsDirty,
  dialogueWorkspaceReducer,
  insertDialogueChoiceCommand,
  insertDialogueLineCommand,
  insertDialogueNodeCommand,
  removeSelectedDialogueChoiceCommand,
  removeSelectedDialogueLineCommand,
  removeSelectedDialogueNodeCommand,
  replaceSelectedDialogueChoiceCommand,
  replaceSelectedDialogueLineCommand,
  replaceSelectedDialogueNodeCommand,
  selectedDialogueChoice,
  selectedDialogueLine,
  selectedDialogueNode,
} from "./dialogue-workspace.js";
import { studioProject } from "./fixture.js";
import "./dialogue.css";

type DialogueDispatch = Dispatch<DialogueWorkspaceAction>;

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

const shortId = (value: string): string => value.split(".").at(-1) ?? value;

const removeSpeaker = (line: DialogueLine): DialogueLine => {
  const { speakerId: _speakerId, ...rest } = line;
  return rest;
};

const removeAnimation = (line: DialogueLine): DialogueLine => {
  const { animationState: _animationState, ...rest } = line;
  return rest;
};

const removeNextNode = (choice: DialogueChoice): DialogueChoice => {
  const { nextNodeId: _nextNodeId, ...rest } = choice;
  return rest;
};

const removeAutoNext = (node: DialogueNode): DialogueNode => {
  const { autoNextNodeId: _autoNextNodeId, ...rest } = node;
  return rest;
};

const downloadDialogue = (state: DialogueWorkspaceState): void => {
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(dialogueGraph(state), null, 2)}\n`], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${dialogueGraph(state).id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const DialogueInspector = ({
  state,
  dispatch,
}: {
  readonly state: DialogueWorkspaceState;
  readonly dispatch: DialogueDispatch;
}) => {
  const graph = dialogueGraph(state);
  const node = selectedDialogueNode(state);
  const line = selectedDialogueLine(state);
  const choice = selectedDialogueChoice(state);

  const replaceLine = (next: DialogueLine): void =>
    dispatch({
      type: "execute",
      command: replaceSelectedDialogueLineCommand(state, next),
      notice: "Updated dialogue line.",
    });
  const replaceChoice = (next: DialogueChoice): void =>
    dispatch({
      type: "execute",
      command: replaceSelectedDialogueChoiceCommand(state, next),
      notice: "Updated player choice.",
    });
  const replaceNode = (next: DialogueNode): void =>
    dispatch({
      type: "execute",
      command: replaceSelectedDialogueNodeCommand(state, next),
      notice: "Updated dialogue node.",
    });

  return (
    <aside className="sidebar inspector-sidebar dialogue-inspector">
      <div className="inspector-heading">
        <span className="eyebrow">DIALOGUE INSPECTOR</span>
        <h2>{line ? "Spoken line" : choice ? "Player choice" : shortId(node.id)}</h2>
        <code>{line?.id ?? choice?.id ?? node.id}</code>
      </div>

      {line ? (
        <div className="inspector-form">
          <section>
            <h3>Performance line</h3>
            <Field label="Speaker">
              <select
                value={line.speakerId ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  replaceLine(value ? { ...line, speakerId: value as Id<"actor"> } : removeSpeaker(line));
                }}
              >
                <option value="">Narration / no speaker</option>
                {studioProject.actors.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Text">
              <textarea
                rows={7}
                value={line.text}
                onChange={(event) =>
                  replaceLine({
                    ...line,
                    text: event.currentTarget.value || "New dialogue line.",
                  })
                }
              />
            </Field>
            <Field label="Animation state">
              <input
                value={line.animationState ?? ""}
                placeholder="Optional acting state"
                onChange={(event) => {
                  const value = event.currentTarget.value.trim();
                  replaceLine(value ? { ...line, animationState: value } : removeAnimation(line));
                }}
              />
            </Field>
            <label className="toggle-row">
              <span>Interruptible</span>
              <input
                type="checkbox"
                checked={line.interruptible}
                onChange={(event) =>
                  replaceLine({
                    ...line,
                    interruptible: event.currentTarget.checked,
                  })
                }
              />
            </label>
          </section>
        </div>
      ) : null}

      {choice ? (
        <div className="inspector-form">
          <section>
            <h3>Player response</h3>
            <Field label="Choice text">
              <textarea
                rows={5}
                value={choice.text}
                onChange={(event) =>
                  replaceChoice({
                    ...choice,
                    text: event.currentTarget.value || "New player choice.",
                  })
                }
              />
            </Field>
            <Field label="Next node">
              <select
                value={choice.nextNodeId ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  replaceChoice(
                    value
                      ? {
                          ...choice,
                          nextNodeId: value as Id<"dialogue-node">,
                          closeDialogue: false,
                        }
                      : removeNextNode(choice),
                  );
                }}
              >
                <option value="">No branch target</option>
                {graph.nodes.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {shortId(candidate.id)}
                  </option>
                ))}
              </select>
            </Field>
            <label className="toggle-row">
              <span>Close dialogue</span>
              <input
                type="checkbox"
                checked={choice.closeDialogue}
                onChange={(event) =>
                  replaceChoice({
                    ...choice,
                    closeDialogue: event.currentTarget.checked,
                    ...(event.currentTarget.checked
                      ? (() => {
                          const { nextNodeId: _nextNodeId, ...rest } = choice;
                          return rest;
                        })()
                      : {}),
                  })
                }
              />
            </label>
            <label className="toggle-row">
              <span>Exhaust after use</span>
              <input
                type="checkbox"
                checked={choice.once}
                onChange={(event) => replaceChoice({ ...choice, once: event.currentTarget.checked })}
              />
            </label>
            <div className="dialogue-stat-row">
              <span>Actions</span>
              <strong>{choice.actions.length}</strong>
            </div>
          </section>
        </div>
      ) : null}

      {!line && !choice ? (
        <div className="inspector-form">
          <section>
            <h3>Topic node</h3>
            <Field label="Automatic continuation">
              <select
                value={node.autoNextNodeId ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  replaceNode(
                    value
                      ? {
                          ...node,
                          autoNextNodeId: value as Id<"dialogue-node">,
                        }
                      : removeAutoNext(node),
                  );
                }}
              >
                <option value="">None</option>
                {graph.nodes
                  .filter((candidate) => candidate.id !== node.id)
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {shortId(candidate.id)}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="dialogue-stat-row">
              <span>Lines</span>
              <strong>{node.lines.length}</strong>
            </div>
            <div className="dialogue-stat-row">
              <span>Choices</span>
              <strong>{node.choices.length}</strong>
            </div>
            <div className="dialogue-stat-row">
              <span>Start node</span>
              <strong>{graph.startNodeId === node.id ? "yes" : "no"}</strong>
            </div>
          </section>
        </div>
      ) : null}
    </aside>
  );
};

export const DialogueApp = () => {
  const [state, dispatch] = useReducer(
    dialogueWorkspaceReducer,
    createDialogueWorkspace(studioDialogueGraph),
  );
  const graph = dialogueGraph(state);
  const node = selectedDialogueNode(state);
  const dirty = dialogueWorkspaceIsDirty(state);

  const addNode = (): void => {
    const addition = insertDialogueNodeCommand(state);
    dispatch({
      type: "execute",
      command: addition.command,
      nodeId: addition.nodeId,
      lineId: null,
      choiceId: null,
      notice: "Added a dialogue topic node.",
    });
  };

  const removeNode = (): void => {
    try {
      dispatch({
        type: "execute",
        command: removeSelectedDialogueNodeCommand(state),
        notice: "Removed the dialogue topic.",
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Dialogue node removal failed.");
    }
  };

  const addLine = (): void => {
    const addition = insertDialogueLineCommand(state);
    dispatch({
      type: "execute",
      command: addition.command,
      lineId: addition.lineId,
      choiceId: null,
      notice: "Added a spoken line.",
    });
  };

  const addChoice = (): void => {
    const addition = insertDialogueChoiceCommand(state);
    dispatch({
      type: "execute",
      command: addition.command,
      choiceId: addition.choiceId,
      lineId: null,
      notice: "Added a player choice.",
    });
  };

  const removeSelection = (): void => {
    try {
      const command = state.lineId
        ? removeSelectedDialogueLineCommand(state)
        : state.choiceId
          ? removeSelectedDialogueChoiceCommand(state)
          : removeSelectedDialogueNodeCommand(state);
      dispatch({
        type: "execute",
        command,
        lineId: null,
        choiceId: null,
        notice: "Removed dialogue content.",
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Dialogue removal failed.");
    }
  };

  const save = useCallback(() => {
    downloadDialogue(state);
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
    <div className="studio-app dialogue-app">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">E</span>
          <span>
            <strong>EVAVO</strong>
            <small>ADVENTURE STUDIO</small>
          </span>
        </div>
        <div className="document-title">
          <span>{graph.name}</span>
          <strong>Dialogue Graph</strong>
          {dirty ? <i>●</i> : null}
        </div>
        <div className="topbar-actions">
          <Button onClick={save} className="primary-button">
            Export Dialogue
          </Button>
        </div>
      </header>

      <div className="toolbar dialogue-toolbar">
        <div className="toolbar-group">
          <Button onClick={() => dispatch({ type: "undo" })} disabled={state.history.undoStack.length === 0}>
            ↶
          </Button>
          <Button onClick={() => dispatch({ type: "redo" })} disabled={state.history.redoStack.length === 0}>
            ↷
          </Button>
        </div>
        <div className="dialogue-toolbar-title">
          <span className="eyebrow">CONVERSATION GRAPH</span>
          <strong>{shortId(node.id)}</strong>
        </div>
        <div className="toolbar-group">
          <Button onClick={addNode}>＋ Topic</Button>
          <Button onClick={addLine}>＋ Line</Button>
          <Button onClick={addChoice}>＋ Choice</Button>
          <Button onClick={removeSelection}>⌫</Button>
        </div>
      </div>

      <main className="workspace-grid dialogue-grid">
        <aside className="sidebar dialogue-node-sidebar">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">TOPIC NODES</span>
              <h2>{graph.nodes.length} nodes</h2>
            </div>
          </div>
          <div className="dialogue-node-list">
            {graph.nodes.map((candidate, index) => (
              <button
                type="button"
                key={candidate.id}
                className={`dialogue-node-row ${candidate.id === state.nodeId ? "is-active" : ""}`}
                onClick={() => dispatch({ type: "select-node", nodeId: candidate.id })}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span>
                  <strong>{shortId(candidate.id)}</strong>
                  <small>
                    {candidate.lines.length} lines · {candidate.choices.length} choices
                  </small>
                </span>
                {candidate.id === graph.startNodeId ? <em>START</em> : null}
              </button>
            ))}
          </div>
          <div className="sidebar-footer">
            <span className={`save-indicator ${dirty ? "is-dirty" : ""}`} />
            {dirty ? "Unsaved dialogue edits" : "Dialogue graph saved"}
          </div>
        </aside>

        <section className="dialogue-workspace">
          <div className="dialogue-graph-strip">
            {graph.nodes.map((candidate, index) => (
              <button
                type="button"
                key={candidate.id}
                className={`graph-node-chip ${candidate.id === state.nodeId ? "is-active" : ""}`}
                onClick={() => dispatch({ type: "select-node", nodeId: candidate.id })}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{shortId(candidate.id)}</strong>
                <small>{candidate.choices.length} branches</small>
              </button>
            ))}
          </div>

          <div className="dialogue-content">
            <section className="dialogue-lines">
              <div className="dialogue-section-heading">
                <span>SPOKEN PERFORMANCE</span>
                <span>{node.lines.length}</span>
              </div>
              <div className="dialogue-line-list">
                {node.lines.map((line, index) => (
                  <button
                    type="button"
                    key={line.id}
                    className={`dialogue-line-row ${line.id === state.lineId ? "is-active" : ""}`}
                    onClick={() => dispatch({ type: "select-line", lineId: line.id })}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>
                      {studioProject.actors.find((actor) => actor.id === line.speakerId)?.name ?? "Narration"}
                    </strong>
                    <p>{line.text}</p>
                  </button>
                ))}
                {node.lines.length === 0 ? (
                  <div className="dialogue-empty">No spoken lines in this topic.</div>
                ) : null}
              </div>
            </section>

            <section className="dialogue-choices">
              <div className="dialogue-section-heading">
                <span>PLAYER CHOICES</span>
                <span>{node.choices.length}</span>
              </div>
              <div className="dialogue-choice-list">
                {node.choices.map((choice, index) => (
                  <button
                    type="button"
                    key={choice.id}
                    className={`dialogue-choice-row ${choice.id === state.choiceId ? "is-active" : ""}`}
                    onClick={() => dispatch({ type: "select-choice", choiceId: choice.id })}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{choice.text}</p>
                    <strong>
                      {choice.closeDialogue
                        ? "END"
                        : choice.nextNodeId
                          ? `→ ${shortId(choice.nextNodeId)}`
                          : "NO TARGET"}
                    </strong>
                  </button>
                ))}
                {node.choices.length === 0 ? (
                  <div className="dialogue-empty">No player choices in this topic.</div>
                ) : null}
              </div>
            </section>
          </div>
          <footer className="canvas-footer">
            <span>{state.notice ?? "Select a line or choice to edit it."}</span>
            <span>Revision {state.history.document.operationRevision}</span>
          </footer>
        </section>

        <DialogueInspector state={state} dispatch={dispatch} />
      </main>
    </div>
  );
};
