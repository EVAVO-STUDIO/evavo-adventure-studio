import type {
  Action,
  AdventureProject,
  DialogueGraph,
  Id,
  Sequence,
} from "@evavo/adventure-project-schema";

export class NarrativeLibraryCommandError extends Error {
  readonly code:
    | "invalid-index"
    | "duplicate-id"
    | "missing-entity"
    | "identity-change"
    | "protected-entity"
    | "empty-batch";
  readonly path: string;

  constructor(
    code: NarrativeLibraryCommandError["code"],
    path: string,
    message: string,
  ) {
    super(message);
    this.name = "NarrativeLibraryCommandError";
    this.code = code;
    this.path = path;
  }
}

export type NarrativeLibraryCommand =
  | {
      readonly kind: "batch";
      readonly commands: readonly NarrativeLibraryCommand[];
    }
  | {
      readonly kind: "insert-dialogue";
      readonly index: number;
      readonly dialogue: DialogueGraph;
    }
  | {
      readonly kind: "remove-dialogue";
      readonly dialogueId: Id<"dialogue">;
    }
  | {
      readonly kind: "replace-dialogue";
      readonly dialogueId: Id<"dialogue">;
      readonly dialogue: DialogueGraph;
    }
  | {
      readonly kind: "insert-sequence";
      readonly index: number;
      readonly sequence: Sequence;
    }
  | {
      readonly kind: "remove-sequence";
      readonly sequenceId: Id<"sequence">;
    }
  | {
      readonly kind: "replace-sequence";
      readonly sequenceId: Id<"sequence">;
      readonly sequence: Sequence;
    };

export interface AppliedNarrativeLibraryCommand {
  readonly project: AdventureProject;
  readonly inverse: NarrativeLibraryCommand;
}

export interface NarrativeLibraryDocumentState {
  readonly project: AdventureProject;
  readonly savedProject: AdventureProject;
  readonly operationRevision: number;
}

export interface NarrativeLibraryHistoryEntry {
  readonly undo: NarrativeLibraryCommand;
  readonly redo: NarrativeLibraryCommand;
}

export interface NarrativeLibraryHistoryState {
  readonly document: NarrativeLibraryDocumentState;
  readonly undoStack: readonly NarrativeLibraryHistoryEntry[];
  readonly redoStack: readonly NarrativeLibraryHistoryEntry[];
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

export const canonicalNarrativeLibraryJson = (value: unknown): string => {
  const output = JSON.stringify(canonicalize(value));
  if (output === undefined) {
    throw new TypeError("Narrative library data cannot be represented as JSON.");
  }
  return output;
};

const insertAt = <T>(
  values: readonly T[],
  index: number,
  value: T,
  path: string,
): T[] => {
  if (!Number.isSafeInteger(index) || index < 0 || index > values.length) {
    throw new NarrativeLibraryCommandError(
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

const dialogueIds = (dialogue: DialogueGraph): string[] => [
  dialogue.id,
  ...dialogue.nodes.flatMap((node) => [
    node.id,
    ...node.lines.map((line) => line.id),
    ...node.choices.map((choice) => choice.id),
  ]),
];

const sequenceIds = (sequence: Sequence): string[] => [
  sequence.id,
  ...sequence.tracks.map((track) => track.id),
];

const projectIds = (project: AdventureProject): ReadonlySet<string> => {
  const ids = new Set<string>([project.id]);
  for (const scene of project.scenes) {
    ids.add(scene.id);
    for (const area of scene.navigationAreas) ids.add(area.id);
    for (const band of scene.depthBands) ids.add(band.id);
    for (const occluder of scene.occluders) ids.add(occluder.id);
    for (const hotspot of scene.hotspots) {
      ids.add(hotspot.id);
      for (const interaction of hotspot.interactions) ids.add(interaction.id);
    }
    for (const entrance of scene.entrances) ids.add(entrance.id);
  }
  for (const actor of project.actors) {
    ids.add(actor.id);
    for (const frame of actor.frames) ids.add(frame.id);
    for (const animation of actor.animations) ids.add(animation.id);
  }
  for (const dialogue of project.dialogues) {
    for (const id of dialogueIds(dialogue)) ids.add(id);
  }
  for (const sequence of project.sequences) {
    for (const id of sequenceIds(sequence)) ids.add(id);
  }
  for (const asset of project.assets) ids.add(asset.id);
  for (const item of project.inventoryItems) ids.add(item.id);
  return ids;
};

const assertUniqueIds = (
  project: AdventureProject,
  ids: readonly string[],
  path: string,
  ignored: ReadonlySet<string> = new Set(),
): void => {
  const existing = projectIds(project);
  const local = new Set<string>();
  for (const id of ids) {
    if (local.has(id)) {
      throw new NarrativeLibraryCommandError(
        "duplicate-id",
        path,
        `Narrative data declares ID '${id}' more than once.`,
      );
    }
    local.add(id);
    if (existing.has(id) && !ignored.has(id)) {
      throw new NarrativeLibraryCommandError(
        "duplicate-id",
        path,
        `ID '${id}' already exists in the project.`,
      );
    }
  }
};

const assertStableIdentity = (
  expected: string,
  actual: string,
  path: string,
): void => {
  if (expected !== actual) {
    throw new NarrativeLibraryCommandError(
      "identity-change",
      path,
      `Replace commands cannot change ID '${expected}' to '${actual}'.`,
    );
  }
};

interface ActionLocation {
  readonly action: Action;
  readonly path: string;
  readonly ownerDialogueId: Id<"dialogue"> | null;
  readonly ownerSequenceId: Id<"sequence"> | null;
}

const projectActions = (project: AdventureProject): readonly ActionLocation[] => {
  const locations: ActionLocation[] = [];
  project.scenes.forEach((scene, sceneIndex) => {
    scene.hotspots.forEach((hotspot, hotspotIndex) => {
      hotspot.interactions.forEach((interaction, interactionIndex) => {
        interaction.actions.forEach((action, actionIndex) => {
          locations.push({
            action,
            path: `scenes[${sceneIndex}].hotspots[${hotspotIndex}].interactions[${interactionIndex}].actions[${actionIndex}]`,
            ownerDialogueId: null,
            ownerSequenceId: null,
          });
        });
      });
    });
  });
  project.dialogues.forEach((dialogue, dialogueIndex) => {
    dialogue.nodes.forEach((node, nodeIndex) => {
      node.enterActions.forEach((action, actionIndex) => {
        locations.push({
          action,
          path: `dialogues[${dialogueIndex}].nodes[${nodeIndex}].enterActions[${actionIndex}]`,
          ownerDialogueId: dialogue.id,
          ownerSequenceId: null,
        });
      });
      node.exitActions.forEach((action, actionIndex) => {
        locations.push({
          action,
          path: `dialogues[${dialogueIndex}].nodes[${nodeIndex}].exitActions[${actionIndex}]`,
          ownerDialogueId: dialogue.id,
          ownerSequenceId: null,
        });
      });
      node.choices.forEach((choice, choiceIndex) => {
        choice.actions.forEach((action, actionIndex) => {
          locations.push({
            action,
            path: `dialogues[${dialogueIndex}].nodes[${nodeIndex}].choices[${choiceIndex}].actions[${actionIndex}]`,
            ownerDialogueId: dialogue.id,
            ownerSequenceId: null,
          });
        });
      });
    });
  });
  project.sequences.forEach((sequence, sequenceIndex) => {
    sequence.skip.completionActions.forEach((action, actionIndex) => {
      locations.push({
        action,
        path: `sequences[${sequenceIndex}].skip.completionActions[${actionIndex}]`,
        ownerDialogueId: null,
        ownerSequenceId: sequence.id,
      });
    });
    sequence.tracks.forEach((track, trackIndex) => {
      track.cues.forEach((cue, cueIndex) => {
        if (cue.kind !== "story-action") return;
        locations.push({
          action: cue.action,
          path: `sequences[${sequenceIndex}].tracks[${trackIndex}].cues[${cueIndex}].action`,
          ownerDialogueId: null,
          ownerSequenceId: sequence.id,
        });
      });
    });
  });
  return locations;
};

const dialogueReference = (
  project: AdventureProject,
  dialogueId: Id<"dialogue">,
): string | null => {
  for (const location of projectActions(project)) {
    if (
      location.action.kind === "start-dialogue" &&
      location.action.dialogueId === dialogueId &&
      location.ownerDialogueId !== dialogueId
    ) {
      return location.path;
    }
  }
  return null;
};

const sequenceReference = (
  project: AdventureProject,
  sequenceId: Id<"sequence">,
): string | null => {
  for (const location of projectActions(project)) {
    if (
      location.action.kind === "play-sequence" &&
      location.action.sequenceId === sequenceId &&
      location.ownerSequenceId !== sequenceId
    ) {
      return location.path;
    }
  }
  return null;
};

const findDialogue = (
  project: AdventureProject,
  dialogueId: Id<"dialogue">,
): { readonly index: number; readonly dialogue: DialogueGraph } => {
  const index = project.dialogues.findIndex(
    (dialogue) => dialogue.id === dialogueId,
  );
  if (index < 0) {
    throw new NarrativeLibraryCommandError(
      "missing-entity",
      "dialogueId",
      `Dialogue '${dialogueId}' does not exist.`,
    );
  }
  const dialogue = project.dialogues[index];
  if (!dialogue) throw new Error("Dialogue index is invalid.");
  return { index, dialogue };
};

const findSequence = (
  project: AdventureProject,
  sequenceId: Id<"sequence">,
): { readonly index: number; readonly sequence: Sequence } => {
  const index = project.sequences.findIndex(
    (sequence) => sequence.id === sequenceId,
  );
  if (index < 0) {
    throw new NarrativeLibraryCommandError(
      "missing-entity",
      "sequenceId",
      `Sequence '${sequenceId}' does not exist.`,
    );
  }
  const sequence = project.sequences[index];
  if (!sequence) throw new Error("Sequence index is invalid.");
  return { index, sequence };
};

export const applyNarrativeLibraryCommand = (
  project: AdventureProject,
  command: NarrativeLibraryCommand,
): AppliedNarrativeLibraryCommand => {
  switch (command.kind) {
    case "batch": {
      if (command.commands.length === 0) {
        throw new NarrativeLibraryCommandError(
          "empty-batch",
          "commands",
          "Narrative command batches cannot be empty.",
        );
      }
      let next = project;
      const inverses: NarrativeLibraryCommand[] = [];
      for (const child of command.commands) {
        const applied = applyNarrativeLibraryCommand(next, child);
        next = applied.project;
        inverses.unshift(applied.inverse);
      }
      return {
        project: next,
        inverse: { kind: "batch", commands: inverses },
      };
    }
    case "insert-dialogue":
      assertUniqueIds(project, dialogueIds(command.dialogue), "dialogue");
      return {
        project: {
          ...project,
          dialogues: insertAt(
            project.dialogues,
            command.index,
            command.dialogue,
            "index",
          ),
        },
        inverse: {
          kind: "remove-dialogue",
          dialogueId: command.dialogue.id,
        },
      };
    case "remove-dialogue": {
      const reference = dialogueReference(project, command.dialogueId);
      if (reference) {
        throw new NarrativeLibraryCommandError(
          "protected-entity",
          "dialogueId",
          `Dialogue '${command.dialogueId}' is referenced at '${reference}'.`,
        );
      }
      const { index, dialogue } = findDialogue(project, command.dialogueId);
      return {
        project: {
          ...project,
          dialogues: removeAt(project.dialogues, index),
        },
        inverse: { kind: "insert-dialogue", index, dialogue },
      };
    }
    case "replace-dialogue": {
      const { index, dialogue: previous } = findDialogue(
        project,
        command.dialogueId,
      );
      assertStableIdentity(
        command.dialogueId,
        command.dialogue.id,
        "dialogue.id",
      );
      assertUniqueIds(
        project,
        dialogueIds(command.dialogue),
        "dialogue",
        new Set(dialogueIds(previous)),
      );
      return {
        project: {
          ...project,
          dialogues: replaceAt(project.dialogues, index, command.dialogue),
        },
        inverse: {
          kind: "replace-dialogue",
          dialogueId: command.dialogueId,
          dialogue: previous,
        },
      };
    }
    case "insert-sequence":
      assertUniqueIds(project, sequenceIds(command.sequence), "sequence");
      return {
        project: {
          ...project,
          sequences: insertAt(
            project.sequences,
            command.index,
            command.sequence,
            "index",
          ),
        },
        inverse: {
          kind: "remove-sequence",
          sequenceId: command.sequence.id,
        },
      };
    case "remove-sequence": {
      const reference = sequenceReference(project, command.sequenceId);
      if (reference) {
        throw new NarrativeLibraryCommandError(
          "protected-entity",
          "sequenceId",
          `Sequence '${command.sequenceId}' is referenced at '${reference}'.`,
        );
      }
      const { index, sequence } = findSequence(project, command.sequenceId);
      return {
        project: {
          ...project,
          sequences: removeAt(project.sequences, index),
        },
        inverse: { kind: "insert-sequence", index, sequence },
      };
    }
    case "replace-sequence": {
      const { index, sequence: previous } = findSequence(
        project,
        command.sequenceId,
      );
      assertStableIdentity(
        command.sequenceId,
        command.sequence.id,
        "sequence.id",
      );
      assertUniqueIds(
        project,
        sequenceIds(command.sequence),
        "sequence",
        new Set(sequenceIds(previous)),
      );
      return {
        project: {
          ...project,
          sequences: replaceAt(project.sequences, index, command.sequence),
        },
        inverse: {
          kind: "replace-sequence",
          sequenceId: command.sequenceId,
          sequence: previous,
        },
      };
    }
  }
};

export const createNarrativeLibraryDocument = (
  project: AdventureProject,
): NarrativeLibraryDocumentState => {
  const snapshot = cloneJson(project);
  return {
    project: snapshot,
    savedProject: cloneJson(snapshot),
    operationRevision: 0,
  };
};

export const isNarrativeLibraryDocumentDirty = (
  document: NarrativeLibraryDocumentState,
): boolean =>
  canonicalNarrativeLibraryJson(document.project) !==
  canonicalNarrativeLibraryJson(document.savedProject);

export const createNarrativeLibraryHistory = (
  project: AdventureProject,
): NarrativeLibraryHistoryState => ({
  document: createNarrativeLibraryDocument(project),
  undoStack: [],
  redoStack: [],
});

const applyToDocument = (
  document: NarrativeLibraryDocumentState,
  command: NarrativeLibraryCommand,
): {
  readonly document: NarrativeLibraryDocumentState;
  readonly inverse: NarrativeLibraryCommand;
} => {
  const applied = applyNarrativeLibraryCommand(document.project, command);
  return {
    document: {
      ...document,
      project: applied.project,
      operationRevision: document.operationRevision + 1,
    },
    inverse: applied.inverse,
  };
};

export const executeNarrativeLibraryCommand = (
  history: NarrativeLibraryHistoryState,
  command: NarrativeLibraryCommand,
): NarrativeLibraryHistoryState => {
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

export const undoNarrativeLibraryCommand = (
  history: NarrativeLibraryHistoryState,
): NarrativeLibraryHistoryState => {
  const entry = history.undoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(history.document, entry.undo);
  return {
    document: applied.document,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, entry],
  };
};

export const redoNarrativeLibraryCommand = (
  history: NarrativeLibraryHistoryState,
): NarrativeLibraryHistoryState => {
  const entry = history.redoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(history.document, entry.redo);
  return {
    document: applied.document,
    undoStack: [...history.undoStack, entry],
    redoStack: history.redoStack.slice(0, -1),
  };
};

export const markNarrativeLibraryHistorySaved = (
  history: NarrativeLibraryHistoryState,
): NarrativeLibraryHistoryState => ({
  ...history,
  document: {
    ...history.document,
    savedProject: cloneJson(history.document.project),
  },
});
