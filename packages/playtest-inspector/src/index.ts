import type { Id, Scalar } from "@evavo/adventure-project-schema";
import {
  parseReplayLog,
  ReplayCompatibilityError,
  validateReplayCompatibility,
  type ReplayEvent,
  type ReplayLog,
} from "@evavo/adventure-replay";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { loadSaveGame } from "@evavo/adventure-save-game";

export interface InspectedInventoryItem {
  readonly id: Id<"item">;
  readonly name: string;
}

export interface InspectedActorState {
  readonly instanceId: Id<"actor-instance">;
  readonly actorId: Id<"actor">;
  readonly actorName: string;
  readonly sceneId: Id<"scene">;
  readonly position: { readonly x: number; readonly y: number };
  readonly facing: string;
  readonly animationState: string;
  readonly animationClipId: Id<"animation-clip">;
  readonly frameIndex: number;
  readonly moving: boolean;
  readonly pendingCommand: boolean;
}

export interface SaveGameInspection {
  readonly projectId: Id<"project">;
  readonly saveFingerprint: string;
  readonly bundleFingerprint: string;
  readonly tick: number;
  readonly sceneId: Id<"scene">;
  readonly sceneName: string;
  readonly entranceId: Id<"entrance">;
  readonly score: number;
  readonly inventory: readonly InspectedInventoryItem[];
  readonly trueFlags: readonly string[];
  readonly falseFlags: readonly string[];
  readonly variables: readonly { readonly name: string; readonly value: Scalar }[];
  readonly actors: readonly InspectedActorState[];
  readonly objects: readonly {
    readonly instanceId: Id<"object">;
    readonly stateId: string;
  }[];
  readonly activeDialogue: {
    readonly dialogueId: Id<"dialogue">;
    readonly dialogueName: string;
    readonly nodeId: Id<"dialogue-node">;
  } | null;
  readonly activeSequences: readonly {
    readonly sequenceId: Id<"sequence">;
    readonly sequenceName: string;
    readonly elapsedTicks: number;
    readonly iteration: number;
  }[];
  readonly movementCount: number;
  readonly pendingCommandCount: number;
  readonly selectedVerbId: Id<"ui-verb"> | null;
  readonly selectedItemId: Id<"item"> | null;
  readonly controlledActorInstanceId: Id<"actor-instance"> | null;
  readonly statusText: string;
  readonly parserText: string;
  readonly parserHistory: readonly string[];
}

const compareText = (left: string, right: string): number =>
  left.localeCompare(right);

export const inspectSaveGame = (
  bundle: RuntimeBundle,
  input: unknown,
): SaveGameInspection => {
  const save = loadSaveGame(bundle, input);
  const scene = bundle.scenes.find(
    (candidate) => candidate.id === save.world.story.currentSceneId,
  );
  if (!scene) {
    throw new Error(
      `Validated save scene '${save.world.story.currentSceneId}' is unavailable.`,
    );
  }

  return {
    projectId: save.projectId,
    saveFingerprint: save.saveFingerprint,
    bundleFingerprint: save.bundleFingerprint,
    tick: save.world.story.tick,
    sceneId: scene.id,
    sceneName: scene.name,
    entranceId: save.world.story.currentEntranceId,
    score: save.world.story.score,
    inventory: save.world.story.inventory
      .map((itemId) => {
        const item = bundle.inventoryItems.find(
          (candidate) => candidate.id === itemId,
        );
        return { id: itemId, name: item?.name ?? itemId };
      })
      .sort((left, right) => compareText(left.id, right.id)),
    trueFlags: Object.entries(save.world.story.flags)
      .filter(([, value]) => value)
      .map(([name]) => name)
      .sort(compareText),
    falseFlags: Object.entries(save.world.story.flags)
      .filter(([, value]) => !value)
      .map(([name]) => name)
      .sort(compareText),
    variables: Object.entries(save.world.story.variables)
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => compareText(left.name, right.name)),
    actors: Object.values(save.world.actorInstances)
      .map((state) => {
        const actor = bundle.actors.find(
          (candidate) => candidate.id === state.actorId,
        );
        return {
          instanceId: state.instanceId,
          actorId: state.actorId,
          actorName: actor?.name ?? state.actorId,
          sceneId: state.sceneId,
          position: state.position,
          facing: state.facing,
          animationState: state.animationState,
          animationClipId: state.playback.clipId,
          frameIndex: state.playback.frameIndex,
          moving: save.world.movements[state.instanceId] !== undefined,
          pendingCommand:
            save.world.pendingObjectCommands[state.instanceId] !== undefined,
        };
      })
      .sort((left, right) => compareText(left.instanceId, right.instanceId)),
    objects: Object.entries(save.world.story.objectStates)
      .map(([instanceId, stateId]) => ({
        instanceId: instanceId as Id<"object">,
        stateId,
      }))
      .sort((left, right) => compareText(left.instanceId, right.instanceId)),
    activeDialogue: save.world.story.activeDialogue
      ? {
          dialogueId: save.world.story.activeDialogue.dialogueId,
          dialogueName:
            bundle.dialogues.find(
              (dialogue) =>
                dialogue.id === save.world.story.activeDialogue?.dialogueId,
            )?.name ?? save.world.story.activeDialogue.dialogueId,
          nodeId: save.world.story.activeDialogue.nodeId,
        }
      : null,
    activeSequences: save.world.story.activeSequences
      .map((active) => ({
        sequenceId: active.sequenceId,
        sequenceName:
          bundle.sequences.find(
            (sequence) => sequence.id === active.sequenceId,
          )?.name ?? active.sequenceId,
        elapsedTicks: active.elapsedTicks,
        iteration: active.iteration,
      }))
      .sort((left, right) => compareText(left.sequenceId, right.sequenceId)),
    movementCount: Object.keys(save.world.movements).length,
    pendingCommandCount: Object.keys(save.world.pendingObjectCommands).length,
    selectedVerbId: save.interface.selectedVerbId,
    selectedItemId: save.interface.selectedItemId,
    controlledActorInstanceId: save.interface.controlledActorInstanceId,
    statusText: save.interface.statusText,
    parserText: save.interface.parser.text,
    parserHistory: save.interface.parser.history,
  };
};

export type SaveGameDiffCode =
  | "tick"
  | "scene"
  | "entrance"
  | "score"
  | "flag"
  | "variable"
  | "inventory"
  | "object-state"
  | "actor-state"
  | "movement"
  | "pending-command"
  | "active-dialogue"
  | "active-sequence"
  | "interface-selection"
  | "status"
  | "parser";

export interface SaveGameDiffEntry {
  readonly code: SaveGameDiffCode;
  readonly path: string;
  readonly before: unknown;
  readonly after: unknown;
}

export interface SaveGameDiff {
  readonly beforeFingerprint: string;
  readonly afterFingerprint: string;
  readonly changed: boolean;
  readonly entries: readonly SaveGameDiffEntry[];
}

const canonicalValue = (value: unknown): string => {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") {
      const source = input as Readonly<Record<string, unknown>>;
      const output: Record<string, unknown> = {};
      for (const key of Object.keys(source).sort(compareText)) {
        const child = source[key];
        if (child !== undefined) output[key] = normalize(child);
      }
      return output;
    }
    return input;
  };
  return JSON.stringify(normalize(value));
};

const addChanged = (
  entries: SaveGameDiffEntry[],
  code: SaveGameDiffCode,
  path: string,
  before: unknown,
  after: unknown,
): void => {
  if (canonicalValue(before) !== canonicalValue(after)) {
    entries.push({ code, path, before, after });
  }
};

const diffRecord = (
  entries: SaveGameDiffEntry[],
  code: SaveGameDiffCode,
  path: string,
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
): void => {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort(
    compareText,
  );
  for (const key of keys) {
    addChanged(entries, code, `${path}.${key}`, before[key] ?? null, after[key] ?? null);
  }
};

const sortedSet = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort(compareText);

export const diffSaveGames = (
  bundle: RuntimeBundle,
  beforeInput: unknown,
  afterInput: unknown,
): SaveGameDiff => {
  const before = loadSaveGame(bundle, beforeInput);
  const after = loadSaveGame(bundle, afterInput);
  const entries: SaveGameDiffEntry[] = [];

  addChanged(entries, "tick", "world.story.tick", before.world.story.tick, after.world.story.tick);
  addChanged(entries, "scene", "world.story.currentSceneId", before.world.story.currentSceneId, after.world.story.currentSceneId);
  addChanged(entries, "entrance", "world.story.currentEntranceId", before.world.story.currentEntranceId, after.world.story.currentEntranceId);
  addChanged(entries, "score", "world.story.score", before.world.story.score, after.world.story.score);
  addChanged(entries, "inventory", "world.story.inventory", sortedSet(before.world.story.inventory), sortedSet(after.world.story.inventory));
  diffRecord(entries, "flag", "world.story.flags", before.world.story.flags, after.world.story.flags);
  diffRecord(entries, "variable", "world.story.variables", before.world.story.variables, after.world.story.variables);
  diffRecord(entries, "object-state", "world.story.objectStates", before.world.story.objectStates, after.world.story.objectStates);
  diffRecord(entries, "actor-state", "world.actorInstances", before.world.actorInstances, after.world.actorInstances);
  diffRecord(entries, "movement", "world.movements", before.world.movements, after.world.movements);
  diffRecord(entries, "pending-command", "world.pendingObjectCommands", before.world.pendingObjectCommands, after.world.pendingObjectCommands);
  addChanged(entries, "active-dialogue", "world.story.activeDialogue", before.world.story.activeDialogue, after.world.story.activeDialogue);
  addChanged(entries, "active-sequence", "world.story.activeSequences", before.world.story.activeSequences, after.world.story.activeSequences);
  addChanged(entries, "interface-selection", "interface.controlledActorInstanceId", before.interface.controlledActorInstanceId, after.interface.controlledActorInstanceId);
  addChanged(entries, "interface-selection", "interface.selectedVerbId", before.interface.selectedVerbId, after.interface.selectedVerbId);
  addChanged(entries, "interface-selection", "interface.selectedItemId", before.interface.selectedItemId, after.interface.selectedItemId);
  addChanged(entries, "status", "interface.statusText", before.interface.statusText, after.interface.statusText);
  addChanged(entries, "parser", "interface.parser", before.interface.parser, after.interface.parser);

  return {
    beforeFingerprint: before.saveFingerprint,
    afterFingerprint: after.saveFingerprint,
    changed: entries.length > 0,
    entries,
  };
};

export interface InspectedReplayEvent {
  readonly tick: number;
  readonly sequence: number;
  readonly kind: ReplayEvent["kind"];
  readonly label: string;
  readonly event: ReplayEvent;
}

export interface ReplayInspection {
  readonly projectId: string;
  readonly replayFingerprint: string;
  readonly bundleFingerprint: string;
  readonly initialTick: number;
  readonly finalTick: number;
  readonly durationTicks: number;
  readonly eventCount: number;
  readonly expectedFinalSaveFingerprint: string | null;
  readonly initialSave: SaveGameInspection;
  readonly timeline: readonly {
    readonly tick: number;
    readonly events: readonly InspectedReplayEvent[];
  }[];
}

const replayEventLabel = (event: ReplayEvent): string =>
  event.kind === "activate"
    ? `Activate ${event.position.x}, ${event.position.y}`
    : event.input.kind === "text"
      ? `Parser text: ${event.input.text}`
      : `Parser: ${event.input.kind}`;

export const inspectReplay = (
  bundle: RuntimeBundle,
  input: unknown,
): ReplayInspection => {
  const replay: ReplayLog = parseReplayLog(input);
  const issues = validateReplayCompatibility(bundle, replay);
  if (issues.length > 0) throw new ReplayCompatibilityError(issues);

  const grouped = new Map<number, InspectedReplayEvent[]>();
  for (const event of replay.events) {
    const events = grouped.get(event.tick) ?? [];
    events.push({
      tick: event.tick,
      sequence: event.sequence,
      kind: event.kind,
      label: replayEventLabel(event),
      event,
    });
    grouped.set(event.tick, events);
  }

  return {
    projectId: replay.projectId,
    replayFingerprint: replay.replayFingerprint,
    bundleFingerprint: replay.bundleFingerprint,
    initialTick: replay.initialSave.world.story.tick,
    finalTick: replay.finalTick,
    durationTicks: replay.finalTick - replay.initialSave.world.story.tick,
    eventCount: replay.events.length,
    expectedFinalSaveFingerprint: replay.expectedFinalSaveFingerprint ?? null,
    initialSave: inspectSaveGame(bundle, replay.initialSave),
    timeline: [...grouped.entries()]
      .sort(([left], [right]) => left - right)
      .map(([tick, events]) => ({
        tick,
        events: [...events].sort((left, right) => left.sequence - right.sequence),
      })),
  };
};
