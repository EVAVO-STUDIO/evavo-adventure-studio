import { type Id, sequenceSchema } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { parseSequenceEditorCommand } from "../src/command-schema.js";
import {
  createSequenceEditorHistory,
  executeSequenceEditorCommand,
  isSequenceEditorDocumentDirty,
  markSequenceEditorHistorySaved,
  redoSequenceEditorCommand,
  type SequenceEditorCommandError,
  undoSequenceEditorCommand,
} from "../src/index.js";

const id = <T extends string>(value: string) => value as Id<T>;

const sequence = sequenceSchema.parse({
  id: "sequence.office.blackout",
  name: "Office blackout",
  mode: "cutscene",
  durationTicks: 240,
  loop: false,
  blocking: true,
  savePolicy: "boundary-only",
  skip: {
    allowed: true,
    safeAfterTick: 30,
    completionActions: [{ kind: "set-flag", flag: "office.blackout-watched", value: true }],
  },
  tracks: [
    {
      id: "sequence-track.office.actor",
      kind: "actor",
      cues: [
        {
          kind: "actor-animation",
          atTick: 0,
          actorId: id<"actor">("actor.detective"),
          animationState: "idle",
          facing: "east",
          awaitCompletion: false,
        },
        {
          kind: "actor-move",
          atTick: 60,
          durationTicks: 80,
          actorId: id<"actor">("actor.detective"),
          destination: { x: 190, y: 166 },
          easing: "linear",
        },
      ],
    },
    {
      id: "sequence-track.office.camera",
      kind: "camera",
      cues: [
        {
          kind: "camera-shot",
          atTick: 20,
          durationTicks: 100,
          position: { x: 16, y: 0 },
          easing: "ease-in-out",
        },
      ],
    },
    {
      id: "sequence-track.office.dialogue",
      kind: "dialogue",
      cues: [
        {
          kind: "speech",
          atTick: 145,
          speakerId: "actor.detective",
          text: "Somebody planned the darkness.",
          durationTicks: 60,
        },
      ],
    },
    {
      id: "sequence-track.office.story",
      kind: "story",
      cues: [
        {
          kind: "story-action",
          atTick: 220,
          action: {
            kind: "set-flag",
            flag: "office.blackout-complete",
            value: true,
          },
        },
      ],
    },
  ],
});

describe("sequence editor history", () => {
  it("replaces cues with exact stale-state guards and undo", () => {
    let history = createSequenceEditorHistory(sequence);
    const track = sequence.tracks[1]!;
    const cue = track.cues[0]!;
    const replacement = {
      ...cue,
      position: { x: 24, y: 0 },
      durationTicks: 90,
    };

    history = executeSequenceEditorCommand(history, {
      kind: "replace-cue",
      trackId: track.id,
      cueIndex: 0,
      expectedCue: cue,
      cue: replacement,
    });

    expect(history.document.sequence.tracks[1]?.cues[0]).toMatchObject({
      position: { x: 24, y: 0 },
      durationTicks: 90,
    });
    expect(isSequenceEditorDocumentDirty(history.document)).toBe(true);

    history = undoSequenceEditorCommand(history);
    expect(history.document.sequence.tracks[1]?.cues[0]).toEqual(cue);
    expect(isSequenceEditorDocumentDirty(history.document)).toBe(false);

    history = redoSequenceEditorCommand(history);
    expect(history.document.sequence.tracks[1]?.cues[0]).toEqual(replacement);

    history = markSequenceEditorHistorySaved(history);
    expect(isSequenceEditorDocumentDirty(history.document)).toBe(false);
  });

  it("rejects stale cue commands", () => {
    const history = createSequenceEditorHistory(sequence);
    const track = sequence.tracks[0]!;
    const cue = track.cues[0]!;

    expect(() =>
      executeSequenceEditorCommand(history, {
        kind: "replace-cue",
        trackId: track.id,
        cueIndex: 0,
        expectedCue: { ...cue, atTick: 1 },
        cue,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SequenceEditorCommandError>>({
        code: "stale-cue",
      }),
    );
  });

  it("rejects cue kinds that do not belong on the track", () => {
    const history = createSequenceEditorHistory(sequence);

    expect(() =>
      executeSequenceEditorCommand(history, {
        kind: "insert-cue",
        trackId: sequence.tracks[1]!.id,
        index: 1,
        cue: {
          kind: "sound",
          atTick: 180,
          assetId: id<"asset">("asset.sound.thunder"),
          bus: "effects",
          volume: 1,
          loop: false,
        },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SequenceEditorCommandError>>({
        code: "invalid-track-cue",
      }),
    );
  });

  it("rejects out-of-order and out-of-range cues", () => {
    const history = createSequenceEditorHistory(sequence);
    const actorTrack = sequence.tracks[0]!;

    expect(() =>
      executeSequenceEditorCommand(history, {
        kind: "insert-cue",
        trackId: actorTrack.id,
        index: 1,
        cue: {
          kind: "actor-animation",
          atTick: 180,
          actorId: id<"actor">("actor.detective"),
          animationState: "turn",
          awaitCompletion: false,
        },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SequenceEditorCommandError>>({
        code: "invalid-cue-order",
      }),
    );

    expect(() =>
      executeSequenceEditorCommand(history, {
        kind: "insert-cue",
        trackId: sequence.tracks[2]!.id,
        index: 1,
        cue: {
          kind: "speech",
          atTick: 230,
          text: "This line exceeds the timeline.",
          durationTicks: 30,
        },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SequenceEditorCommandError>>({
        code: "invalid-cue-time",
      }),
    );
  });

  it("applies atomic track and cue batches", () => {
    const history = executeSequenceEditorCommand(createSequenceEditorHistory(sequence), {
      kind: "batch",
      commands: [
        {
          kind: "insert-track",
          index: sequence.tracks.length,
          track: {
            id: id<"sequence-track">("sequence-track.office.effects"),
            kind: "effects",
            cues: [],
          },
        },
        {
          kind: "insert-cue",
          trackId: id<"sequence-track">("sequence-track.office.effects"),
          index: 0,
          cue: {
            kind: "layer-visibility",
            atTick: 30,
            layerId: "layer.office.lamps",
            visible: false,
          },
        },
      ],
    });

    expect(history.document.sequence.tracks.at(-1)).toMatchObject({
      id: id<"sequence-track">("sequence-track.office.effects"),
      cues: [{ kind: "layer-visibility", atTick: 30 }],
    });
    expect(history.undoStack).toHaveLength(1);
  });
});

describe("sequence editor command schema", () => {
  it("parses guarded recursive cue commands", () => {
    const cue = sequence.tracks[3]!.cues[0]!;
    expect(
      parseSequenceEditorCommand({
        kind: "batch",
        commands: [
          {
            kind: "remove-cue",
            trackId: sequence.tracks[3]!.id,
            cueIndex: 0,
            expectedCue: cue,
          },
        ],
      }),
    ).toMatchObject({ kind: "batch" });
  });

  it("rejects empty timeline batches", () => {
    expect(() => parseSequenceEditorCommand({ kind: "batch", commands: [] })).toThrow();
  });
});
