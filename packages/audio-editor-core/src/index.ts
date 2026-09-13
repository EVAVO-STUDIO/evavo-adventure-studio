import type {
  AudioBusId,
  AudioBusMix,
  AudioCue,
  AudioDuckingRule,
  AudioMixManifest,
  AudioSceneLayer,
  AudioSceneSoundscape,
  AudioSpeechBinding,
} from "@evavo/adventure-audio";
import {
  audioMixManifestSchema,
  validateAudioMixManifest,
} from "@evavo/adventure-audio";
import type { AdventureProject, Id } from "@evavo/adventure-project-schema";

export type AudioEditorProject = Pick<
  AdventureProject,
  "id" | "presentation" | "assets" | "scenes" | "dialogues" | "sequences"
>;

export class AudioEditorCommandError extends Error {
  readonly code:
    | "invalid-index"
    | "duplicate-id"
    | "missing-entity"
    | "identity-change"
    | "empty-batch"
    | "invalid-document";
  readonly path: string;

  constructor(
    code: AudioEditorCommandError["code"],
    path: string,
    message: string,
  ) {
    super(message);
    this.name = "AudioEditorCommandError";
    this.code = code;
    this.path = path;
  }
}

export type AudioEditorCommand =
  | {
      readonly kind: "batch";
      readonly commands: readonly AudioEditorCommand[];
    }
  | {
      readonly kind: "replace-manifest";
      readonly manifest: AudioMixManifest;
    }
  | {
      readonly kind: "replace-bus";
      readonly busId: AudioBusId;
      readonly bus: AudioBusMix;
    }
  | {
      readonly kind: "insert-cue";
      readonly index: number;
      readonly cue: AudioCue;
    }
  | {
      readonly kind: "remove-cue";
      readonly cueId: Id<"audio-cue">;
    }
  | {
      readonly kind: "replace-cue";
      readonly cueId: Id<"audio-cue">;
      readonly cue: AudioCue;
    }
  | {
      readonly kind: "insert-ducking-rule";
      readonly index: number;
      readonly rule: AudioDuckingRule;
    }
  | {
      readonly kind: "remove-ducking-rule";
      readonly ruleId: Id<"audio-ducking-rule">;
    }
  | {
      readonly kind: "replace-ducking-rule";
      readonly ruleId: Id<"audio-ducking-rule">;
      readonly rule: AudioDuckingRule;
    }
  | {
      readonly kind: "insert-soundscape";
      readonly index: number;
      readonly soundscape: AudioSceneSoundscape;
    }
  | {
      readonly kind: "remove-soundscape";
      readonly sceneId: Id<"scene">;
    }
  | {
      readonly kind: "replace-soundscape";
      readonly sceneId: Id<"scene">;
      readonly soundscape: AudioSceneSoundscape;
    }
  | {
      readonly kind: "insert-scene-layer";
      readonly sceneId: Id<"scene">;
      readonly index: number;
      readonly layer: AudioSceneLayer;
    }
  | {
      readonly kind: "remove-scene-layer";
      readonly sceneId: Id<"scene">;
      readonly layerId: Id<"audio-scene-layer">;
    }
  | {
      readonly kind: "replace-scene-layer";
      readonly sceneId: Id<"scene">;
      readonly layerId: Id<"audio-scene-layer">;
      readonly layer: AudioSceneLayer;
    }
  | {
      readonly kind: "insert-speech-binding";
      readonly index: number;
      readonly binding: AudioSpeechBinding;
    }
  | {
      readonly kind: "remove-speech-binding";
      readonly bindingId: Id<"audio-speech-binding">;
    }
  | {
      readonly kind: "replace-speech-binding";
      readonly bindingId: Id<"audio-speech-binding">;
      readonly binding: AudioSpeechBinding;
    };

export interface AppliedAudioEditorCommand {
  readonly manifest: AudioMixManifest;
  readonly inverse: AudioEditorCommand;
}

export interface AudioEditorDocumentState {
  readonly manifest: AudioMixManifest;
  readonly savedManifest: AudioMixManifest;
  readonly operationRevision: number;
}

export interface AudioEditorHistoryEntry {
  readonly undo: AudioEditorCommand;
  readonly redo: AudioEditorCommand;
}

export interface AudioEditorHistoryState {
  readonly document: AudioEditorDocumentState;
  readonly undoStack: readonly AudioEditorHistoryEntry[];
  readonly redoStack: readonly AudioEditorHistoryEntry[];
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

export const canonicalAudioEditorJson = (value: unknown): string => {
  const output = JSON.stringify(canonicalize(value));
  if (output === undefined) {
    throw new TypeError("Audio editor data cannot be represented as JSON.");
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
    throw new AudioEditorCommandError(
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

const assertStableIdentity = (
  expected: string,
  actual: string,
  path: string,
): void => {
  if (expected !== actual) {
    throw new AudioEditorCommandError(
      "identity-change",
      path,
      `Replace commands cannot change ID '${expected}' to '${actual}'.`,
    );
  }
};

const findBus = (
  manifest: AudioMixManifest,
  busId: AudioBusId,
): { readonly index: number; readonly bus: AudioBusMix } => {
  const index = manifest.buses.findIndex((bus) => bus.id === busId);
  if (index < 0) {
    throw new AudioEditorCommandError(
      "missing-entity",
      "busId",
      `Audio bus '${busId}' does not exist.`,
    );
  }
  const bus = manifest.buses[index];
  if (!bus) throw new Error("Audio bus index is invalid.");
  return { index, bus };
};

const findCue = (
  manifest: AudioMixManifest,
  cueId: Id<"audio-cue">,
): { readonly index: number; readonly cue: AudioCue } => {
  const index = manifest.cues.findIndex((cue) => cue.id === cueId);
  if (index < 0) {
    throw new AudioEditorCommandError(
      "missing-entity",
      "cueId",
      `Audio cue '${cueId}' does not exist.`,
    );
  }
  const cue = manifest.cues[index];
  if (!cue) throw new Error("Audio cue index is invalid.");
  return { index, cue };
};

const findDuckingRule = (
  manifest: AudioMixManifest,
  ruleId: Id<"audio-ducking-rule">,
): { readonly index: number; readonly rule: AudioDuckingRule } => {
  const index = manifest.ducking.findIndex((rule) => rule.id === ruleId);
  if (index < 0) {
    throw new AudioEditorCommandError(
      "missing-entity",
      "ruleId",
      `Audio ducking rule '${ruleId}' does not exist.`,
    );
  }
  const rule = manifest.ducking[index];
  if (!rule) throw new Error("Audio ducking rule index is invalid.");
  return { index, rule };
};

const findSoundscape = (
  manifest: AudioMixManifest,
  sceneId: Id<"scene">,
): { readonly index: number; readonly soundscape: AudioSceneSoundscape } => {
  const index = manifest.soundscapes.findIndex(
    (soundscape) => soundscape.sceneId === sceneId,
  );
  if (index < 0) {
    throw new AudioEditorCommandError(
      "missing-entity",
      "sceneId",
      `Scene '${sceneId}' does not have an audio soundscape.`,
    );
  }
  const soundscape = manifest.soundscapes[index];
  if (!soundscape) throw new Error("Audio soundscape index is invalid.");
  return { index, soundscape };
};

const findSceneLayer = (
  soundscape: AudioSceneSoundscape,
  layerId: Id<"audio-scene-layer">,
): { readonly index: number; readonly layer: AudioSceneLayer } => {
  const index = soundscape.layers.findIndex((layer) => layer.id === layerId);
  if (index < 0) {
    throw new AudioEditorCommandError(
      "missing-entity",
      "layerId",
      `Audio layer '${layerId}' does not exist in scene '${soundscape.sceneId}'.`,
    );
  }
  const layer = soundscape.layers[index];
  if (!layer) throw new Error("Audio scene layer index is invalid.");
  return { index, layer };
};

const findSpeechBinding = (
  manifest: AudioMixManifest,
  bindingId: Id<"audio-speech-binding">,
): { readonly index: number; readonly binding: AudioSpeechBinding } => {
  const index = manifest.speechBindings.findIndex(
    (binding) => binding.id === bindingId,
  );
  if (index < 0) {
    throw new AudioEditorCommandError(
      "missing-entity",
      "bindingId",
      `Audio speech binding '${bindingId}' does not exist.`,
    );
  }
  const binding = manifest.speechBindings[index];
  if (!binding) throw new Error("Audio speech binding index is invalid.");
  return { index, binding };
};

const updateSoundscape = (
  manifest: AudioMixManifest,
  index: number,
  soundscape: AudioSceneSoundscape,
): AudioMixManifest => ({
  ...manifest,
  soundscapes: replaceAt(manifest.soundscapes, index, soundscape),
});

const applyUnchecked = (
  manifest: AudioMixManifest,
  command: AudioEditorCommand,
): AppliedAudioEditorCommand => {
  switch (command.kind) {
    case "batch": {
      if (command.commands.length === 0) {
        throw new AudioEditorCommandError(
          "empty-batch",
          "commands",
          "Audio editor command batches cannot be empty.",
        );
      }
      let next = manifest;
      const inverses: AudioEditorCommand[] = [];
      for (const child of command.commands) {
        const applied = applyUnchecked(next, child);
        next = applied.manifest;
        inverses.unshift(applied.inverse);
      }
      return {
        manifest: next,
        inverse: { kind: "batch", commands: inverses },
      };
    }
    case "replace-manifest":
      assertStableIdentity(
        manifest.projectId,
        command.manifest.projectId,
        "manifest.projectId",
      );
      return {
        manifest: cloneJson(command.manifest),
        inverse: { kind: "replace-manifest", manifest },
      };
    case "replace-bus": {
      const { index, bus: previous } = findBus(manifest, command.busId);
      assertStableIdentity(command.busId, command.bus.id, "bus.id");
      return {
        manifest: {
          ...manifest,
          buses: replaceAt(manifest.buses, index, command.bus),
        },
        inverse: {
          kind: "replace-bus",
          busId: command.busId,
          bus: previous,
        },
      };
    }
    case "insert-cue": {
      if (manifest.cues.some((cue) => cue.id === command.cue.id)) {
        throw new AudioEditorCommandError(
          "duplicate-id",
          "cue.id",
          `Audio cue '${command.cue.id}' already exists.`,
        );
      }
      return {
        manifest: {
          ...manifest,
          cues: insertAt(manifest.cues, command.index, command.cue, "index"),
        },
        inverse: { kind: "remove-cue", cueId: command.cue.id },
      };
    }
    case "remove-cue": {
      const { index, cue } = findCue(manifest, command.cueId);
      return {
        manifest: { ...manifest, cues: removeAt(manifest.cues, index) },
        inverse: { kind: "insert-cue", index, cue },
      };
    }
    case "replace-cue": {
      const { index, cue: previous } = findCue(manifest, command.cueId);
      assertStableIdentity(command.cueId, command.cue.id, "cue.id");
      return {
        manifest: {
          ...manifest,
          cues: replaceAt(manifest.cues, index, command.cue),
        },
        inverse: {
          kind: "replace-cue",
          cueId: command.cueId,
          cue: previous,
        },
      };
    }
    case "insert-ducking-rule": {
      if (manifest.ducking.some((rule) => rule.id === command.rule.id)) {
        throw new AudioEditorCommandError(
          "duplicate-id",
          "rule.id",
          `Audio ducking rule '${command.rule.id}' already exists.`,
        );
      }
      return {
        manifest: {
          ...manifest,
          ducking: insertAt(
            manifest.ducking,
            command.index,
            command.rule,
            "index",
          ),
        },
        inverse: {
          kind: "remove-ducking-rule",
          ruleId: command.rule.id,
        },
      };
    }
    case "remove-ducking-rule": {
      const { index, rule } = findDuckingRule(manifest, command.ruleId);
      return {
        manifest: { ...manifest, ducking: removeAt(manifest.ducking, index) },
        inverse: { kind: "insert-ducking-rule", index, rule },
      };
    }
    case "replace-ducking-rule": {
      const { index, rule: previous } = findDuckingRule(
        manifest,
        command.ruleId,
      );
      assertStableIdentity(command.ruleId, command.rule.id, "rule.id");
      return {
        manifest: {
          ...manifest,
          ducking: replaceAt(manifest.ducking, index, command.rule),
        },
        inverse: {
          kind: "replace-ducking-rule",
          ruleId: command.ruleId,
          rule: previous,
        },
      };
    }
    case "insert-soundscape": {
      if (
        manifest.soundscapes.some(
          (soundscape) => soundscape.sceneId === command.soundscape.sceneId,
        )
      ) {
        throw new AudioEditorCommandError(
          "duplicate-id",
          "soundscape.sceneId",
          `Scene '${command.soundscape.sceneId}' already has a soundscape.`,
        );
      }
      return {
        manifest: {
          ...manifest,
          soundscapes: insertAt(
            manifest.soundscapes,
            command.index,
            command.soundscape,
            "index",
          ),
        },
        inverse: {
          kind: "remove-soundscape",
          sceneId: command.soundscape.sceneId,
        },
      };
    }
    case "remove-soundscape": {
      const { index, soundscape } = findSoundscape(manifest, command.sceneId);
      return {
        manifest: {
          ...manifest,
          soundscapes: removeAt(manifest.soundscapes, index),
        },
        inverse: { kind: "insert-soundscape", index, soundscape },
      };
    }
    case "replace-soundscape": {
      const { index, soundscape: previous } = findSoundscape(
        manifest,
        command.sceneId,
      );
      assertStableIdentity(
        command.sceneId,
        command.soundscape.sceneId,
        "soundscape.sceneId",
      );
      return {
        manifest: updateSoundscape(manifest, index, command.soundscape),
        inverse: {
          kind: "replace-soundscape",
          sceneId: command.sceneId,
          soundscape: previous,
        },
      };
    }
    case "insert-scene-layer": {
      const { index: soundscapeIndex, soundscape } = findSoundscape(
        manifest,
        command.sceneId,
      );
      if (soundscape.layers.some((layer) => layer.id === command.layer.id)) {
        throw new AudioEditorCommandError(
          "duplicate-id",
          "layer.id",
          `Audio layer '${command.layer.id}' already exists in scene '${command.sceneId}'.`,
        );
      }
      return {
        manifest: updateSoundscape(manifest, soundscapeIndex, {
          ...soundscape,
          layers: insertAt(
            soundscape.layers,
            command.index,
            command.layer,
            "index",
          ),
        }),
        inverse: {
          kind: "remove-scene-layer",
          sceneId: command.sceneId,
          layerId: command.layer.id,
        },
      };
    }
    case "remove-scene-layer": {
      const { index: soundscapeIndex, soundscape } = findSoundscape(
        manifest,
        command.sceneId,
      );
      const { index, layer } = findSceneLayer(soundscape, command.layerId);
      return {
        manifest: updateSoundscape(manifest, soundscapeIndex, {
          ...soundscape,
          layers: removeAt(soundscape.layers, index),
        }),
        inverse: {
          kind: "insert-scene-layer",
          sceneId: command.sceneId,
          index,
          layer,
        },
      };
    }
    case "replace-scene-layer": {
      const { index: soundscapeIndex, soundscape } = findSoundscape(
        manifest,
        command.sceneId,
      );
      const { index, layer: previous } = findSceneLayer(
        soundscape,
        command.layerId,
      );
      assertStableIdentity(command.layerId, command.layer.id, "layer.id");
      return {
        manifest: updateSoundscape(manifest, soundscapeIndex, {
          ...soundscape,
          layers: replaceAt(soundscape.layers, index, command.layer),
        }),
        inverse: {
          kind: "replace-scene-layer",
          sceneId: command.sceneId,
          layerId: command.layerId,
          layer: previous,
        },
      };
    }
    case "insert-speech-binding": {
      if (
        manifest.speechBindings.some(
          (binding) => binding.id === command.binding.id,
        )
      ) {
        throw new AudioEditorCommandError(
          "duplicate-id",
          "binding.id",
          `Audio speech binding '${command.binding.id}' already exists.`,
        );
      }
      return {
        manifest: {
          ...manifest,
          speechBindings: insertAt(
            manifest.speechBindings,
            command.index,
            command.binding,
            "index",
          ),
        },
        inverse: {
          kind: "remove-speech-binding",
          bindingId: command.binding.id,
        },
      };
    }
    case "remove-speech-binding": {
      const { index, binding } = findSpeechBinding(
        manifest,
        command.bindingId,
      );
      return {
        manifest: {
          ...manifest,
          speechBindings: removeAt(manifest.speechBindings, index),
        },
        inverse: { kind: "insert-speech-binding", index, binding },
      };
    }
    case "replace-speech-binding": {
      const { index, binding: previous } = findSpeechBinding(
        manifest,
        command.bindingId,
      );
      assertStableIdentity(
        command.bindingId,
        command.binding.id,
        "binding.id",
      );
      return {
        manifest: {
          ...manifest,
          speechBindings: replaceAt(
            manifest.speechBindings,
            index,
            command.binding,
          ),
        },
        inverse: {
          kind: "replace-speech-binding",
          bindingId: command.bindingId,
          binding: previous,
        },
      };
    }
  }
};

const validateDocument = (
  project: AudioEditorProject,
  manifest: AudioMixManifest,
): AudioMixManifest => {
  let parsed: AudioMixManifest;
  try {
    parsed = audioMixManifestSchema.parse(manifest);
  } catch (error) {
    throw new AudioEditorCommandError(
      "invalid-document",
      "$",
      error instanceof Error
        ? error.message
        : "Audio mix schema validation failed.",
    );
  }

  const errors = validateAudioMixManifest(project, parsed).filter(
    (issue) => issue.severity === "error",
  );
  if (errors.length > 0) {
    const first = errors[0];
    throw new AudioEditorCommandError(
      "invalid-document",
      first?.path ?? "$",
      first?.message ?? "Audio mix validation failed.",
    );
  }
  return parsed;
};

export const applyAudioEditorCommand = (
  project: AudioEditorProject,
  manifest: AudioMixManifest,
  command: AudioEditorCommand,
): AppliedAudioEditorCommand => {
  const applied = applyUnchecked(manifest, command);
  return {
    manifest: validateDocument(project, applied.manifest),
    inverse: applied.inverse,
  };
};

export const createAudioEditorDocument = (
  project: AudioEditorProject,
  manifest: AudioMixManifest,
): AudioEditorDocumentState => {
  const snapshot = cloneJson(validateDocument(project, manifest));
  return {
    manifest: snapshot,
    savedManifest: cloneJson(snapshot),
    operationRevision: 0,
  };
};

export const isAudioEditorDocumentDirty = (
  document: AudioEditorDocumentState,
): boolean =>
  canonicalAudioEditorJson(document.manifest) !==
  canonicalAudioEditorJson(document.savedManifest);

export const createAudioEditorHistory = (
  project: AudioEditorProject,
  manifest: AudioMixManifest,
): AudioEditorHistoryState => ({
  document: createAudioEditorDocument(project, manifest),
  undoStack: [],
  redoStack: [],
});

const applyToDocument = (
  project: AudioEditorProject,
  document: AudioEditorDocumentState,
  command: AudioEditorCommand,
): {
  readonly document: AudioEditorDocumentState;
  readonly inverse: AudioEditorCommand;
} => {
  const applied = applyAudioEditorCommand(project, document.manifest, command);
  return {
    document: {
      ...document,
      manifest: applied.manifest,
      operationRevision: document.operationRevision + 1,
    },
    inverse: applied.inverse,
  };
};

export const executeAudioEditorCommand = (
  project: AudioEditorProject,
  history: AudioEditorHistoryState,
  command: AudioEditorCommand,
): AudioEditorHistoryState => {
  const applied = applyToDocument(project, history.document, command);
  return {
    document: applied.document,
    undoStack: [
      ...history.undoStack,
      { undo: applied.inverse, redo: cloneJson(command) },
    ],
    redoStack: [],
  };
};

export const undoAudioEditorCommand = (
  project: AudioEditorProject,
  history: AudioEditorHistoryState,
): AudioEditorHistoryState => {
  const entry = history.undoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(project, history.document, entry.undo);
  return {
    document: applied.document,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, entry],
  };
};

export const redoAudioEditorCommand = (
  project: AudioEditorProject,
  history: AudioEditorHistoryState,
): AudioEditorHistoryState => {
  const entry = history.redoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(project, history.document, entry.redo);
  return {
    document: applied.document,
    undoStack: [...history.undoStack, entry],
    redoStack: history.redoStack.slice(0, -1),
  };
};

export const markAudioEditorHistorySaved = (
  history: AudioEditorHistoryState,
): AudioEditorHistoryState => ({
  ...history,
  document: {
    ...history.document,
    savedManifest: cloneJson(history.document.manifest),
  },
});
