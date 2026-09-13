import type { Id, SequenceCue, SequenceTrack } from "@evavo/adventure-project-schema";
import {
  type Dispatch,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { timelineSequence } from "./fixture.js";
import {
  createTimelineWorkspace,
  insertCueCommand,
  moveSelectedCueCommand,
  removeSelectedCueCommand,
  replaceSelectedCueCommand,
  selectedTimelineCue,
  type TimelineSelection,
  type TimelineWorkspaceAction,
  timelineSequenceDocument,
  timelineWorkspaceIsDirty,
  timelineWorkspaceReducer,
} from "./workspace.js";

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

const cueDuration = (cue: SequenceCue): number => {
  switch (cue.kind) {
    case "actor-move":
    case "camera-shot":
      return cue.durationTicks;
    case "speech":
      return cue.durationTicks ?? 1;
    default:
      return 1;
  }
};

const cueLabel = (cue: SequenceCue): string => {
  switch (cue.kind) {
    case "actor-move":
      return `Move · ${cue.actorId.split(".").at(-1)}`;
    case "actor-animation":
      return `${cue.animationState} · ${cue.actorId.split(".").at(-1)}`;
    case "camera-shot":
      return `Camera ${cue.position.x}, ${cue.position.y}`;
    case "speech":
      return cue.text;
    case "sound":
      return `Play ${cue.assetId.split(".").at(-1)}`;
    case "stop-audio":
      return `Stop ${cue.bus}`;
    case "layer-visibility":
      return `${cue.visible ? "Show" : "Hide"} ${cue.layerId}`;
    case "palette-cycle":
      return `${cue.enabled ? "Cycle" : "Stop"} palette`;
    case "story-action":
      return cue.action.kind;
  }
};

const trackColor = (track: SequenceTrack): string => {
  switch (track.kind) {
    case "actor":
      return "#d0aa72";
    case "camera":
      return "#79b9d1";
    case "dialogue":
      return "#ff718d";
    case "audio":
      return "#9c89d8";
    case "story":
      return "#6bd9a6";
    case "effects":
      return "#d18d5e";
  }
};

const selectionFor = (track: SequenceTrack, cueIndex: number): TimelineSelection => {
  const cue = track.cues[cueIndex];
  if (!cue) throw new RangeError("Timeline cue index is invalid.");
  return { trackId: track.id, cueIndex, expectedCue: cue };
};

interface CueDrag {
  readonly pointerId: number;
  readonly selection: TimelineSelection;
  readonly originClientX: number;
  readonly originTick: number;
  readonly previewTick: number;
}

const downloadSequence = (sequence: ReturnType<typeof timelineSequenceDocument>): void => {
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(sequence, null, 2)}\n`], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sequence.id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const NumberField = ({
  label,
  value,
  onChange,
  step = 1,
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly step?: number;
}) => (
  <label className="field">
    <span>{label}</span>
    <input
      type="number"
      value={value}
      step={step}
      onChange={(event) => {
        const next = Number(event.currentTarget.value);
        if (Number.isFinite(next)) onChange(next);
      }}
    />
  </label>
);

const CueInspector = ({
  state,
  dispatch,
}: {
  readonly state: ReturnType<typeof createTimelineWorkspace>;
  readonly dispatch: Dispatch<TimelineWorkspaceAction>;
}) => {
  const selected = selectedTimelineCue(state);
  if (!selected) {
    return (
      <aside className="timeline-inspector">
        <span className="eyebrow">CUE INSPECTOR</span>
        <div className="timeline-empty-inspector">
          <span>◆</span>
          <h2>Select a cinematic cue</h2>
          <p>Drag cue blocks on the fixed-tick timeline or edit exact values here.</p>
        </div>
      </aside>
    );
  }
  const { cue, track } = selected;
  const replace = (next: SequenceCue): void =>
    dispatch({
      type: "execute",
      command: replaceSelectedCueCommand(state, next),
      selection: {
        trackId: track.id,
        cueIndex: state.selection!.cueIndex,
        expectedCue: next,
      },
      notice: "Updated cinematic cue.",
    });
  const move = (atTick: number): void => {
    const edit = moveSelectedCueCommand(state, atTick);
    dispatch({
      type: "execute",
      command: edit.command,
      selection: edit.selection,
      notice: "Moved cue on the fixed-tick timeline.",
    });
  };

  return (
    <aside className="timeline-inspector">
      <div className="timeline-inspector-heading">
        <span className="eyebrow">CUE INSPECTOR</span>
        <h2>{cue.kind}</h2>
        <code>{track.id}</code>
      </div>
      <div className="timeline-inspector-form">
        <NumberField label="Start tick" value={cue.atTick} onChange={move} />
        {cue.kind === "actor-move" || cue.kind === "camera-shot" ? (
          <NumberField
            label="Duration ticks"
            value={cue.durationTicks}
            onChange={(durationTicks) =>
              replace({ ...cue, durationTicks: Math.max(1, Math.round(durationTicks)) })
            }
          />
        ) : null}
        {cue.kind === "speech" ? (
          <>
            <label className="field">
              <span>Dialogue text</span>
              <textarea
                rows={7}
                value={cue.text}
                onChange={(event) =>
                  replace({
                    ...cue,
                    text: event.currentTarget.value || "New cinematic line.",
                  })
                }
              />
            </label>
            <NumberField
              label="Duration ticks"
              value={cue.durationTicks ?? 1}
              onChange={(durationTicks) =>
                replace({
                  ...cue,
                  durationTicks: Math.max(1, Math.round(durationTicks)),
                })
              }
            />
          </>
        ) : null}
        {cue.kind === "actor-animation" ? (
          <>
            <label className="field">
              <span>Animation state</span>
              <input
                value={cue.animationState}
                onChange={(event) =>
                  replace({
                    ...cue,
                    animationState: event.currentTarget.value || "idle",
                  })
                }
              />
            </label>
            <label className="field">
              <span>Facing</span>
              <input
                value={cue.facing ?? ""}
                placeholder="Preserve current"
                onChange={(event) => {
                  const facing = event.currentTarget.value.trim();
                  if (facing) {
                    replace({ ...cue, facing });
                  } else {
                    const { facing: _facing, ...rest } = cue;
                    replace(rest);
                  }
                }}
              />
            </label>
          </>
        ) : null}
        {cue.kind === "sound" ? (
          <>
            <label className="field">
              <span>Audio asset ID</span>
              <input
                value={cue.assetId}
                onChange={(event) =>
                  replace({
                    ...cue,
                    assetId: event.currentTarget.value as Id<"asset">,
                  })
                }
              />
            </label>
            <NumberField
              label="Volume"
              value={cue.volume}
              step={0.05}
              onChange={(volume) => replace({ ...cue, volume: Math.min(1, Math.max(0, volume)) })}
            />
          </>
        ) : null}
        {cue.kind === "camera-shot" ? (
          <div className="timeline-field-grid">
            <NumberField
              label="Camera X"
              value={cue.position.x}
              onChange={(x) => replace({ ...cue, position: { ...cue.position, x } })}
            />
            <NumberField
              label="Camera Y"
              value={cue.position.y}
              onChange={(y) => replace({ ...cue, position: { ...cue.position, y } })}
            />
          </div>
        ) : null}
        {cue.kind === "story-action" ? (
          <div className="timeline-action-summary">
            <span>STORY ACTION</span>
            <strong>{cue.action.kind}</strong>
            <code>{JSON.stringify(cue.action)}</code>
          </div>
        ) : null}
      </div>
    </aside>
  );
};

export const App = () => {
  const [state, dispatch] = useReducer(timelineWorkspaceReducer, createTimelineWorkspace(timelineSequence));
  const [drag, setDrag] = useState<CueDrag | null>(null);
  const sequence = timelineSequenceDocument(state);
  const dirty = timelineWorkspaceIsDirty(state);
  const timelineWidth = Math.max(900, sequence.durationTicks * state.pixelsPerTick);
  const rulerTicks = useMemo(() => {
    const interval = state.pixelsPerTick >= 3 ? 12 : state.pixelsPerTick >= 1 ? 30 : 60;
    return Array.from(
      { length: Math.floor(sequence.durationTicks / interval) + 1 },
      (_value, index) => index * interval,
    );
  }, [sequence.durationTicks, state.pixelsPerTick]);

  const save = useCallback(() => {
    downloadSequence(sequence);
    dispatch({ type: "mark-saved" });
  }, [sequence]);

  const addCue = (trackId: Id<"sequence-track">): void => {
    try {
      const addition = insertCueCommand(state, trackId);
      dispatch({
        type: "execute",
        command: addition.command,
        selection: addition.selection,
        notice: "Added a cue at the playhead.",
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Cue creation failed.");
    }
  };

  const removeCue = (): void => {
    try {
      dispatch({
        type: "execute",
        command: removeSelectedCueCommand(state),
        selection: null,
        notice: "Removed the cinematic cue.",
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Cue removal failed.");
    }
  };

  const commitDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    try {
      const current = { ...state, selection: drag.selection };
      const move = moveSelectedCueCommand(current, drag.previewTick);
      dispatch({
        type: "execute",
        command: move.command,
        selection: move.selection,
        notice: "Moved cinematic cue.",
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Cue move failed.");
    }
    setDrag(null);
  };

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
        if (!target?.matches("input, textarea, select") && state.selection) {
          removeCue();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save, state]);

  return (
    <div className="timeline-app">
      <header className="timeline-topbar">
        <div className="timeline-brand">
          <span>E</span>
          <div>
            <strong>EVAVO</strong>
            <small>CINEMATIC TIMELINE LAB</small>
          </div>
        </div>
        <div className="timeline-document-title">
          <span>{sequence.mode.toUpperCase()}</span>
          <strong>{sequence.name}</strong>
          {dirty ? <i>●</i> : null}
        </div>
        <div className="timeline-top-actions">
          <Button onClick={save} className="primary-button">
            Export Sequence
          </Button>
        </div>
      </header>

      <div className="timeline-toolbar">
        <div className="timeline-toolbar-group">
          <Button onClick={() => dispatch({ type: "undo" })} disabled={state.history.undoStack.length === 0}>
            ↶
          </Button>
          <Button onClick={() => dispatch({ type: "redo" })} disabled={state.history.redoStack.length === 0}>
            ↷
          </Button>
          <Button onClick={removeCue} disabled={!state.selection}>
            ⌫ Cue
          </Button>
        </div>
        <div className="timeline-playhead-readout">
          <span>PLAYHEAD</span>
          <strong>{state.playheadTick}</strong>
          <small>{(state.playheadTick / 60).toFixed(2)}s @ 60 tps</small>
        </div>
        <div className="timeline-toolbar-group">
          <label>
            Snap
            <select
              value={state.snapTicks}
              onChange={(event) =>
                dispatch({
                  type: "set-snap",
                  snapTicks: Number(event.currentTarget.value),
                })
              }
            >
              {[1, 3, 6, 12, 30].map((value) => (
                <option key={value} value={value}>
                  {value} ticks
                </option>
              ))}
            </select>
          </label>
          <Button
            onClick={() =>
              dispatch({
                type: "set-zoom",
                pixelsPerTick: state.pixelsPerTick - 0.25,
              })
            }
          >
            −
          </Button>
          <span>{state.pixelsPerTick.toFixed(2)} px/t</span>
          <Button
            onClick={() =>
              dispatch({
                type: "set-zoom",
                pixelsPerTick: state.pixelsPerTick + 0.25,
              })
            }
          >
            +
          </Button>
        </div>
      </div>

      <main className="timeline-main">
        <section className="timeline-editor">
          <div className="timeline-header-row">
            <div className="timeline-track-label-header">TRACKS</div>
            <div
              className="timeline-ruler-scroll"
              onPointerDown={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                dispatch({
                  type: "set-playhead",
                  playheadTick: state.scrollTick + (event.clientX - bounds.left) / state.pixelsPerTick,
                });
              }}
            >
              <div className="timeline-ruler" style={{ width: timelineWidth }}>
                {rulerTicks.map((tick) => (
                  <span key={tick} style={{ left: tick * state.pixelsPerTick }}>
                    <i />
                    <em>{tick}</em>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="timeline-track-scroll">
            <div className="timeline-track-table">
              {sequence.tracks.map((track) => (
                <div className="timeline-track-row" key={track.id}>
                  <div className="timeline-track-label">
                    <span style={{ background: trackColor(track) }} />
                    <div>
                      <strong>{track.kind}</strong>
                      <small>{track.id.split(".").at(-1)}</small>
                    </div>
                    <button type="button" onClick={() => addCue(track.id)}>
                      ＋
                    </button>
                  </div>
                  <div
                    className="timeline-track-lane"
                    style={{ width: timelineWidth }}
                    onPointerMove={(event) => {
                      if (!drag || drag.pointerId !== event.pointerId) return;
                      const delta = (event.clientX - drag.originClientX) / state.pixelsPerTick;
                      const tick = Math.max(0, Math.min(sequence.durationTicks - 1, drag.originTick + delta));
                      setDrag({ ...drag, previewTick: tick });
                    }}
                    onPointerUp={commitDrag}
                    onPointerCancel={() => setDrag(null)}
                    onPointerDown={(event) => {
                      if (event.target === event.currentTarget) {
                        const bounds = event.currentTarget.getBoundingClientRect();
                        dispatch({
                          type: "set-playhead",
                          playheadTick: (event.clientX - bounds.left) / state.pixelsPerTick,
                        });
                        dispatch({ type: "select", selection: null });
                      }
                    }}
                  >
                    {track.cues.map((cue, cueIndex) => {
                      const selection = selectionFor(track, cueIndex);
                      const selected =
                        state.selection?.trackId === track.id && state.selection.cueIndex === cueIndex;
                      const previewTick =
                        drag?.selection.trackId === track.id && drag.selection.cueIndex === cueIndex
                          ? drag.previewTick
                          : cue.atTick;
                      return (
                        <button
                          type="button"
                          key={`${track.id}-${cueIndex}-${cue.kind}`}
                          className={`timeline-cue ${selected ? "is-active" : ""}`}
                          style={{
                            left: previewTick * state.pixelsPerTick,
                            width: Math.max(4, cueDuration(cue) * state.pixelsPerTick),
                            borderColor: trackColor(track),
                            backgroundColor: `${trackColor(track)}22`,
                          }}
                          title={`${cue.kind} at tick ${cue.atTick}`}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            event.currentTarget.setPointerCapture(event.pointerId);
                            dispatch({ type: "select", selection });
                            setDrag({
                              pointerId: event.pointerId,
                              selection,
                              originClientX: event.clientX,
                              originTick: cue.atTick,
                              previewTick: cue.atTick,
                            });
                          }}
                        >
                          <span>{cue.kind}</span>
                          <strong>{cueLabel(cue)}</strong>
                        </button>
                      );
                    })}
                    <i
                      className="timeline-playhead"
                      style={{ left: state.playheadTick * state.pixelsPerTick }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <footer className="timeline-footer">
            <span>{state.notice ?? "Drag cues, click the ruler, or add at the playhead."}</span>
            <span>
              {sequence.durationTicks} ticks · {(sequence.durationTicks / 60).toFixed(2)}s
            </span>
          </footer>
        </section>

        <CueInspector state={state} dispatch={dispatch} />
      </main>
    </div>
  );
};
