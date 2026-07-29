import type {
  Actor,
  AnimationClip,
  Id,
  Point,
  SpriteFrame,
} from "@evavo/adventure-project-schema";

export type ActorAnimationIssueCode =
  | "duplicate-frame-id"
  | "duplicate-animation-id"
  | "duplicate-animation-state-facing"
  | "missing-animation-frame"
  | "empty-animation"
  | "invalid-pixel-coordinate"
  | "invalid-trim-offset"
  | "invalid-trim-bounds"
  | "invalid-frame-anchor"
  | "duplicate-frame-event";

export interface ActorAnimationIssue {
  readonly severity: "error";
  readonly code: ActorAnimationIssueCode;
  readonly path: string;
  readonly message: string;
}

export class AnimationEditorCommandError extends Error {
  readonly code:
    | "invalid-index"
    | "duplicate-id"
    | "missing-entity"
    | "identity-change"
    | "protected-frame"
    | "stale-clip-frame"
    | "invalid-actor"
    | "empty-batch";
  readonly path: string;
  readonly issues: readonly ActorAnimationIssue[];

  constructor(
    code: AnimationEditorCommandError["code"],
    path: string,
    message: string,
    issues: readonly ActorAnimationIssue[] = [],
  ) {
    super(message);
    this.name = "AnimationEditorCommandError";
    this.code = code;
    this.path = path;
    this.issues = issues;
  }
}

export type AnimationEditorCommand =
  | { readonly kind: "batch"; readonly commands: readonly AnimationEditorCommand[] }
  | { readonly kind: "replace-actor"; readonly actor: Actor }
  | {
      readonly kind: "insert-frame";
      readonly index: number;
      readonly frame: SpriteFrame;
    }
  | { readonly kind: "remove-frame"; readonly frameId: Id<"sprite-frame"> }
  | {
      readonly kind: "replace-frame";
      readonly frameId: Id<"sprite-frame">;
      readonly frame: SpriteFrame;
    }
  | {
      readonly kind: "insert-animation";
      readonly index: number;
      readonly animation: AnimationClip;
    }
  | {
      readonly kind: "remove-animation";
      readonly animationId: Id<"animation-clip">;
    }
  | {
      readonly kind: "replace-animation";
      readonly animationId: Id<"animation-clip">;
      readonly animation: AnimationClip;
    }
  | {
      readonly kind: "insert-clip-frame";
      readonly animationId: Id<"animation-clip">;
      readonly index: number;
      readonly frameId: Id<"sprite-frame">;
    }
  | {
      readonly kind: "remove-clip-frame";
      readonly animationId: Id<"animation-clip">;
      readonly frameIndex: number;
      readonly expectedFrameId: Id<"sprite-frame">;
    }
  | {
      readonly kind: "replace-clip-frame";
      readonly animationId: Id<"animation-clip">;
      readonly frameIndex: number;
      readonly expectedFrameId: Id<"sprite-frame">;
      readonly frameId: Id<"sprite-frame">;
    };

export interface AppliedAnimationEditorCommand {
  readonly actor: Actor;
  readonly inverse: AnimationEditorCommand;
}

export interface AnimationEditorDocumentState {
  readonly actor: Actor;
  readonly savedActor: Actor;
  readonly operationRevision: number;
}

export interface AnimationEditorHistoryEntry {
  readonly undo: AnimationEditorCommand;
  readonly redo: AnimationEditorCommand;
}

export interface AnimationEditorHistoryState {
  readonly document: AnimationEditorDocumentState;
  readonly undoStack: readonly AnimationEditorHistoryEntry[];
  readonly redoStack: readonly AnimationEditorHistoryEntry[];
}

export interface AnimationFrameTimelineEntry {
  readonly frameIndex: number;
  readonly frameId: Id<"sprite-frame">;
  readonly startTick: number;
  readonly endTick: number;
  readonly durationTicks: number;
  readonly events: readonly string[];
}

export interface FrameUsage {
  readonly animationId: Id<"animation-clip">;
  readonly state: string;
  readonly facing: string;
  readonly frameIndexes: readonly number[];
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) =>
      left.localeCompare(right),
    )) {
      const child = source[key];
      if (child !== undefined) output[key] = canonicalize(child);
    }
    return output;
  }
  return value;
};

export const canonicalAnimationEditorJson = (value: unknown): string => {
  const output = JSON.stringify(canonicalize(value));
  if (output === undefined) {
    throw new TypeError("Actor animation editor data cannot be represented as JSON.");
  }
  return output;
};

const issue = (
  issues: ActorAnimationIssue[],
  code: ActorAnimationIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

const isPixelInteger = (value: number): boolean => Number.isSafeInteger(value);

const pointInsideSource = (
  point: Point,
  frame: SpriteFrame,
): boolean =>
  point.x >= 0 &&
  point.y >= 0 &&
  point.x <= frame.sourceSize.width &&
  point.y <= frame.sourceSize.height;

const validateAnchor = (
  issues: ActorAnimationIssue[],
  frame: SpriteFrame,
  point: Point,
  path: string,
  label: string,
): void => {
  if (!isPixelInteger(point.x) || !isPixelInteger(point.y)) {
    issue(
      issues,
      "invalid-pixel-coordinate",
      path,
      `${label} must use integer native-pixel coordinates.`,
    );
  }
  if (!pointInsideSource(point, frame)) {
    issue(
      issues,
      "invalid-frame-anchor",
      path,
      `${label} (${point.x}, ${point.y}) is outside ${frame.sourceSize.width} × ${frame.sourceSize.height}.`,
    );
  }
};

export const validateEditableActor = (
  actor: Actor,
): readonly ActorAnimationIssue[] => {
  const issues: ActorAnimationIssue[] = [];
  const frameIds = new Set<string>();
  const animationIds = new Set<string>();
  const performanceKeys = new Set<string>();

  actor.frames.forEach((frame, frameIndex) => {
    const framePath = `frames[${frameIndex}]`;
    if (frameIds.has(frame.id)) {
      issue(
        issues,
        "duplicate-frame-id",
        `${framePath}.id`,
        `Sprite frame '${frame.id}' is declared more than once.`,
      );
    }
    frameIds.add(frame.id);

    if (
      !isPixelInteger(frame.trimOffset.x) ||
      !isPixelInteger(frame.trimOffset.y) ||
      frame.trimOffset.x < 0 ||
      frame.trimOffset.y < 0
    ) {
      issue(
        issues,
        "invalid-trim-offset",
        `${framePath}.trimOffset`,
        `Trim offset for '${frame.id}' must use non-negative integer pixels.`,
      );
    }
    if (
      frame.trimOffset.x + frame.sourceRect.width > frame.sourceSize.width ||
      frame.trimOffset.y + frame.sourceRect.height > frame.sourceSize.height
    ) {
      issue(
        issues,
        "invalid-trim-bounds",
        framePath,
        `Trimmed frame '${frame.id}' does not fit inside its ${frame.sourceSize.width} × ${frame.sourceSize.height} original canvas.`,
      );
    }

    validateAnchor(issues, frame, frame.pivot, `${framePath}.pivot`, "Pivot");
    validateAnchor(
      issues,
      frame,
      frame.footPoint,
      `${framePath}.footPoint`,
      "Foot point",
    );
    if (frame.shadowAnchor) {
      validateAnchor(
        issues,
        frame,
        frame.shadowAnchor,
        `${framePath}.shadowAnchor`,
        "Shadow anchor",
      );
    }
    for (const [name, attachment] of Object.entries(
      frame.attachmentPoints ?? {},
    )) {
      validateAnchor(
        issues,
        frame,
        attachment,
        `${framePath}.attachmentPoints.${name}`,
        `Attachment '${name}'`,
      );
    }

    const events = new Set<string>();
    for (let eventIndex = 0; eventIndex < (frame.events?.length ?? 0); eventIndex += 1) {
      const marker = frame.events?.[eventIndex];
      if (!marker) continue;
      if (events.has(marker)) {
        issue(
          issues,
          "duplicate-frame-event",
          `${framePath}.events[${eventIndex}]`,
          `Frame marker '${marker}' is duplicated on '${frame.id}'.`,
        );
      }
      events.add(marker);
    }
  });

  actor.animations.forEach((animation, animationIndex) => {
    const animationPath = `animations[${animationIndex}]`;
    if (animationIds.has(animation.id)) {
      issue(
        issues,
        "duplicate-animation-id",
        `${animationPath}.id`,
        `Animation clip '${animation.id}' is declared more than once.`,
      );
    }
    animationIds.add(animation.id);

    const performanceKey = `${animation.state}\u0000${animation.facing}`;
    if (performanceKeys.has(performanceKey)) {
      issue(
        issues,
        "duplicate-animation-state-facing",
        animationPath,
        `Actor '${actor.id}' has more than one '${animation.state}' clip facing '${animation.facing}'.`,
      );
    }
    performanceKeys.add(performanceKey);

    if (animation.frameIds.length === 0) {
      issue(
        issues,
        "empty-animation",
        `${animationPath}.frameIds`,
        `Animation '${animation.id}' must contain at least one frame.`,
      );
    }
    animation.frameIds.forEach((frameId, frameIndex) => {
      if (!frameIds.has(frameId)) {
        issue(
          issues,
          "missing-animation-frame",
          `${animationPath}.frameIds[${frameIndex}]`,
          `Animation '${animation.id}' references missing frame '${frameId}'.`,
        );
      }
    });
  });

  return issues;
};

export const assertEditableActor = (actor: Actor): void => {
  const issues = validateEditableActor(actor);
  if (issues.length > 0) {
    throw new AnimationEditorCommandError(
      "invalid-actor",
      issues[0]?.path ?? "$",
      `Actor '${actor.id}' contains ${issues.length} animation authoring issue(s).`,
      issues,
    );
  }
};

const insertAt = <T>(
  values: readonly T[],
  index: number,
  value: T,
  path: string,
): T[] => {
  if (!Number.isSafeInteger(index) || index < 0 || index > values.length) {
    throw new AnimationEditorCommandError(
      "invalid-index",
      path,
      `Insert index ${index} is outside 0 to ${values.length}.`,
    );
  }
  return [
    ...values.slice(0, index).map(cloneJson),
    cloneJson(value),
    ...values.slice(index).map(cloneJson),
  ];
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

const findFrame = (
  actor: Actor,
  frameId: Id<"sprite-frame">,
): { readonly index: number; readonly frame: SpriteFrame } => {
  const index = actor.frames.findIndex((frame) => frame.id === frameId);
  if (index < 0) {
    throw new AnimationEditorCommandError(
      "missing-entity",
      "frameId",
      `Sprite frame '${frameId}' does not exist.`,
    );
  }
  const frame = actor.frames[index];
  if (!frame) throw new Error("Sprite frame index is invalid.");
  return { index, frame };
};

const findAnimation = (
  actor: Actor,
  animationId: Id<"animation-clip">,
): { readonly index: number; readonly animation: AnimationClip } => {
  const index = actor.animations.findIndex(
    (animation) => animation.id === animationId,
  );
  if (index < 0) {
    throw new AnimationEditorCommandError(
      "missing-entity",
      "animationId",
      `Animation clip '${animationId}' does not exist.`,
    );
  }
  const animation = actor.animations[index];
  if (!animation) throw new Error("Animation clip index is invalid.");
  return { index, animation };
};

const assertStableIdentity = (
  expected: string,
  actual: string,
  path: string,
): void => {
  if (expected !== actual) {
    throw new AnimationEditorCommandError(
      "identity-change",
      path,
      `Replace commands cannot change ID '${expected}' to '${actual}'.`,
    );
  }
};

const validateResult = (actor: Actor): Actor => {
  assertEditableActor(actor);
  return actor;
};

export const frameUsage = (
  actor: Actor,
  frameId: Id<"sprite-frame">,
): readonly FrameUsage[] =>
  actor.animations.flatMap((animation) => {
    const frameIndexes = animation.frameIds.flatMap((candidate, index) =>
      candidate === frameId ? [index] : [],
    );
    return frameIndexes.length > 0
      ? [
          {
            animationId: animation.id,
            state: animation.state,
            facing: animation.facing,
            frameIndexes,
          },
        ]
      : [];
  });

export const animationFrameTimeline = (
  actor: Actor,
  animationId: Id<"animation-clip">,
): readonly AnimationFrameTimelineEntry[] => {
  const { animation } = findAnimation(actor, animationId);
  const framesById = new Map(
    actor.frames.map((frame) => [frame.id as string, frame] as const),
  );
  let startTick = 0;
  return animation.frameIds.map((frameId, frameIndex) => {
    const frame = framesById.get(frameId);
    if (!frame) {
      throw new AnimationEditorCommandError(
        "invalid-actor",
        `animations.${animation.id}.frameIds[${frameIndex}]`,
        `Animation '${animation.id}' references missing frame '${frameId}'.`,
      );
    }
    const entry: AnimationFrameTimelineEntry = {
      frameIndex,
      frameId,
      startTick,
      endTick: startTick + frame.durationTicks,
      durationTicks: frame.durationTicks,
      events: frame.events ?? [],
    };
    startTick = entry.endTick;
    return entry;
  });
};

export const animationClipDurationTicks = (
  actor: Actor,
  animationId: Id<"animation-clip">,
): number =>
  animationFrameTimeline(actor, animationId).reduce(
    (total, frame) => total + frame.durationTicks,
    0,
  );

export const applyAnimationEditorCommand = (
  actor: Actor,
  command: AnimationEditorCommand,
): AppliedAnimationEditorCommand => {
  switch (command.kind) {
    case "batch": {
      if (command.commands.length === 0) {
        throw new AnimationEditorCommandError(
          "empty-batch",
          "commands",
          "Animation editor command batches cannot be empty.",
        );
      }
      let next = actor;
      const inverses: AnimationEditorCommand[] = [];
      for (const child of command.commands) {
        const applied = applyAnimationEditorCommand(next, child);
        next = applied.actor;
        inverses.unshift(applied.inverse);
      }
      return { actor: next, inverse: { kind: "batch", commands: inverses } };
    }
    case "replace-actor":
      assertStableIdentity(actor.id, command.actor.id, "actor.id");
      return {
        actor: validateResult(cloneJson(command.actor)),
        inverse: { kind: "replace-actor", actor },
      };
    case "insert-frame": {
      if (actor.frames.some((frame) => frame.id === command.frame.id)) {
        throw new AnimationEditorCommandError(
          "duplicate-id",
          "frame.id",
          `Sprite frame '${command.frame.id}' already exists.`,
        );
      }
      const next = validateResult({
        ...actor,
        frames: insertAt(actor.frames, command.index, command.frame, "index"),
      });
      return {
        actor: next,
        inverse: { kind: "remove-frame", frameId: command.frame.id },
      };
    }
    case "remove-frame": {
      const usage = frameUsage(actor, command.frameId);
      if (usage.length > 0) {
        throw new AnimationEditorCommandError(
          "protected-frame",
          "frameId",
          `Sprite frame '${command.frameId}' is used by ${usage
            .map((entry) => `'${entry.animationId}'`)
            .join(", ")}.`,
        );
      }
      const { index, frame } = findFrame(actor, command.frameId);
      return {
        actor: validateResult({ ...actor, frames: removeAt(actor.frames, index) }),
        inverse: { kind: "insert-frame", index, frame },
      };
    }
    case "replace-frame": {
      const { index, frame: previous } = findFrame(actor, command.frameId);
      assertStableIdentity(command.frameId, command.frame.id, "frame.id");
      return {
        actor: validateResult({
          ...actor,
          frames: replaceAt(actor.frames, index, command.frame),
        }),
        inverse: {
          kind: "replace-frame",
          frameId: command.frameId,
          frame: previous,
        },
      };
    }
    case "insert-animation": {
      if (
        actor.animations.some(
          (animation) => animation.id === command.animation.id,
        )
      ) {
        throw new AnimationEditorCommandError(
          "duplicate-id",
          "animation.id",
          `Animation clip '${command.animation.id}' already exists.`,
        );
      }
      const next = validateResult({
        ...actor,
        animations: insertAt(
          actor.animations,
          command.index,
          command.animation,
          "index",
        ),
      });
      return {
        actor: next,
        inverse: {
          kind: "remove-animation",
          animationId: command.animation.id,
        },
      };
    }
    case "remove-animation": {
      const { index, animation } = findAnimation(actor, command.animationId);
      return {
        actor: validateResult({
          ...actor,
          animations: removeAt(actor.animations, index),
        }),
        inverse: { kind: "insert-animation", index, animation },
      };
    }
    case "replace-animation": {
      const { index, animation: previous } = findAnimation(
        actor,
        command.animationId,
      );
      assertStableIdentity(
        command.animationId,
        command.animation.id,
        "animation.id",
      );
      return {
        actor: validateResult({
          ...actor,
          animations: replaceAt(
            actor.animations,
            index,
            command.animation,
          ),
        }),
        inverse: {
          kind: "replace-animation",
          animationId: command.animationId,
          animation: previous,
        },
      };
    }
    case "insert-clip-frame": {
      findFrame(actor, command.frameId);
      const { index, animation } = findAnimation(actor, command.animationId);
      const nextAnimation = {
        ...animation,
        frameIds: insertAt(
          animation.frameIds,
          command.index,
          command.frameId,
          "index",
        ),
      };
      return {
        actor: validateResult({
          ...actor,
          animations: replaceAt(actor.animations, index, nextAnimation),
        }),
        inverse: {
          kind: "remove-clip-frame",
          animationId: command.animationId,
          frameIndex: command.index,
          expectedFrameId: command.frameId,
        },
      };
    }
    case "remove-clip-frame": {
      const { index, animation } = findAnimation(actor, command.animationId);
      const actual = animation.frameIds[command.frameIndex];
      if (!actual || actual !== command.expectedFrameId) {
        throw new AnimationEditorCommandError(
          "stale-clip-frame",
          `animation.frameIds[${command.frameIndex}]`,
          `Expected frame '${command.expectedFrameId}' at index ${command.frameIndex}, found '${actual ?? "nothing"}'.`,
        );
      }
      const nextAnimation = {
        ...animation,
        frameIds: removeAt(animation.frameIds, command.frameIndex),
      };
      return {
        actor: validateResult({
          ...actor,
          animations: replaceAt(actor.animations, index, nextAnimation),
        }),
        inverse: {
          kind: "insert-clip-frame",
          animationId: command.animationId,
          index: command.frameIndex,
          frameId: actual,
        },
      };
    }
    case "replace-clip-frame": {
      findFrame(actor, command.frameId);
      const { index, animation } = findAnimation(actor, command.animationId);
      const actual = animation.frameIds[command.frameIndex];
      if (!actual || actual !== command.expectedFrameId) {
        throw new AnimationEditorCommandError(
          "stale-clip-frame",
          `animation.frameIds[${command.frameIndex}]`,
          `Expected frame '${command.expectedFrameId}' at index ${command.frameIndex}, found '${actual ?? "nothing"}'.`,
        );
      }
      const nextAnimation = {
        ...animation,
        frameIds: replaceAt(
          animation.frameIds,
          command.frameIndex,
          command.frameId,
        ),
      };
      return {
        actor: validateResult({
          ...actor,
          animations: replaceAt(actor.animations, index, nextAnimation),
        }),
        inverse: {
          kind: "replace-clip-frame",
          animationId: command.animationId,
          frameIndex: command.frameIndex,
          expectedFrameId: command.frameId,
          frameId: actual,
        },
      };
    }
  }
};

export const createAnimationEditorDocument = (
  actor: Actor,
): AnimationEditorDocumentState => {
  assertEditableActor(actor);
  const snapshot = cloneJson(actor);
  return {
    actor: snapshot,
    savedActor: cloneJson(snapshot),
    operationRevision: 0,
  };
};

export const isAnimationEditorDocumentDirty = (
  document: AnimationEditorDocumentState,
): boolean =>
  canonicalAnimationEditorJson(document.actor) !==
  canonicalAnimationEditorJson(document.savedActor);

export const createAnimationEditorHistory = (
  actor: Actor,
): AnimationEditorHistoryState => ({
  document: createAnimationEditorDocument(actor),
  undoStack: [],
  redoStack: [],
});

const applyToDocument = (
  document: AnimationEditorDocumentState,
  command: AnimationEditorCommand,
): {
  readonly document: AnimationEditorDocumentState;
  readonly inverse: AnimationEditorCommand;
} => {
  const applied = applyAnimationEditorCommand(document.actor, command);
  return {
    document: {
      ...document,
      actor: applied.actor,
      operationRevision: document.operationRevision + 1,
    },
    inverse: applied.inverse,
  };
};

export const executeAnimationEditorCommand = (
  history: AnimationEditorHistoryState,
  command: AnimationEditorCommand,
): AnimationEditorHistoryState => {
  const applied = applyToDocument(history.document, command);
  return {
    document: applied.document,
    undoStack: [
      ...history.undoStack,
      { undo: applied.inverse, redo: cloneJson(command) },
    ],
    redoStack: [],
  };
};

export const undoAnimationEditorCommand = (
  history: AnimationEditorHistoryState,
): AnimationEditorHistoryState => {
  const entry = history.undoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(history.document, entry.undo);
  return {
    document: applied.document,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, entry],
  };
};

export const redoAnimationEditorCommand = (
  history: AnimationEditorHistoryState,
): AnimationEditorHistoryState => {
  const entry = history.redoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(history.document, entry.redo);
  return {
    document: applied.document,
    undoStack: [...history.undoStack, entry],
    redoStack: history.redoStack.slice(0, -1),
  };
};

export const markAnimationEditorHistorySaved = (
  history: AnimationEditorHistoryState,
): AnimationEditorHistoryState => ({
  ...history,
  document: {
    ...history.document,
    savedActor: cloneJson(history.document.actor),
  },
});
