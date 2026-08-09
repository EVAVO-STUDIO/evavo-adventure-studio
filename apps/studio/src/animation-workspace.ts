import {
  type AnimationEditorCommand,
  type AnimationEditorHistoryState,
  animationClipDurationTicks,
  animationFrameTimeline,
  createAnimationEditorHistory,
  executeAnimationEditorCommand,
  isAnimationEditorDocumentDirty,
  markAnimationEditorHistorySaved,
  redoAnimationEditorCommand,
  undoAnimationEditorCommand,
} from "@evavo/adventure-animation-editor-core";
import type { Actor, AnimationClip, Id, SpriteFrame } from "@evavo/adventure-project-schema";

export interface AnimationWorkspaceState {
  readonly histories: Readonly<Record<string, AnimationEditorHistoryState>>;
  readonly actorOrder: readonly Id<"actor">[];
  readonly activeActorId: Id<"actor">;
  readonly frameId: Id<"sprite-frame"> | null;
  readonly animationId: Id<"animation-clip"> | null;
  readonly clipFrameIndex: number | null;
  readonly playheadTick: number;
  readonly playing: boolean;
  readonly notice: string | null;
}

export type AnimationWorkspaceAction =
  | { readonly type: "select-actor"; readonly actorId: Id<"actor"> }
  | { readonly type: "select-frame"; readonly frameId: Id<"sprite-frame"> }
  | {
      readonly type: "select-animation";
      readonly animationId: Id<"animation-clip">;
    }
  | {
      readonly type: "select-clip-frame";
      readonly animationId: Id<"animation-clip">;
      readonly frameIndex: number;
    }
  | {
      readonly type: "execute";
      readonly command: AnimationEditorCommand;
      readonly frameId?: Id<"sprite-frame"> | null;
      readonly animationId?: Id<"animation-clip"> | null;
      readonly clipFrameIndex?: number | null;
      readonly notice?: string;
    }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "mark-saved" }
  | { readonly type: "set-playhead"; readonly tick: number }
  | { readonly type: "toggle-playing" }
  | { readonly type: "advance-playhead"; readonly ticks: number }
  | { readonly type: "clear-notice" };

const asId = <T extends string>(value: string): Id<T> => value as Id<T>;

const firstActor = (actors: readonly Actor[]): Actor => {
  const actor = actors[0];
  if (!actor) throw new Error("The animation workspace requires at least one actor.");
  return actor;
};

const actorHistory = (
  state: AnimationWorkspaceState,
  actorId: Id<"actor"> = state.activeActorId,
): AnimationEditorHistoryState => {
  const history = state.histories[actorId];
  if (!history) throw new Error(`Actor history '${actorId}' does not exist.`);
  return history;
};

export const activeAnimationActor = (state: AnimationWorkspaceState): Actor =>
  actorHistory(state).document.actor;

export const selectedAnimationFrame = (state: AnimationWorkspaceState): SpriteFrame | null => {
  const actor = activeAnimationActor(state);
  return actor.frames.find((frame) => frame.id === state.frameId) ?? actor.frames[0] ?? null;
};

export const selectedAnimationClip = (state: AnimationWorkspaceState): AnimationClip | null => {
  const actor = activeAnimationActor(state);
  return (
    actor.animations.find((animation) => animation.id === state.animationId) ?? actor.animations[0] ?? null
  );
};

const normalizedPlayhead = (state: AnimationWorkspaceState, tick: number): number => {
  const actor = activeAnimationActor(state);
  const animation = selectedAnimationClip(state);
  if (!animation) return 0;
  const duration = animationClipDurationTicks(actor, animation.id);
  if (duration <= 0) return 0;
  const normalized = Math.max(0, Math.floor(tick));
  return animation.loop ? normalized % duration : Math.min(duration - 1, normalized);
};

export const frameAtPlayhead = (state: AnimationWorkspaceState): SpriteFrame | null => {
  const actor = activeAnimationActor(state);
  const animation = selectedAnimationClip(state);
  if (!animation) return selectedAnimationFrame(state);
  const timeline = animationFrameTimeline(actor, animation.id);
  const entry =
    timeline.find(
      (candidate) => state.playheadTick >= candidate.startTick && state.playheadTick < candidate.endTick,
    ) ?? timeline.at(-1);
  return entry ? (actor.frames.find((frame) => frame.id === entry.frameId) ?? null) : null;
};

export const createAnimationWorkspace = (actors: readonly Actor[]): AnimationWorkspaceState => {
  const first = firstActor(actors);
  return {
    histories: Object.fromEntries(actors.map((actor) => [actor.id, createAnimationEditorHistory(actor)])),
    actorOrder: actors.map((actor) => actor.id),
    activeActorId: first.id,
    frameId: first.frames[0]?.id ?? null,
    animationId: first.animations[0]?.id ?? null,
    clipFrameIndex: null,
    playheadTick: 0,
    playing: false,
    notice: null,
  };
};

const replaceHistory = (
  state: AnimationWorkspaceState,
  history: AnimationEditorHistoryState,
): AnimationWorkspaceState => ({
  ...state,
  histories: { ...state.histories, [state.activeActorId]: history },
});

const selectionStillExists = (
  actor: Actor,
  frameId: Id<"sprite-frame"> | null,
  animationId: Id<"animation-clip"> | null,
): {
  readonly frameId: Id<"sprite-frame"> | null;
  readonly animationId: Id<"animation-clip"> | null;
} => ({
  frameId:
    (frameId && actor.frames.some((frame) => frame.id === frameId) ? frameId : actor.frames[0]?.id) ?? null,
  animationId:
    (animationId && actor.animations.some((animation) => animation.id === animationId)
      ? animationId
      : actor.animations[0]?.id) ?? null,
});

export const animationWorkspaceReducer = (
  state: AnimationWorkspaceState,
  action: AnimationWorkspaceAction,
): AnimationWorkspaceState => {
  switch (action.type) {
    case "select-actor": {
      const history = actorHistory(state, action.actorId);
      const actor = history.document.actor;
      return {
        ...state,
        activeActorId: action.actorId,
        frameId: actor.frames[0]?.id ?? null,
        animationId: actor.animations[0]?.id ?? null,
        clipFrameIndex: null,
        playheadTick: 0,
        playing: false,
        notice: null,
      };
    }
    case "select-frame":
      return {
        ...state,
        frameId: action.frameId,
        clipFrameIndex: null,
        notice: null,
      };
    case "select-animation":
      return {
        ...state,
        animationId: action.animationId,
        clipFrameIndex: null,
        playheadTick: 0,
        notice: null,
      };
    case "select-clip-frame": {
      const actor = activeAnimationActor(state);
      const animation = actor.animations.find((candidate) => candidate.id === action.animationId);
      const frameId = animation?.frameIds[action.frameIndex] ?? null;
      return {
        ...state,
        animationId: action.animationId,
        frameId,
        clipFrameIndex: action.frameIndex,
        playheadTick: animation
          ? (animationFrameTimeline(actor, animation.id)[action.frameIndex]?.startTick ?? 0)
          : 0,
        playing: false,
        notice: null,
      };
    }
    case "execute": {
      const history = executeAnimationEditorCommand(actorHistory(state), action.command);
      const actor = history.document.actor;
      const selection = selectionStillExists(
        actor,
        action.frameId === undefined ? state.frameId : action.frameId,
        action.animationId === undefined ? state.animationId : action.animationId,
      );
      return {
        ...replaceHistory(state, history),
        ...selection,
        clipFrameIndex: action.clipFrameIndex === undefined ? state.clipFrameIndex : action.clipFrameIndex,
        playheadTick: 0,
        playing: false,
        notice: action.notice ?? null,
      };
    }
    case "undo": {
      const history = undoAnimationEditorCommand(actorHistory(state));
      const actor = history.document.actor;
      return {
        ...replaceHistory(state, history),
        ...selectionStillExists(actor, state.frameId, state.animationId),
        clipFrameIndex: null,
        playheadTick: 0,
        playing: false,
        notice: "Undid the last animation edit.",
      };
    }
    case "redo": {
      const history = redoAnimationEditorCommand(actorHistory(state));
      const actor = history.document.actor;
      return {
        ...replaceHistory(state, history),
        ...selectionStillExists(actor, state.frameId, state.animationId),
        clipFrameIndex: null,
        playheadTick: 0,
        playing: false,
        notice: "Redid the animation edit.",
      };
    }
    case "mark-saved":
      return {
        ...replaceHistory(state, markAnimationEditorHistorySaved(actorHistory(state))),
        notice: `Marked '${activeAnimationActor(state).name}' as saved.`,
      };
    case "set-playhead":
      return { ...state, playheadTick: normalizedPlayhead(state, action.tick) };
    case "toggle-playing":
      return { ...state, playing: !state.playing, notice: null };
    case "advance-playhead":
      return state.playing
        ? {
            ...state,
            playheadTick: normalizedPlayhead(state, state.playheadTick + action.ticks),
          }
        : state;
    case "clear-notice":
      return { ...state, notice: null };
  }
};

export const animationWorkspaceIsDirty = (state: AnimationWorkspaceState): boolean =>
  Object.values(state.histories).some((history) => isAnimationEditorDocumentDirty(history.document));

const actorIds = (actor: Actor): ReadonlySet<string> =>
  new Set([
    actor.id,
    ...actor.frames.map((frame) => frame.id),
    ...actor.animations.map((animation) => animation.id),
  ]);

const uniqueId = (existing: ReadonlySet<string>, prefix: string): string => {
  let index = 1;
  while (existing.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
};

export const insertAnimationFrameCommand = (
  state: AnimationWorkspaceState,
): {
  readonly command: AnimationEditorCommand;
  readonly frameId: Id<"sprite-frame">;
} => {
  const actor = activeAnimationActor(state);
  const template = selectedAnimationFrame(state) ?? actor.frames[0];
  if (!template) {
    throw new Error("Add an initial sprite frame before duplicating frame data.");
  }
  const frameId = asId<"sprite-frame">(uniqueId(actorIds(actor), `frame.${actor.id}.new`));
  const frame: SpriteFrame = {
    ...template,
    id: frameId,
    sourceRect: {
      ...template.sourceRect,
      x: template.sourceRect.x + template.sourceRect.width + 2,
    },
    events: [],
  };
  return {
    frameId,
    command: { kind: "insert-frame", index: actor.frames.length, frame },
  };
};

export const insertAnimationClipCommand = (
  state: AnimationWorkspaceState,
): {
  readonly command: AnimationEditorCommand;
  readonly animationId: Id<"animation-clip">;
} => {
  const actor = activeAnimationActor(state);
  const frame = selectedAnimationFrame(state) ?? actor.frames[0];
  if (!frame) throw new Error("Add a sprite frame before creating an animation clip.");
  const animationId = asId<"animation-clip">(uniqueId(actorIds(actor), `animation.${actor.id}.new`));
  const performanceIndex = actor.animations.length + 1;
  const animation: AnimationClip = {
    id: animationId,
    state: `state-${performanceIndex}`,
    facing: "east",
    frameIds: [frame.id],
    loop: false,
    interruptible: true,
  };
  return {
    animationId,
    command: {
      kind: "insert-animation",
      index: actor.animations.length,
      animation,
    },
  };
};

export const appendSelectedFrameToClipCommand = (state: AnimationWorkspaceState): AnimationEditorCommand => {
  const actor = activeAnimationActor(state);
  const animation = selectedAnimationClip(state);
  const frame = selectedAnimationFrame(state);
  if (!animation || !frame) {
    throw new Error("Select both an animation clip and a sprite frame.");
  }
  return {
    kind: "insert-clip-frame",
    animationId: animation.id,
    index: animation.frameIds.length,
    frameId: frame.id,
  };
};

export const removeSelectedClipFrameCommand = (state: AnimationWorkspaceState): AnimationEditorCommand => {
  const animation = selectedAnimationClip(state);
  if (!animation || state.clipFrameIndex === null) {
    throw new Error("Select a frame occurrence in the animation cadence.");
  }
  const frameId = animation.frameIds[state.clipFrameIndex];
  if (!frameId) throw new Error("The selected clip frame no longer exists.");
  return {
    kind: "remove-clip-frame",
    animationId: animation.id,
    frameIndex: state.clipFrameIndex,
    expectedFrameId: frameId,
  };
};
