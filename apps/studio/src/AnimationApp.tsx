import {
  type AnimationEditorCommand,
  animationFrameTimeline,
  applyAnimationEditorCommand,
  frameUsage,
} from "@evavo/adventure-animation-editor-core";
import type { Actor, AnimationClip, Point, SpriteFrame } from "@evavo/adventure-project-schema";
import {
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import {
  type AnimationWorkspaceAction,
  type AnimationWorkspaceState,
  activeAnimationActor,
  animationWorkspaceIsDirty,
  animationWorkspaceReducer,
  appendSelectedFrameToClipCommand,
  createAnimationWorkspace,
  frameAtPlayhead,
  insertAnimationClipCommand,
  insertAnimationFrameCommand,
  removeSelectedClipFrameCommand,
  selectedAnimationClip,
  selectedAnimationFrame,
} from "./animation-workspace.js";
import { studioProject } from "./fixture.js";
import "./animation-editor.css";

type AnimationDispatch = Dispatch<AnimationWorkspaceAction>;

const FACINGS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
] as const;

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

const CommitInput = ({
  value,
  onCommit,
  placeholder,
}: {
  readonly value: string;
  readonly onCommit: (value: string) => void;
  readonly placeholder?: string;
}) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = (): void => {
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else setDraft(value);
  };

  return (
    <input
      value={draft}
      placeholder={placeholder}
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
  );
};

const CommitTextarea = ({
  value,
  onCommit,
  rows = 4,
}: {
  readonly value: string;
  readonly onCommit: (value: string) => void;
  readonly rows?: number;
}) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <textarea
      rows={rows}
      value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
};

const NumberInput = ({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}) => (
  <input
    type="number"
    value={value}
    min={min}
    max={max}
    step={step}
    onChange={(event) => {
      const parsed = Number(event.currentTarget.value);
      if (!Number.isFinite(parsed)) return;
      const integer = step >= 1 ? Math.round(parsed) : parsed;
      onChange(Math.min(max ?? integer, Math.max(min ?? integer, integer)));
    }}
  />
);

const shortId = (value: string): string => value.split(".").at(-1) ?? value;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, Math.round(value)));

const clampPoint = (point: Point, frame: SpriteFrame): Point => ({
  x: clamp(point.x, 0, frame.sourceSize.width),
  y: clamp(point.y, 0, frame.sourceSize.height),
});

const withSourceSize = (frame: SpriteFrame, width: number, height: number): SpriteFrame => {
  const sourceSize = {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
  const trimOffset = {
    x: clamp(frame.trimOffset.x, 0, sourceSize.width - 1),
    y: clamp(frame.trimOffset.y, 0, sourceSize.height - 1),
  };
  const sourceRect = {
    ...frame.sourceRect,
    width: clamp(frame.sourceRect.width, 1, Math.max(1, sourceSize.width - trimOffset.x)),
    height: clamp(frame.sourceRect.height, 1, Math.max(1, sourceSize.height - trimOffset.y)),
  };
  const draft = { ...frame, sourceSize, trimOffset, sourceRect };
  return {
    ...draft,
    pivot: clampPoint(frame.pivot, draft),
    footPoint: clampPoint(frame.footPoint, draft),
    ...(frame.shadowAnchor ? { shadowAnchor: clampPoint(frame.shadowAnchor, draft) } : {}),
    ...(frame.attachmentPoints
      ? {
          attachmentPoints: Object.fromEntries(
            Object.entries(frame.attachmentPoints).map(([name, point]) => [name, clampPoint(point, draft)]),
          ),
        }
      : {}),
  };
};

const withTrimOffset = (frame: SpriteFrame, x: number, y: number): SpriteFrame => {
  const trimOffset = {
    x: clamp(x, 0, frame.sourceSize.width - 1),
    y: clamp(y, 0, frame.sourceSize.height - 1),
  };
  return {
    ...frame,
    trimOffset,
    sourceRect: {
      ...frame.sourceRect,
      width: clamp(frame.sourceRect.width, 1, Math.max(1, frame.sourceSize.width - trimOffset.x)),
      height: clamp(frame.sourceRect.height, 1, Math.max(1, frame.sourceSize.height - trimOffset.y)),
    },
  };
};

const withTrimSize = (frame: SpriteFrame, width: number, height: number): SpriteFrame => ({
  ...frame,
  sourceRect: {
    ...frame.sourceRect,
    width: clamp(width, 1, Math.max(1, frame.sourceSize.width - frame.trimOffset.x)),
    height: clamp(height, 1, Math.max(1, frame.sourceSize.height - frame.trimOffset.y)),
  },
});

const downloadActor = (actor: Actor): void => {
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(actor, null, 2)}\n`], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${actor.id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const frameEventsText = (frame: SpriteFrame): string => (frame.events ?? []).join("\n");

const parseFrameEvents = (value: string): string[] => [
  ...new Set(
    value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  ),
];

const SpriteGeometryPreview = ({
  frame,
  assetLabel,
}: {
  readonly frame: SpriteFrame;
  readonly assetLabel: string;
}) => {
  const scale = Math.max(2, Math.min(7, 280 / frame.sourceSize.width, 340 / frame.sourceSize.height));
  const style = {
    "--sprite-width": `${frame.sourceSize.width * scale}px`,
    "--sprite-height": `${frame.sourceSize.height * scale}px`,
    "--trim-left": `${frame.trimOffset.x * scale}px`,
    "--trim-top": `${frame.trimOffset.y * scale}px`,
    "--trim-width": `${frame.sourceRect.width * scale}px`,
    "--trim-height": `${frame.sourceRect.height * scale}px`,
    "--pivot-x": `${frame.pivot.x * scale}px`,
    "--pivot-y": `${frame.pivot.y * scale}px`,
    "--foot-x": `${frame.footPoint.x * scale}px`,
    "--foot-y": `${frame.footPoint.y * scale}px`,
  } as CSSProperties;

  return (
    <div className="sprite-preview-stage">
      <div className="sprite-preview-canvas" style={style}>
        <div className="sprite-trim-region">
          <span className="sprite-figure-head" />
          <span className="sprite-figure-body" />
          <span className="sprite-figure-leg left" />
          <span className="sprite-figure-leg right" />
        </div>
        <span className="anchor pivot-anchor" title="Pivot" />
        <span className="anchor foot-anchor" title="Foot point" />
      </div>
      <div className="sprite-preview-caption">
        <code>{assetLabel}</code>
        <span>
          original {frame.sourceSize.width} × {frame.sourceSize.height} · trim {frame.sourceRect.width} ×{" "}
          {frame.sourceRect.height}
        </span>
      </div>
    </div>
  );
};

const CadenceTimeline = ({
  state,
  dispatch,
}: {
  readonly state: AnimationWorkspaceState;
  readonly dispatch: AnimationDispatch;
}) => {
  const actor = activeAnimationActor(state);
  const animation = selectedAnimationClip(state);
  if (!animation) {
    return <div className="animation-empty">No animation clip selected.</div>;
  }
  const timeline = animationFrameTimeline(actor, animation.id);
  const duration = Math.max(1, timeline.at(-1)?.endTick ?? 1);

  return (
    <div className="cadence-panel">
      <div className="cadence-heading">
        <span>
          {animation.state} · {animation.facing}
        </span>
        <strong>{duration} ticks</strong>
      </div>
      <div className="cadence-ruler">
        {Array.from({ length: Math.ceil(duration / 6) + 1 }, (_, index) => (
          <span key={index} style={{ left: `${(index * 6 * 100) / duration}%` }}>
            {index * 6}
          </span>
        ))}
      </div>
      <div className="cadence-track">
        <span className="cadence-playhead" style={{ left: `${(state.playheadTick * 100) / duration}%` }} />
        {timeline.map((entry) => (
          <button
            type="button"
            key={`${entry.frameId}:${entry.frameIndex}`}
            className={`cadence-block ${state.clipFrameIndex === entry.frameIndex ? "is-active" : ""}`}
            style={{
              left: `${(entry.startTick * 100) / duration}%`,
              width: `${(entry.durationTicks * 100) / duration}%`,
            }}
            onClick={() =>
              dispatch({
                type: "select-clip-frame",
                animationId: animation.id,
                frameIndex: entry.frameIndex,
              })
            }
          >
            <strong>{shortId(entry.frameId)}</strong>
            <small>{entry.durationTicks}t</small>
            {entry.events.map((marker) => (
              <i key={marker} title={marker} />
            ))}
          </button>
        ))}
      </div>
    </div>
  );
};

const AnimationInspector = ({
  state,
  execute,
}: {
  readonly state: AnimationWorkspaceState;
  readonly execute: (
    command: AnimationEditorCommand,
    options?: Partial<
      Pick<
        Extract<AnimationWorkspaceAction, { readonly type: "execute" }>,
        "frameId" | "animationId" | "clipFrameIndex" | "notice"
      >
    >,
  ) => void;
}) => {
  const actor = activeAnimationActor(state);
  const frame = selectedAnimationFrame(state);
  const animation = selectedAnimationClip(state);

  const replaceFrame = (next: SpriteFrame, notice = "Updated sprite frame."): void => {
    if (!frame) return;
    execute({ kind: "replace-frame", frameId: frame.id, frame: next }, { notice });
  };

  const replaceAnimation = (next: AnimationClip): void => {
    if (!animation) return;
    const duplicate = actor.animations.some(
      (candidate) =>
        candidate.id !== animation.id && candidate.state === next.state && candidate.facing === next.facing,
    );
    if (duplicate) {
      window.alert(`Another '${next.state}' animation already faces '${next.facing}'.`);
      return;
    }
    execute(
      {
        kind: "replace-animation",
        animationId: animation.id,
        animation: next,
      },
      { notice: "Updated animation clip." },
    );
  };

  return (
    <aside className="sidebar inspector-sidebar animation-inspector">
      <div className="inspector-heading">
        <span className="eyebrow">ANIMATION INSPECTOR</span>
        <h2>{frame ? shortId(frame.id) : actor.name}</h2>
        <code>{frame?.id ?? actor.id}</code>
      </div>

      {animation ? (
        <div className="inspector-form">
          <section>
            <h3>Performance clip</h3>
            <Field label="State">
              <CommitInput
                value={animation.state}
                onCommit={(stateName) => replaceAnimation({ ...animation, state: stateName })}
              />
            </Field>
            <Field label="Facing">
              <select
                value={animation.facing}
                onChange={(event) =>
                  replaceAnimation({
                    ...animation,
                    facing: event.currentTarget.value,
                  })
                }
              >
                {FACINGS.map((facing) => (
                  <option key={facing} value={facing}>
                    {facing}
                  </option>
                ))}
              </select>
            </Field>
            <label className="toggle-row">
              <span>Loop</span>
              <input
                type="checkbox"
                checked={animation.loop}
                onChange={(event) =>
                  replaceAnimation({
                    ...animation,
                    loop: event.currentTarget.checked,
                  })
                }
              />
            </label>
            <label className="toggle-row">
              <span>Interruptible</span>
              <input
                type="checkbox"
                checked={animation.interruptible}
                onChange={(event) =>
                  replaceAnimation({
                    ...animation,
                    interruptible: event.currentTarget.checked,
                  })
                }
              />
            </label>
            <div className="animation-stat-row">
              <span>Frame occurrences</span>
              <strong>{animation.frameIds.length}</strong>
            </div>
          </section>
        </div>
      ) : null}

      {frame ? (
        <div className="inspector-form">
          <section>
            <h3>Frame cadence</h3>
            <Field label="Duration ticks">
              <NumberInput
                value={frame.durationTicks}
                min={1}
                max={600}
                onChange={(durationTicks) => replaceFrame({ ...frame, durationTicks }, "Updated frame hold.")}
              />
            </Field>
            <Field label="Markers">
              <CommitTextarea
                value={frameEventsText(frame)}
                rows={3}
                onCommit={(value) => {
                  const events = parseFrameEvents(value);
                  const { events: _events, ...withoutEvents } = frame;
                  replaceFrame(
                    events.length > 0 ? { ...frame, events } : withoutEvents,
                    "Updated frame markers.",
                  );
                }}
              />
            </Field>
            <label className="toggle-row">
              <span>Mirror eligible</span>
              <input
                type="checkbox"
                checked={frame.mirrorEligible}
                onChange={(event) =>
                  replaceFrame({
                    ...frame,
                    mirrorEligible: event.currentTarget.checked,
                  })
                }
              />
            </label>
          </section>

          <section>
            <h3>Original canvas</h3>
            <div className="field-grid two-columns">
              <Field label="Width">
                <NumberInput
                  value={frame.sourceSize.width}
                  min={1}
                  max={2048}
                  onChange={(width) => replaceFrame(withSourceSize(frame, width, frame.sourceSize.height))}
                />
              </Field>
              <Field label="Height">
                <NumberInput
                  value={frame.sourceSize.height}
                  min={1}
                  max={2048}
                  onChange={(height) => replaceFrame(withSourceSize(frame, frame.sourceSize.width, height))}
                />
              </Field>
            </div>
          </section>

          <section>
            <h3>Atlas and trim</h3>
            <div className="field-grid two-columns">
              <Field label="Atlas X">
                <NumberInput
                  value={frame.sourceRect.x}
                  min={0}
                  max={16384}
                  onChange={(x) =>
                    replaceFrame({
                      ...frame,
                      sourceRect: { ...frame.sourceRect, x },
                    })
                  }
                />
              </Field>
              <Field label="Atlas Y">
                <NumberInput
                  value={frame.sourceRect.y}
                  min={0}
                  max={16384}
                  onChange={(y) =>
                    replaceFrame({
                      ...frame,
                      sourceRect: { ...frame.sourceRect, y },
                    })
                  }
                />
              </Field>
              <Field label="Trim X">
                <NumberInput
                  value={frame.trimOffset.x}
                  min={0}
                  max={frame.sourceSize.width - 1}
                  onChange={(x) => replaceFrame(withTrimOffset(frame, x, frame.trimOffset.y))}
                />
              </Field>
              <Field label="Trim Y">
                <NumberInput
                  value={frame.trimOffset.y}
                  min={0}
                  max={frame.sourceSize.height - 1}
                  onChange={(y) => replaceFrame(withTrimOffset(frame, frame.trimOffset.x, y))}
                />
              </Field>
              <Field label="Trim W">
                <NumberInput
                  value={frame.sourceRect.width}
                  min={1}
                  max={frame.sourceSize.width - frame.trimOffset.x}
                  onChange={(width) => replaceFrame(withTrimSize(frame, width, frame.sourceRect.height))}
                />
              </Field>
              <Field label="Trim H">
                <NumberInput
                  value={frame.sourceRect.height}
                  min={1}
                  max={frame.sourceSize.height - frame.trimOffset.y}
                  onChange={(height) => replaceFrame(withTrimSize(frame, frame.sourceRect.width, height))}
                />
              </Field>
            </div>
          </section>

          <section>
            <h3>Native anchors</h3>
            <div className="field-grid two-columns">
              <Field label="Pivot X">
                <NumberInput
                  value={frame.pivot.x}
                  min={0}
                  max={frame.sourceSize.width}
                  onChange={(x) =>
                    replaceFrame({
                      ...frame,
                      pivot: clampPoint({ ...frame.pivot, x }, frame),
                    })
                  }
                />
              </Field>
              <Field label="Pivot Y">
                <NumberInput
                  value={frame.pivot.y}
                  min={0}
                  max={frame.sourceSize.height}
                  onChange={(y) =>
                    replaceFrame({
                      ...frame,
                      pivot: clampPoint({ ...frame.pivot, y }, frame),
                    })
                  }
                />
              </Field>
              <Field label="Foot X">
                <NumberInput
                  value={frame.footPoint.x}
                  min={0}
                  max={frame.sourceSize.width}
                  onChange={(x) =>
                    replaceFrame({
                      ...frame,
                      footPoint: clampPoint({ ...frame.footPoint, x }, frame),
                    })
                  }
                />
              </Field>
              <Field label="Foot Y">
                <NumberInput
                  value={frame.footPoint.y}
                  min={0}
                  max={frame.sourceSize.height}
                  onChange={(y) =>
                    replaceFrame({
                      ...frame,
                      footPoint: clampPoint({ ...frame.footPoint, y }, frame),
                    })
                  }
                />
              </Field>
            </div>
          </section>
        </div>
      ) : null}
    </aside>
  );
};

export const AnimationApp = () => {
  const [state, dispatch] = useReducer(
    animationWorkspaceReducer,
    createAnimationWorkspace(studioProject.actors),
  );
  const actor = activeAnimationActor(state);
  const frame = selectedAnimationFrame(state);
  const animation = selectedAnimationClip(state);
  const displayFrame = state.playing ? (frameAtPlayhead(state) ?? frame) : frame;
  const dirty = animationWorkspaceIsDirty(state);
  const history = state.histories[state.activeActorId];

  const execute = useCallback(
    (
      command: AnimationEditorCommand,
      options: Partial<
        Pick<
          Extract<AnimationWorkspaceAction, { readonly type: "execute" }>,
          "frameId" | "animationId" | "clipFrameIndex" | "notice"
        >
      > = {},
    ): void => {
      try {
        applyAnimationEditorCommand(actor, command);
        dispatch({ type: "execute", command, ...options });
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Animation edit failed.");
      }
    },
    [actor],
  );

  const addFrame = (): void => {
    const addition = insertAnimationFrameCommand(state);
    execute(addition.command, {
      frameId: addition.frameId,
      clipFrameIndex: null,
      notice: "Added a sprite frame from the selected geometry.",
    });
  };

  const addClip = (): void => {
    const addition = insertAnimationClipCommand(state);
    execute(addition.command, {
      animationId: addition.animationId,
      clipFrameIndex: null,
      notice: "Added an animation clip.",
    });
  };

  const removeFrame = (): void => {
    if (!frame) return;
    execute(
      { kind: "remove-frame", frameId: frame.id },
      { frameId: null, notice: "Removed the sprite frame." },
    );
  };

  const removeClip = (): void => {
    if (!animation) return;
    execute(
      { kind: "remove-animation", animationId: animation.id },
      {
        animationId: null,
        clipFrameIndex: null,
        notice: "Removed the animation clip.",
      },
    );
  };

  const save = useCallback(() => {
    downloadActor(actor);
    dispatch({ type: "mark-saved" });
  }, [actor]);

  useEffect(() => {
    if (!state.playing) return;
    const handle = window.setInterval(() => dispatch({ type: "advance-playhead", ticks: 6 }), 100);
    return () => window.clearInterval(handle);
  }, [state.playing]);

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
      } else if (event.code === "Space" && !event.repeat) {
        const target = event.target as HTMLElement | null;
        if (target?.matches("input, textarea, select, button")) return;
        event.preventDefault();
        dispatch({ type: "toggle-playing" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  const frameUsageEntries = useMemo(() => (frame ? frameUsage(actor, frame.id) : []), [actor, frame]);

  return (
    <div className="studio-app animation-app">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">E</span>
          <span>
            <strong>EVAVO</strong>
            <small>ADVENTURE STUDIO</small>
          </span>
        </div>
        <div className="document-title">
          <span>{actor.name}</span>
          <strong>Sprite &amp; Animation</strong>
          {dirty ? <i>●</i> : null}
        </div>
        <div className="topbar-actions">
          <Button onClick={save} className="primary-button">
            Export Actor
          </Button>
        </div>
      </header>

      <div className="toolbar animation-toolbar">
        <div className="toolbar-group">
          <Button
            onClick={() => dispatch({ type: "undo" })}
            disabled={!history || history.undoStack.length === 0}
          >
            ↶
          </Button>
          <Button
            onClick={() => dispatch({ type: "redo" })}
            disabled={!history || history.redoStack.length === 0}
          >
            ↷
          </Button>
        </div>
        <div className="animation-toolbar-title">
          <span className="eyebrow">NATIVE PIXEL PERFORMANCE</span>
          <strong>{animation ? `${animation.state} / ${animation.facing}` : "No clip"}</strong>
        </div>
        <div className="toolbar-group">
          <Button onClick={addFrame}>＋ Frame</Button>
          <Button onClick={addClip}>＋ Clip</Button>
          <Button
            onClick={() =>
              execute(appendSelectedFrameToClipCommand(state), {
                notice: "Appended the selected frame to the cadence.",
              })
            }
            disabled={!frame || !animation}
          >
            Add to Clip
          </Button>
          <Button
            onClick={() =>
              execute(removeSelectedClipFrameCommand(state), {
                clipFrameIndex: null,
                notice: "Removed the frame occurrence from the cadence.",
              })
            }
            disabled={state.clipFrameIndex === null}
          >
            Remove Occurrence
          </Button>
          <Button onClick={removeFrame} disabled={!frame}>
            Delete Frame
          </Button>
          <Button onClick={removeClip} disabled={!animation}>
            Delete Clip
          </Button>
        </div>
      </div>

      <main className="workspace-grid animation-grid">
        <aside className="sidebar animation-library">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ACTOR LIBRARY</span>
              <h2>{state.actorOrder.length} actors</h2>
            </div>
          </div>
          <div className="actor-selector-list">
            {state.actorOrder.map((actorId) => {
              const candidate = state.histories[actorId]?.document.actor;
              if (!candidate) return null;
              const candidateDirty = state.histories[actorId]
                ? animationWorkspaceIsDirty({
                    ...state,
                    histories: { [actorId]: state.histories[actorId]! },
                    actorOrder: [actorId],
                    activeActorId: actorId,
                  })
                : false;
              return (
                <button
                  type="button"
                  key={actorId}
                  className={`actor-selector ${actorId === state.activeActorId ? "is-active" : ""}`}
                  onClick={() => dispatch({ type: "select-actor", actorId })}
                >
                  <span className="actor-avatar">{candidate.name.slice(0, 1)}</span>
                  <span>
                    <strong>{candidate.name}</strong>
                    <small>
                      {candidate.frames.length} frames · {candidate.animations.length} clips
                    </small>
                  </span>
                  {candidateDirty ? <i>●</i> : null}
                </button>
              );
            })}
          </div>

          <div className="animation-library-heading">
            <span>ANIMATION CLIPS</span>
            <strong>{actor.animations.length}</strong>
          </div>
          <div className="animation-clip-list">
            {actor.animations.map((candidate) => (
              <button
                type="button"
                key={candidate.id}
                className={`animation-clip-row ${candidate.id === animation?.id ? "is-active" : ""}`}
                onClick={() =>
                  dispatch({
                    type: "select-animation",
                    animationId: candidate.id,
                  })
                }
              >
                <span className="clip-state">{candidate.state.slice(0, 2)}</span>
                <span>
                  <strong>{candidate.state}</strong>
                  <small>
                    {candidate.facing} · {candidate.frameIds.length} frames
                  </small>
                </span>
                <em>{candidate.loop ? "LOOP" : "ONCE"}</em>
              </button>
            ))}
          </div>

          <div className="animation-library-heading">
            <span>SPRITE FRAMES</span>
            <strong>{actor.frames.length}</strong>
          </div>
          <div className="sprite-frame-list">
            {actor.frames.map((candidate, index) => (
              <button
                type="button"
                key={candidate.id}
                className={`sprite-frame-row ${candidate.id === frame?.id ? "is-active" : ""}`}
                onClick={() => dispatch({ type: "select-frame", frameId: candidate.id })}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span>
                  <strong>{shortId(candidate.id)}</strong>
                  <small>
                    {candidate.durationTicks}t · {candidate.sourceSize.width}×{candidate.sourceSize.height}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="animation-stage-column">
          <div className="animation-stage-header">
            <div>
              <span className="eyebrow">FRAME GEOMETRY</span>
              <h1>{displayFrame ? shortId(displayFrame.id) : "No frame"}</h1>
            </div>
            <div className="playback-controls">
              <Button onClick={() => dispatch({ type: "toggle-playing" })}>
                {state.playing ? "Pause" : "Play"}
              </Button>
              <NumberInput
                value={state.playheadTick}
                min={0}
                max={Math.max(
                  0,
                  animation ? (animationFrameTimeline(actor, animation.id).at(-1)?.endTick ?? 1) - 1 : 0,
                )}
                onChange={(tick) => dispatch({ type: "set-playhead", tick })}
              />
            </div>
          </div>

          {displayFrame ? (
            <SpriteGeometryPreview frame={displayFrame} assetLabel={displayFrame.assetId} />
          ) : (
            <div className="animation-empty">No sprite frame selected.</div>
          )}

          <CadenceTimeline state={state} dispatch={dispatch} />

          <div className="animation-diagnostics">
            <div>
              <span>Frame usage</span>
              <strong>{frameUsageEntries.length} clips</strong>
            </div>
            <div>
              <span>Markers</span>
              <strong>{frame?.events?.length ?? 0}</strong>
            </div>
            <div>
              <span>Native anchors</span>
              <strong>pivot + feet</strong>
            </div>
            <div>
              <span>Revision</span>
              <strong>{history?.document.operationRevision ?? 0}</strong>
            </div>
          </div>
        </section>

        <AnimationInspector state={state} execute={execute} />
      </main>

      <footer className="statusbar">
        <span>
          <i className={`status-dot ${dirty ? "is-warning" : ""}`} />
          {dirty ? "Unsaved animation edits" : "Actor definitions synchronized"}
        </span>
        <span>{state.notice ?? "Space toggles preview playback"}</span>
        <span>{actor.id}</span>
      </footer>
    </div>
  );
};
