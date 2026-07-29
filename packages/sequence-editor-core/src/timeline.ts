import type {
  Id,
  Sequence,
  SequenceCue,
  SequenceTrack,
} from "@evavo/adventure-project-schema";
import { canonicalSequenceEditorJson } from "./index.js";

export interface TimelineViewport {
  readonly pixelsPerTick: number;
  readonly scrollTick: number;
  readonly widthPixels: number;
}

export interface TimelineCueLocator {
  readonly trackId: Id<"sequence-track">;
  readonly cueIndex: number;
  readonly expectedCue: SequenceCue;
}

export interface TimelineCueLayout {
  readonly locator: TimelineCueLocator;
  readonly left: number;
  readonly width: number;
  readonly startTick: number;
  readonly endTick: number;
  readonly label: string;
}

export interface TimelineTrackLayout {
  readonly track: SequenceTrack;
  readonly cues: readonly TimelineCueLayout[];
}

const assertViewport = (viewport: TimelineViewport): void => {
  if (!Number.isFinite(viewport.pixelsPerTick) || viewport.pixelsPerTick <= 0) {
    throw new RangeError("Timeline pixels-per-tick must be positive.");
  }
  if (!Number.isFinite(viewport.scrollTick) || viewport.scrollTick < 0) {
    throw new RangeError("Timeline scroll tick must be non-negative.");
  }
  if (!Number.isFinite(viewport.widthPixels) || viewport.widthPixels <= 0) {
    throw new RangeError("Timeline viewport width must be positive.");
  }
};

export const timelineXForTick = (
  tick: number,
  viewport: TimelineViewport,
): number => {
  assertViewport(viewport);
  if (!Number.isFinite(tick)) {
    throw new RangeError("Timeline tick must be finite.");
  }
  return (tick - viewport.scrollTick) * viewport.pixelsPerTick;
};

export const timelineTickForX = (
  x: number,
  viewport: TimelineViewport,
): number => {
  assertViewport(viewport);
  if (!Number.isFinite(x)) {
    throw new RangeError("Timeline X coordinate must be finite.");
  }
  return viewport.scrollTick + x / viewport.pixelsPerTick;
};

export const snapTimelineTick = (
  tick: number,
  intervalTicks: number,
  maximumTick: number,
): number => {
  if (!Number.isFinite(tick)) {
    throw new RangeError("Timeline tick must be finite.");
  }
  if (!Number.isSafeInteger(intervalTicks) || intervalTicks <= 0) {
    throw new RangeError("Timeline snap interval must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(maximumTick) || maximumTick < 0) {
    throw new RangeError("Timeline maximum tick must be non-negative.");
  }
  return Math.min(
    maximumTick,
    Math.max(0, Math.round(tick / intervalTicks) * intervalTicks),
  );
};

export const cueDurationTicks = (cue: SequenceCue): number => {
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

export const cueEndTick = (cue: SequenceCue): number =>
  cue.atTick + cueDurationTicks(cue);

export const cueLabel = (cue: SequenceCue): string => {
  switch (cue.kind) {
    case "story-action":
      return cue.action.kind;
    case "speech":
      return cue.text;
    case "actor-move":
      return `Move ${cue.actorId}`;
    case "actor-animation":
      return `${cue.animationState} · ${cue.actorId}`;
    case "camera-shot":
      return `Camera ${cue.position.x}, ${cue.position.y}`;
    case "sound":
      return `Play ${cue.assetId}`;
    case "stop-audio":
      return `Stop ${cue.bus}`;
    case "layer-visibility":
      return `${cue.visible ? "Show" : "Hide"} ${cue.layerId}`;
    case "palette-cycle":
      return `${cue.enabled ? "Cycle" : "Stop"} palette`;
  }
};

export const layoutTimelineCue = (
  track: SequenceTrack,
  cueIndex: number,
  viewport: TimelineViewport,
): TimelineCueLayout => {
  const cue = track.cues[cueIndex];
  if (!cue) {
    throw new RangeError(`Timeline track '${track.id}' has no cue ${cueIndex}.`);
  }
  const startTick = cue.atTick;
  const endTick = cueEndTick(cue);
  return {
    locator: {
      trackId: track.id,
      cueIndex,
      expectedCue: cue,
    },
    left: timelineXForTick(startTick, viewport),
    width: Math.max(2, cueDurationTicks(cue) * viewport.pixelsPerTick),
    startTick,
    endTick,
    label: cueLabel(cue),
  };
};

export const layoutSequenceTimeline = (
  sequence: Sequence,
  viewport: TimelineViewport,
): readonly TimelineTrackLayout[] => {
  assertViewport(viewport);
  return sequence.tracks.map((track) => ({
    track,
    cues: track.cues.map((_cue, cueIndex) =>
      layoutTimelineCue(track, cueIndex, viewport),
    ),
  }));
};

export const timelineVisibleTickRange = (
  viewport: TimelineViewport,
): { readonly startTick: number; readonly endTick: number } => {
  assertViewport(viewport);
  return {
    startTick: viewport.scrollTick,
    endTick:
      viewport.scrollTick + viewport.widthPixels / viewport.pixelsPerTick,
  };
};

export const sameTimelineCueLocator = (
  left: TimelineCueLocator,
  right: TimelineCueLocator,
): boolean =>
  left.trackId === right.trackId &&
  left.cueIndex === right.cueIndex &&
  canonicalSequenceEditorJson(left.expectedCue) ===
    canonicalSequenceEditorJson(right.expectedCue);

export const insertionIndexForTick = (
  track: SequenceTrack,
  tick: number,
): number => {
  if (!Number.isFinite(tick)) {
    throw new RangeError("Timeline insertion tick must be finite.");
  }
  const index = track.cues.findIndex((cue) => cue.atTick > tick);
  return index < 0 ? track.cues.length : index;
};
