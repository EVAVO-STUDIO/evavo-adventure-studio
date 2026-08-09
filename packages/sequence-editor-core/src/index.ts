import type { Id, Sequence, SequenceCue, SequenceTrack } from "@evavo/adventure-project-schema";

export class SequenceEditorCommandError extends Error {
  readonly code:
    | "invalid-index"
    | "duplicate-id"
    | "missing-entity"
    | "identity-change"
    | "stale-cue"
    | "invalid-track-cue"
    | "invalid-cue-time"
    | "invalid-cue-order"
    | "invalid-sequence-range"
    | "empty-batch";
  readonly path: string;

  constructor(code: SequenceEditorCommandError["code"], path: string, message: string) {
    super(message);
    this.name = "SequenceEditorCommandError";
    this.code = code;
    this.path = path;
  }
}

export type SequenceEditorCommand =
  | { readonly kind: "batch"; readonly commands: readonly SequenceEditorCommand[] }
  | { readonly kind: "replace-sequence"; readonly sequence: Sequence }
  | {
      readonly kind: "insert-track";
      readonly index: number;
      readonly track: SequenceTrack;
    }
  | { readonly kind: "remove-track"; readonly trackId: Id<"sequence-track"> }
  | {
      readonly kind: "replace-track";
      readonly trackId: Id<"sequence-track">;
      readonly track: SequenceTrack;
    }
  | {
      readonly kind: "insert-cue";
      readonly trackId: Id<"sequence-track">;
      readonly index: number;
      readonly cue: SequenceCue;
    }
  | {
      readonly kind: "remove-cue";
      readonly trackId: Id<"sequence-track">;
      readonly cueIndex: number;
      readonly expectedCue: SequenceCue;
    }
  | {
      readonly kind: "replace-cue";
      readonly trackId: Id<"sequence-track">;
      readonly cueIndex: number;
      readonly expectedCue: SequenceCue;
      readonly cue: SequenceCue;
    };

export interface AppliedSequenceEditorCommand {
  readonly sequence: Sequence;
  readonly inverse: SequenceEditorCommand;
}

export interface SequenceEditorDocumentState {
  readonly sequence: Sequence;
  readonly savedSequence: Sequence;
  readonly operationRevision: number;
}

export interface SequenceEditorHistoryEntry {
  readonly undo: SequenceEditorCommand;
  readonly redo: SequenceEditorCommand;
}

export interface SequenceEditorHistoryState {
  readonly document: SequenceEditorDocumentState;
  readonly undoStack: readonly SequenceEditorHistoryEntry[];
  readonly redoStack: readonly SequenceEditorHistoryEntry[];
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) => left.localeCompare(right))) {
      const child = source[key];
      if (child !== undefined) output[key] = canonicalize(child);
    }
    return output;
  }
  return value;
};

export const canonicalSequenceEditorJson = (value: unknown): string => {
  const output = JSON.stringify(canonicalize(value));
  if (output === undefined) {
    throw new TypeError("Sequence editor data cannot be represented as JSON.");
  }
  return output;
};

const insertAt = <T>(values: readonly T[], index: number, value: T, path: string): T[] => {
  if (!Number.isSafeInteger(index) || index < 0 || index > values.length) {
    throw new SequenceEditorCommandError(
      "invalid-index",
      path,
      `Insert index ${index} is outside 0 to ${values.length}.`,
    );
  }
  return [...values.slice(0, index).map(cloneJson), cloneJson(value), ...values.slice(index).map(cloneJson)];
};

const removeAt = <T>(values: readonly T[], index: number): T[] => [
  ...values.slice(0, index).map(cloneJson),
  ...values.slice(index + 1).map(cloneJson),
];

const replaceAt = <T>(values: readonly T[], index: number, value: T): T[] => [
  ...values.slice(0, index).map(cloneJson),
  cloneJson(value),
  ...values.slice(index + 1).map(cloneJson),
];

const findTrack = (
  sequence: Sequence,
  trackId: Id<"sequence-track">,
): { readonly index: number; readonly track: SequenceTrack } => {
  const index = sequence.tracks.findIndex((track) => track.id === trackId);
  if (index < 0) {
    throw new SequenceEditorCommandError(
      "missing-entity",
      "trackId",
      `Sequence track '${trackId}' does not exist.`,
    );
  }
  const track = sequence.tracks[index];
  if (!track) throw new Error("Sequence track index is invalid.");
  return { index, track };
};

const assertStableIdentity = (expected: string, actual: string, path: string): void => {
  if (expected !== actual) {
    throw new SequenceEditorCommandError(
      "identity-change",
      path,
      `Replace commands cannot change ID '${expected}' to '${actual}'.`,
    );
  }
};

const compatibleCueKinds: Readonly<Record<SequenceTrack["kind"], ReadonlySet<SequenceCue["kind"]>>> = {
  actor: new Set(["actor-move", "actor-animation"]),
  camera: new Set(["camera-shot"]),
  dialogue: new Set(["speech"]),
  audio: new Set(["sound", "stop-audio"]),
  story: new Set(["story-action"]),
  effects: new Set(["layer-visibility", "palette-cycle"]),
};

const cueEndTick = (cue: SequenceCue): number => {
  switch (cue.kind) {
    case "actor-move":
    case "camera-shot":
      return cue.atTick + cue.durationTicks;
    case "speech":
      return cue.atTick + (cue.durationTicks ?? 0);
    default:
      return cue.atTick;
  }
};

const validateTrack = (
  sequence: Pick<Sequence, "durationTicks">,
  track: SequenceTrack,
  path: string,
): void => {
  let previousTick = -1;
  const compatible = compatibleCueKinds[track.kind];
  for (let index = 0; index < track.cues.length; index += 1) {
    const cue = track.cues[index];
    if (!cue) continue;
    const cuePath = `${path}.cues[${index}]`;
    if (!compatible.has(cue.kind)) {
      throw new SequenceEditorCommandError(
        "invalid-track-cue",
        `${cuePath}.kind`,
        `Cue kind '${cue.kind}' does not belong on a '${track.kind}' track.`,
      );
    }
    if (cue.atTick < previousTick) {
      throw new SequenceEditorCommandError(
        "invalid-cue-order",
        `${cuePath}.atTick`,
        `Cue at tick ${cue.atTick} appears after a cue at tick ${previousTick}.`,
      );
    }
    previousTick = cue.atTick;
    if (cue.atTick < 0 || cue.atTick >= sequence.durationTicks || cueEndTick(cue) > sequence.durationTicks) {
      throw new SequenceEditorCommandError(
        "invalid-cue-time",
        cuePath,
        `Cue '${cue.kind}' falls outside the 0 to ${sequence.durationTicks} tick sequence range.`,
      );
    }
  }
};

export const validateEditableSequence = (sequence: Sequence): void => {
  if (sequence.skip.safeAfterTick > sequence.durationTicks) {
    throw new SequenceEditorCommandError(
      "invalid-sequence-range",
      "skip.safeAfterTick",
      `Safe skip tick ${sequence.skip.safeAfterTick} exceeds duration ${sequence.durationTicks}.`,
    );
  }
  const trackIds = new Set<string>();
  for (let index = 0; index < sequence.tracks.length; index += 1) {
    const track = sequence.tracks[index];
    if (!track) continue;
    if (trackIds.has(track.id)) {
      throw new SequenceEditorCommandError(
        "duplicate-id",
        `tracks[${index}].id`,
        `Sequence track '${track.id}' is duplicated.`,
      );
    }
    trackIds.add(track.id);
    validateTrack(sequence, track, `tracks[${index}]`);
  }
};

const assertCueMatches = (
  actual: SequenceCue | undefined,
  expected: SequenceCue,
  path: string,
): SequenceCue => {
  if (!actual) {
    throw new SequenceEditorCommandError("invalid-index", path, "The expected timeline cue does not exist.");
  }
  if (canonicalSequenceEditorJson(actual) !== canonicalSequenceEditorJson(expected)) {
    throw new SequenceEditorCommandError(
      "stale-cue",
      path,
      "The timeline cue changed after this command was created.",
    );
  }
  return actual;
};

const updateTrack = (sequence: Sequence, index: number, track: SequenceTrack): Sequence => ({
  ...sequence,
  tracks: replaceAt(sequence.tracks, index, track),
});

export const applySequenceEditorCommand = (
  sequence: Sequence,
  command: SequenceEditorCommand,
): AppliedSequenceEditorCommand => {
  switch (command.kind) {
    case "batch": {
      if (command.commands.length === 0) {
        throw new SequenceEditorCommandError(
          "empty-batch",
          "commands",
          "Sequence command batches cannot be empty.",
        );
      }
      let next = sequence;
      const inverses: SequenceEditorCommand[] = [];
      for (const child of command.commands) {
        const applied = applySequenceEditorCommand(next, child);
        next = applied.sequence;
        inverses.unshift(applied.inverse);
      }
      return {
        sequence: next,
        inverse: { kind: "batch", commands: inverses },
      };
    }
    case "replace-sequence":
      assertStableIdentity(sequence.id, command.sequence.id, "sequence.id");
      validateEditableSequence(command.sequence);
      return {
        sequence: cloneJson(command.sequence),
        inverse: { kind: "replace-sequence", sequence },
      };
    case "insert-track": {
      if (sequence.tracks.some((track) => track.id === command.track.id)) {
        throw new SequenceEditorCommandError(
          "duplicate-id",
          "track.id",
          `Sequence track '${command.track.id}' already exists.`,
        );
      }
      validateTrack(sequence, command.track, "track");
      return {
        sequence: {
          ...sequence,
          tracks: insertAt(sequence.tracks, command.index, command.track, "index"),
        },
        inverse: { kind: "remove-track", trackId: command.track.id },
      };
    }
    case "remove-track": {
      const { index, track } = findTrack(sequence, command.trackId);
      return {
        sequence: { ...sequence, tracks: removeAt(sequence.tracks, index) },
        inverse: { kind: "insert-track", index, track },
      };
    }
    case "replace-track": {
      const { index, track: previous } = findTrack(sequence, command.trackId);
      assertStableIdentity(command.trackId, command.track.id, "track.id");
      validateTrack(sequence, command.track, "track");
      return {
        sequence: updateTrack(sequence, index, command.track),
        inverse: {
          kind: "replace-track",
          trackId: command.trackId,
          track: previous,
        },
      };
    }
    case "insert-cue": {
      const { index, track } = findTrack(sequence, command.trackId);
      const nextTrack = {
        ...track,
        cues: insertAt(track.cues, command.index, command.cue, "index"),
      };
      validateTrack(sequence, nextTrack, "track");
      return {
        sequence: updateTrack(sequence, index, nextTrack),
        inverse: {
          kind: "remove-cue",
          trackId: command.trackId,
          cueIndex: command.index,
          expectedCue: command.cue,
        },
      };
    }
    case "remove-cue": {
      const { index, track } = findTrack(sequence, command.trackId);
      const previous = assertCueMatches(
        track.cues[command.cueIndex],
        command.expectedCue,
        `track.cues[${command.cueIndex}]`,
      );
      const nextTrack = {
        ...track,
        cues: removeAt(track.cues, command.cueIndex),
      };
      return {
        sequence: updateTrack(sequence, index, nextTrack),
        inverse: {
          kind: "insert-cue",
          trackId: command.trackId,
          index: command.cueIndex,
          cue: previous,
        },
      };
    }
    case "replace-cue": {
      const { index, track } = findTrack(sequence, command.trackId);
      const previous = assertCueMatches(
        track.cues[command.cueIndex],
        command.expectedCue,
        `track.cues[${command.cueIndex}]`,
      );
      const nextTrack = {
        ...track,
        cues: replaceAt(track.cues, command.cueIndex, command.cue),
      };
      validateTrack(sequence, nextTrack, "track");
      return {
        sequence: updateTrack(sequence, index, nextTrack),
        inverse: {
          kind: "replace-cue",
          trackId: command.trackId,
          cueIndex: command.cueIndex,
          expectedCue: command.cue,
          cue: previous,
        },
      };
    }
  }
};

export const createSequenceEditorDocument = (sequence: Sequence): SequenceEditorDocumentState => {
  validateEditableSequence(sequence);
  const snapshot = cloneJson(sequence);
  return {
    sequence: snapshot,
    savedSequence: cloneJson(snapshot),
    operationRevision: 0,
  };
};

export const isSequenceEditorDocumentDirty = (document: SequenceEditorDocumentState): boolean =>
  canonicalSequenceEditorJson(document.sequence) !== canonicalSequenceEditorJson(document.savedSequence);

export const createSequenceEditorHistory = (sequence: Sequence): SequenceEditorHistoryState => ({
  document: createSequenceEditorDocument(sequence),
  undoStack: [],
  redoStack: [],
});

const applyToDocument = (
  document: SequenceEditorDocumentState,
  command: SequenceEditorCommand,
): {
  readonly document: SequenceEditorDocumentState;
  readonly inverse: SequenceEditorCommand;
} => {
  const applied = applySequenceEditorCommand(document.sequence, command);
  return {
    document: {
      ...document,
      sequence: applied.sequence,
      operationRevision: document.operationRevision + 1,
    },
    inverse: applied.inverse,
  };
};

export const executeSequenceEditorCommand = (
  history: SequenceEditorHistoryState,
  command: SequenceEditorCommand,
): SequenceEditorHistoryState => {
  const applied = applyToDocument(history.document, command);
  return {
    document: applied.document,
    undoStack: [...history.undoStack, { undo: applied.inverse, redo: cloneJson(command) }],
    redoStack: [],
  };
};

export const undoSequenceEditorCommand = (
  history: SequenceEditorHistoryState,
): SequenceEditorHistoryState => {
  const entry = history.undoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(history.document, entry.undo);
  return {
    document: applied.document,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, entry],
  };
};

export const redoSequenceEditorCommand = (
  history: SequenceEditorHistoryState,
): SequenceEditorHistoryState => {
  const entry = history.redoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(history.document, entry.redo);
  return {
    document: applied.document,
    undoStack: [...history.undoStack, entry],
    redoStack: history.redoStack.slice(0, -1),
  };
};

export const markSequenceEditorHistorySaved = (
  history: SequenceEditorHistoryState,
): SequenceEditorHistoryState => ({
  ...history,
  document: {
    ...history.document,
    savedSequence: cloneJson(history.document.sequence),
  },
});
