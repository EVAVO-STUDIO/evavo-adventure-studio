import { actorSchema, type Id } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { parseAnimationEditorCommand } from "../src/command-schema.js";
import {
  type AnimationEditorCommandError,
  animationClipDurationTicks,
  animationFrameTimeline,
  createAnimationEditorHistory,
  executeAnimationEditorCommand,
  frameUsage,
  isAnimationEditorDocumentDirty,
  markAnimationEditorHistorySaved,
  redoAnimationEditorCommand,
  undoAnimationEditorCommand,
  validateEditableActor,
} from "../src/index.js";

const id = <T extends string>(value: string) => value as Id<T>;

const actor = actorSchema.parse({
  id: "actor.detective",
  name: "Detective Vale",
  frames: [
    {
      id: "frame.detective.idle-1",
      assetId: "asset.detective",
      sourceRect: { x: 2, y: 2, width: 18, height: 30 },
      sourceSize: { width: 24, height: 36 },
      trimOffset: { x: 3, y: 4 },
      pivot: { x: 12, y: 35 },
      footPoint: { x: 12, y: 35 },
      shadowAnchor: { x: 12, y: 35 },
      attachmentPoints: { hand: { x: 18, y: 21 } },
      durationTicks: 18,
      events: ["breath"],
      mirrorEligible: true,
    },
    {
      id: "frame.detective.idle-2",
      assetId: "asset.detective",
      sourceRect: { x: 24, y: 2, width: 18, height: 30 },
      sourceSize: { width: 24, height: 36 },
      trimOffset: { x: 3, y: 4 },
      pivot: { x: 12, y: 35 },
      footPoint: { x: 12, y: 35 },
      durationTicks: 8,
      mirrorEligible: true,
    },
    {
      id: "frame.detective.walk-1",
      assetId: "asset.detective",
      sourceRect: { x: 46, y: 2, width: 20, height: 31 },
      sourceSize: { width: 26, height: 37 },
      trimOffset: { x: 3, y: 4 },
      pivot: { x: 13, y: 36 },
      footPoint: { x: 13, y: 36 },
      durationTicks: 6,
      events: ["footstep-left"],
      mirrorEligible: true,
    },
    {
      id: "frame.detective.walk-2",
      assetId: "asset.detective",
      sourceRect: { x: 70, y: 2, width: 20, height: 31 },
      sourceSize: { width: 26, height: 37 },
      trimOffset: { x: 3, y: 4 },
      pivot: { x: 13, y: 36 },
      footPoint: { x: 13, y: 36 },
      durationTicks: 6,
      events: ["footstep-right"],
      mirrorEligible: true,
    },
  ],
  animations: [
    {
      id: "animation.detective.idle-east",
      state: "idle",
      facing: "east",
      frameIds: ["frame.detective.idle-1", "frame.detective.idle-2"],
      loop: true,
      interruptible: true,
    },
    {
      id: "animation.detective.walk-east",
      state: "walk",
      facing: "east",
      frameIds: ["frame.detective.walk-1", "frame.detective.walk-2"],
      loop: true,
      interruptible: true,
    },
  ],
});

describe("actor animation validation", () => {
  it("accepts integer native-pixel geometry and stable clip references", () => {
    expect(validateEditableActor(actor)).toEqual([]);
  });

  it("reports trim, anchor, marker and performance identity defects", () => {
    const broken = {
      ...actor,
      frames: [
        {
          ...actor.frames[0]!,
          trimOffset: { x: -1, y: 4.5 },
          pivot: { x: 80, y: 35 },
          events: ["breath", "breath"],
        },
        ...actor.frames.slice(1),
      ],
      animations: [
        ...actor.animations,
        {
          ...actor.animations[0]!,
          id: id<"animation-clip">("animation.detective.idle-east-duplicate"),
        },
      ],
    };

    expect(validateEditableActor(broken).map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "invalid-trim-offset",
        "invalid-frame-anchor",
        "duplicate-frame-event",
        "duplicate-animation-state-facing",
      ]),
    );
  });
});

describe("actor animation history", () => {
  it("edits frame cadence with undo, redo and saved-state tracking", () => {
    let history = createAnimationEditorHistory(actor);
    const frame = actor.frames[0]!;

    history = executeAnimationEditorCommand(history, {
      kind: "replace-frame",
      frameId: frame.id,
      frame: { ...frame, durationTicks: 24, events: ["breath", "coat-rustle"] },
    });

    expect(history.document.actor.frames[0]).toMatchObject({
      durationTicks: 24,
      events: ["breath", "coat-rustle"],
    });
    expect(isAnimationEditorDocumentDirty(history.document)).toBe(true);

    history = undoAnimationEditorCommand(history);
    expect(history.document.actor.frames[0]).toEqual(frame);
    expect(isAnimationEditorDocumentDirty(history.document)).toBe(false);

    history = redoAnimationEditorCommand(history);
    expect(history.document.actor.frames[0]?.durationTicks).toBe(24);

    history = markAnimationEditorHistorySaved(history);
    expect(isAnimationEditorDocumentDirty(history.document)).toBe(false);
  });

  it("protects frames while clips still reference them", () => {
    expect(() =>
      executeAnimationEditorCommand(createAnimationEditorHistory(actor), {
        kind: "remove-frame",
        frameId: actor.frames[0]!.id,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<AnimationEditorCommandError>>({
        code: "protected-frame",
      }),
    );

    expect(frameUsage(actor, actor.frames[0]!.id)).toMatchObject([
      { animationId: "animation.detective.idle-east", frameIndexes: [0] },
    ]);
  });

  it("guards clip-frame indexes against stale commands", () => {
    const animation = actor.animations[0]!;
    expect(() =>
      executeAnimationEditorCommand(createAnimationEditorHistory(actor), {
        kind: "replace-clip-frame",
        animationId: animation.id,
        frameIndex: 0,
        expectedFrameId: id<"sprite-frame">("frame.detective.walk-1"),
        frameId: id<"sprite-frame">("frame.detective.idle-2"),
      }),
    ).toThrowError(
      expect.objectContaining<Partial<AnimationEditorCommandError>>({
        code: "stale-clip-frame",
      }),
    );
  });

  it("supports atomic frame and clip creation", () => {
    const history = executeAnimationEditorCommand(createAnimationEditorHistory(actor), {
      kind: "batch",
      commands: [
        {
          kind: "insert-frame",
          index: actor.frames.length,
          frame: {
            id: id<"sprite-frame">("frame.detective.look-up"),
            assetId: id<"asset">("asset.detective"),
            sourceRect: { x: 94, y: 2, width: 20, height: 31 },
            sourceSize: { width: 26, height: 37 },
            trimOffset: { x: 3, y: 4 },
            pivot: { x: 13, y: 36 },
            footPoint: { x: 13, y: 36 },
            durationTicks: 30,
            mirrorEligible: true,
          },
        },
        {
          kind: "insert-animation",
          index: actor.animations.length,
          animation: {
            id: id<"animation-clip">("animation.detective.look-up-east"),
            state: "look-up",
            facing: "east",
            frameIds: [id<"sprite-frame">("frame.detective.look-up")],
            loop: false,
            interruptible: false,
          },
        },
      ],
    });

    expect(history.document.actor.frames.at(-1)?.id).toBe("frame.detective.look-up");
    expect(history.document.actor.animations.at(-1)?.state).toBe("look-up");
    expect(history.undoStack).toHaveLength(1);
  });
});

describe("animation timing utilities", () => {
  it("emits exact authored frame windows", () => {
    expect(animationFrameTimeline(actor, id<"animation-clip">("animation.detective.idle-east"))).toEqual([
      {
        frameIndex: 0,
        frameId: "frame.detective.idle-1",
        startTick: 0,
        endTick: 18,
        durationTicks: 18,
        events: ["breath"],
      },
      {
        frameIndex: 1,
        frameId: id<"sprite-frame">("frame.detective.idle-2"),
        startTick: 18,
        endTick: 26,
        durationTicks: 8,
        events: [],
      },
    ]);
    expect(animationClipDurationTicks(actor, id<"animation-clip">("animation.detective.idle-east"))).toBe(26);
  });
});

describe("animation command schema", () => {
  it("parses recursive guarded commands", () => {
    expect(
      parseAnimationEditorCommand({
        kind: "batch",
        commands: [
          {
            kind: "remove-clip-frame",
            animationId: "animation.detective.idle-east",
            frameIndex: 1,
            expectedFrameId: "frame.detective.idle-2",
          },
        ],
      }),
    ).toMatchObject({ kind: "batch" });
  });

  it("rejects empty batches", () => {
    expect(() => parseAnimationEditorCommand({ kind: "batch", commands: [] })).toThrow();
  });
});
