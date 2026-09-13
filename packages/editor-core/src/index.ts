import type { Id } from "@evavo/adventure-project-schema";
import type {
  ObjectDefinition,
  SceneActorInstance,
  SceneComposition,
  SceneInstanceManifest,
  SceneNavigationPortal,
  SceneObjectInstance,
} from "@evavo/adventure-scene-instances";

export class EditorCommandError extends Error {
  readonly code:
    | "invalid-index"
    | "duplicate-id"
    | "missing-entity"
    | "identity-change"
    | "protected-entity"
    | "empty-batch";
  readonly path: string;

  constructor(code: EditorCommandError["code"], path: string, message: string) {
    super(message);
    this.name = "EditorCommandError";
    this.code = code;
    this.path = path;
  }
}

export interface BatchEditorCommand {
  readonly kind: "batch";
  readonly commands: readonly EditorCommand[];
}

export type EditorCommand =
  | BatchEditorCommand
  | {
      readonly kind: "insert-scene-composition";
      readonly index: number;
      readonly composition: SceneComposition;
    }
  | {
      readonly kind: "remove-scene-composition";
      readonly sceneId: Id<"scene">;
    }
  | {
      readonly kind: "replace-scene-composition";
      readonly sceneId: Id<"scene">;
      readonly composition: SceneComposition;
    }
  | {
      readonly kind: "insert-object-definition";
      readonly index: number;
      readonly definition: ObjectDefinition;
    }
  | {
      readonly kind: "remove-object-definition";
      readonly definitionId: Id<"object-definition">;
    }
  | {
      readonly kind: "replace-object-definition";
      readonly definitionId: Id<"object-definition">;
      readonly definition: ObjectDefinition;
    }
  | {
      readonly kind: "insert-actor-instance";
      readonly sceneId: Id<"scene">;
      readonly index: number;
      readonly instance: SceneActorInstance;
    }
  | {
      readonly kind: "remove-actor-instance";
      readonly sceneId: Id<"scene">;
      readonly instanceId: Id<"actor-instance">;
    }
  | {
      readonly kind: "replace-actor-instance";
      readonly sceneId: Id<"scene">;
      readonly instanceId: Id<"actor-instance">;
      readonly instance: SceneActorInstance;
    }
  | {
      readonly kind: "insert-object-instance";
      readonly sceneId: Id<"scene">;
      readonly index: number;
      readonly instance: SceneObjectInstance;
    }
  | {
      readonly kind: "remove-object-instance";
      readonly sceneId: Id<"scene">;
      readonly instanceId: Id<"object">;
    }
  | {
      readonly kind: "replace-object-instance";
      readonly sceneId: Id<"scene">;
      readonly instanceId: Id<"object">;
      readonly instance: SceneObjectInstance;
    }
  | {
      readonly kind: "insert-navigation-portal";
      readonly sceneId: Id<"scene">;
      readonly index: number;
      readonly portal: SceneNavigationPortal;
    }
  | {
      readonly kind: "remove-navigation-portal";
      readonly sceneId: Id<"scene">;
      readonly portalId: Id<"navigation-portal">;
    }
  | {
      readonly kind: "replace-navigation-portal";
      readonly sceneId: Id<"scene">;
      readonly portalId: Id<"navigation-portal">;
      readonly portal: SceneNavigationPortal;
    };

export interface AppliedEditorCommand {
  readonly manifest: SceneInstanceManifest;
  readonly inverse: EditorCommand;
}

export interface EditorDocumentState {
  readonly manifest: SceneInstanceManifest;
  readonly savedManifest: SceneInstanceManifest;
  readonly operationRevision: number;
}

export interface EditorHistoryEntry {
  readonly undo: EditorCommand;
  readonly redo: EditorCommand;
}

export interface EditorHistoryState {
  readonly document: EditorDocumentState;
  readonly undoStack: readonly EditorHistoryEntry[];
  readonly redoStack: readonly EditorHistoryEntry[];
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

export const canonicalEditorJson = (value: unknown): string => {
  const output = JSON.stringify(canonicalize(value));
  if (output === undefined) {
    throw new TypeError("Editor data cannot be represented as JSON.");
  }
  return output;
};

const insertAt = <T>(values: readonly T[], index: number, value: T, path: string): T[] => {
  if (!Number.isSafeInteger(index) || index < 0 || index > values.length) {
    throw new EditorCommandError(
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

const findIndexOrThrow = <T>(
  values: readonly T[],
  predicate: (value: T) => boolean,
  path: string,
  label: string,
): number => {
  const index = values.findIndex(predicate);
  if (index < 0) {
    throw new EditorCommandError("missing-entity", path, `${label} does not exist.`);
  }
  return index;
};

const assertStableIdentity = (expected: string, actual: string, path: string): void => {
  if (expected !== actual) {
    throw new EditorCommandError(
      "identity-change",
      path,
      `Replace commands cannot change ID '${expected}' to '${actual}'.`,
    );
  }
};

const definitionIds = (definition: ObjectDefinition): string[] => [
  definition.id,
  ...definition.states.flatMap((state) => [
    state.id,
    ...state.interactions.map((interaction) => interaction.id),
  ]),
];

const compositionIds = (composition: SceneComposition): string[] => [
  composition.sceneId,
  ...composition.actorInstances.map((instance) => instance.id),
  ...composition.objectInstances.map((instance) => instance.id),
  ...composition.navigationPortals.map((portal) => portal.id),
];

const manifestIds = (manifest: SceneInstanceManifest): ReadonlySet<string> => {
  const ids = new Set<string>([manifest.projectId]);
  for (const definition of manifest.objectDefinitions) {
    for (const id of definitionIds(definition)) ids.add(id);
  }
  for (const composition of manifest.scenes) {
    for (const id of compositionIds(composition)) ids.add(id);
  }
  return ids;
};

const assertUniqueIds = (
  manifest: SceneInstanceManifest,
  ids: readonly string[],
  path: string,
  ignored: ReadonlySet<string> = new Set(),
): void => {
  const existing = manifestIds(manifest);
  const local = new Set<string>();
  for (const id of ids) {
    if (local.has(id)) {
      throw new EditorCommandError("duplicate-id", path, `Inserted data declares ID '${id}' more than once.`);
    }
    local.add(id);
    if (existing.has(id) && !ignored.has(id)) {
      throw new EditorCommandError("duplicate-id", path, `ID '${id}' already exists in the scene document.`);
    }
  }
};

const sceneIndex = (manifest: SceneInstanceManifest, sceneId: Id<"scene">): number =>
  findIndexOrThrow(
    manifest.scenes,
    (composition) => composition.sceneId === sceneId,
    "sceneId",
    `Scene composition '${sceneId}'`,
  );

const updateScene = (
  manifest: SceneInstanceManifest,
  index: number,
  composition: SceneComposition,
): SceneInstanceManifest => ({
  ...manifest,
  scenes: replaceAt(manifest.scenes, index, composition),
});

const referencedDefinition = (
  manifest: SceneInstanceManifest,
  definitionId: Id<"object-definition">,
): SceneObjectInstance | null => {
  for (const composition of manifest.scenes) {
    const instance = composition.objectInstances.find((candidate) => candidate.definitionId === definitionId);
    if (instance) return instance;
  }
  return null;
};

export const applyEditorCommand = (
  manifest: SceneInstanceManifest,
  command: EditorCommand,
): AppliedEditorCommand => {
  switch (command.kind) {
    case "batch": {
      if (command.commands.length === 0) {
        throw new EditorCommandError("empty-batch", "commands", "Editor command batches cannot be empty.");
      }
      let next = manifest;
      const inverses: EditorCommand[] = [];
      for (const child of command.commands) {
        const applied = applyEditorCommand(next, child);
        next = applied.manifest;
        inverses.unshift(applied.inverse);
      }
      return {
        manifest: next,
        inverse: { kind: "batch", commands: inverses },
      };
    }
    case "insert-scene-composition": {
      if (manifest.scenes.some((composition) => composition.sceneId === command.composition.sceneId)) {
        throw new EditorCommandError(
          "duplicate-id",
          "composition.sceneId",
          `Scene composition '${command.composition.sceneId}' already exists.`,
        );
      }
      assertUniqueIds(manifest, compositionIds(command.composition), "composition");
      return {
        manifest: {
          ...manifest,
          scenes: insertAt(manifest.scenes, command.index, command.composition, "index"),
        },
        inverse: {
          kind: "remove-scene-composition",
          sceneId: command.composition.sceneId,
        },
      };
    }
    case "remove-scene-composition": {
      const index = sceneIndex(manifest, command.sceneId);
      const removed = manifest.scenes[index];
      if (!removed) throw new Error("Scene composition index is invalid.");
      return {
        manifest: { ...manifest, scenes: removeAt(manifest.scenes, index) },
        inverse: {
          kind: "insert-scene-composition",
          index,
          composition: removed,
        },
      };
    }
    case "replace-scene-composition": {
      const index = sceneIndex(manifest, command.sceneId);
      const previous = manifest.scenes[index];
      if (!previous) throw new Error("Scene composition index is invalid.");
      assertStableIdentity(command.sceneId, command.composition.sceneId, "composition.sceneId");
      assertUniqueIds(
        manifest,
        compositionIds(command.composition),
        "composition",
        new Set(compositionIds(previous)),
      );
      return {
        manifest: updateScene(manifest, index, command.composition),
        inverse: {
          kind: "replace-scene-composition",
          sceneId: command.sceneId,
          composition: previous,
        },
      };
    }
    case "insert-object-definition": {
      assertUniqueIds(manifest, definitionIds(command.definition), "definition");
      return {
        manifest: {
          ...manifest,
          objectDefinitions: insertAt(manifest.objectDefinitions, command.index, command.definition, "index"),
        },
        inverse: {
          kind: "remove-object-definition",
          definitionId: command.definition.id,
        },
      };
    }
    case "remove-object-definition": {
      const referenced = referencedDefinition(manifest, command.definitionId);
      if (referenced) {
        throw new EditorCommandError(
          "protected-entity",
          "definitionId",
          `Object definition '${command.definitionId}' is used by '${referenced.id}'.`,
        );
      }
      const index = findIndexOrThrow(
        manifest.objectDefinitions,
        (definition) => definition.id === command.definitionId,
        "definitionId",
        `Object definition '${command.definitionId}'`,
      );
      const removed = manifest.objectDefinitions[index];
      if (!removed) throw new Error("Object definition index is invalid.");
      return {
        manifest: {
          ...manifest,
          objectDefinitions: removeAt(manifest.objectDefinitions, index),
        },
        inverse: {
          kind: "insert-object-definition",
          index,
          definition: removed,
        },
      };
    }
    case "replace-object-definition": {
      const index = findIndexOrThrow(
        manifest.objectDefinitions,
        (definition) => definition.id === command.definitionId,
        "definitionId",
        `Object definition '${command.definitionId}'`,
      );
      const previous = manifest.objectDefinitions[index];
      if (!previous) throw new Error("Object definition index is invalid.");
      assertStableIdentity(command.definitionId, command.definition.id, "definition.id");
      if (!command.definition.states.some((state) => state.id === command.definition.initialStateId)) {
        throw new EditorCommandError(
          "protected-entity",
          "definition.initialStateId",
          `Initial state '${command.definition.initialStateId}' must exist.`,
        );
      }
      assertUniqueIds(
        manifest,
        definitionIds(command.definition),
        "definition",
        new Set(definitionIds(previous)),
      );
      return {
        manifest: {
          ...manifest,
          objectDefinitions: replaceAt(manifest.objectDefinitions, index, command.definition),
        },
        inverse: {
          kind: "replace-object-definition",
          definitionId: command.definitionId,
          definition: previous,
        },
      };
    }
    case "insert-actor-instance": {
      const index = sceneIndex(manifest, command.sceneId);
      const scene = manifest.scenes[index];
      if (!scene) throw new Error("Scene composition index is invalid.");
      assertUniqueIds(manifest, [command.instance.id], "instance.id");
      return {
        manifest: updateScene(manifest, index, {
          ...scene,
          actorInstances: insertAt(scene.actorInstances, command.index, command.instance, "index"),
        }),
        inverse: {
          kind: "remove-actor-instance",
          sceneId: command.sceneId,
          instanceId: command.instance.id,
        },
      };
    }
    case "remove-actor-instance": {
      const index = sceneIndex(manifest, command.sceneId);
      const scene = manifest.scenes[index];
      if (!scene) throw new Error("Scene composition index is invalid.");
      const entityIndex = findIndexOrThrow(
        scene.actorInstances,
        (instance) => instance.id === command.instanceId,
        "instanceId",
        `Actor instance '${command.instanceId}'`,
      );
      const removed = scene.actorInstances[entityIndex];
      if (!removed) throw new Error("Actor instance index is invalid.");
      return {
        manifest: updateScene(manifest, index, {
          ...scene,
          actorInstances: removeAt(scene.actorInstances, entityIndex),
        }),
        inverse: {
          kind: "insert-actor-instance",
          sceneId: command.sceneId,
          index: entityIndex,
          instance: removed,
        },
      };
    }
    case "replace-actor-instance": {
      const index = sceneIndex(manifest, command.sceneId);
      const scene = manifest.scenes[index];
      if (!scene) throw new Error("Scene composition index is invalid.");
      const entityIndex = findIndexOrThrow(
        scene.actorInstances,
        (instance) => instance.id === command.instanceId,
        "instanceId",
        `Actor instance '${command.instanceId}'`,
      );
      const previous = scene.actorInstances[entityIndex];
      if (!previous) throw new Error("Actor instance index is invalid.");
      assertStableIdentity(command.instanceId, command.instance.id, "instance.id");
      return {
        manifest: updateScene(manifest, index, {
          ...scene,
          actorInstances: replaceAt(scene.actorInstances, entityIndex, command.instance),
        }),
        inverse: {
          kind: "replace-actor-instance",
          sceneId: command.sceneId,
          instanceId: command.instanceId,
          instance: previous,
        },
      };
    }
    case "insert-object-instance": {
      const index = sceneIndex(manifest, command.sceneId);
      const scene = manifest.scenes[index];
      if (!scene) throw new Error("Scene composition index is invalid.");
      assertUniqueIds(manifest, [command.instance.id], "instance.id");
      return {
        manifest: updateScene(manifest, index, {
          ...scene,
          objectInstances: insertAt(scene.objectInstances, command.index, command.instance, "index"),
        }),
        inverse: {
          kind: "remove-object-instance",
          sceneId: command.sceneId,
          instanceId: command.instance.id,
        },
      };
    }
    case "remove-object-instance": {
      const index = sceneIndex(manifest, command.sceneId);
      const scene = manifest.scenes[index];
      if (!scene) throw new Error("Scene composition index is invalid.");
      const entityIndex = findIndexOrThrow(
        scene.objectInstances,
        (instance) => instance.id === command.instanceId,
        "instanceId",
        `Object instance '${command.instanceId}'`,
      );
      const removed = scene.objectInstances[entityIndex];
      if (!removed) throw new Error("Object instance index is invalid.");
      return {
        manifest: updateScene(manifest, index, {
          ...scene,
          objectInstances: removeAt(scene.objectInstances, entityIndex),
        }),
        inverse: {
          kind: "insert-object-instance",
          sceneId: command.sceneId,
          index: entityIndex,
          instance: removed,
        },
      };
    }
    case "replace-object-instance": {
      const index = sceneIndex(manifest, command.sceneId);
      const scene = manifest.scenes[index];
      if (!scene) throw new Error("Scene composition index is invalid.");
      const entityIndex = findIndexOrThrow(
        scene.objectInstances,
        (instance) => instance.id === command.instanceId,
        "instanceId",
        `Object instance '${command.instanceId}'`,
      );
      const previous = scene.objectInstances[entityIndex];
      if (!previous) throw new Error("Object instance index is invalid.");
      assertStableIdentity(command.instanceId, command.instance.id, "instance.id");
      return {
        manifest: updateScene(manifest, index, {
          ...scene,
          objectInstances: replaceAt(scene.objectInstances, entityIndex, command.instance),
        }),
        inverse: {
          kind: "replace-object-instance",
          sceneId: command.sceneId,
          instanceId: command.instanceId,
          instance: previous,
        },
      };
    }
    case "insert-navigation-portal": {
      const index = sceneIndex(manifest, command.sceneId);
      const scene = manifest.scenes[index];
      if (!scene) throw new Error("Scene composition index is invalid.");
      assertUniqueIds(manifest, [command.portal.id], "portal.id");
      return {
        manifest: updateScene(manifest, index, {
          ...scene,
          navigationPortals: insertAt(scene.navigationPortals, command.index, command.portal, "index"),
        }),
        inverse: {
          kind: "remove-navigation-portal",
          sceneId: command.sceneId,
          portalId: command.portal.id,
        },
      };
    }
    case "remove-navigation-portal": {
      const index = sceneIndex(manifest, command.sceneId);
      const scene = manifest.scenes[index];
      if (!scene) throw new Error("Scene composition index is invalid.");
      const entityIndex = findIndexOrThrow(
        scene.navigationPortals,
        (portal) => portal.id === command.portalId,
        "portalId",
        `Navigation portal '${command.portalId}'`,
      );
      const removed = scene.navigationPortals[entityIndex];
      if (!removed) throw new Error("Navigation portal index is invalid.");
      return {
        manifest: updateScene(manifest, index, {
          ...scene,
          navigationPortals: removeAt(scene.navigationPortals, entityIndex),
        }),
        inverse: {
          kind: "insert-navigation-portal",
          sceneId: command.sceneId,
          index: entityIndex,
          portal: removed,
        },
      };
    }
    case "replace-navigation-portal": {
      const index = sceneIndex(manifest, command.sceneId);
      const scene = manifest.scenes[index];
      if (!scene) throw new Error("Scene composition index is invalid.");
      const entityIndex = findIndexOrThrow(
        scene.navigationPortals,
        (portal) => portal.id === command.portalId,
        "portalId",
        `Navigation portal '${command.portalId}'`,
      );
      const previous = scene.navigationPortals[entityIndex];
      if (!previous) throw new Error("Navigation portal index is invalid.");
      assertStableIdentity(command.portalId, command.portal.id, "portal.id");
      return {
        manifest: updateScene(manifest, index, {
          ...scene,
          navigationPortals: replaceAt(scene.navigationPortals, entityIndex, command.portal),
        }),
        inverse: {
          kind: "replace-navigation-portal",
          sceneId: command.sceneId,
          portalId: command.portalId,
          portal: previous,
        },
      };
    }
  }
};

export const createEditorDocument = (manifest: SceneInstanceManifest): EditorDocumentState => {
  const snapshot = cloneJson(manifest);
  return {
    manifest: snapshot,
    savedManifest: cloneJson(snapshot),
    operationRevision: 0,
  };
};

export const markEditorDocumentSaved = (document: EditorDocumentState): EditorDocumentState => ({
  ...document,
  savedManifest: cloneJson(document.manifest),
});

export const isEditorDocumentDirty = (document: EditorDocumentState): boolean =>
  canonicalEditorJson(document.manifest) !== canonicalEditorJson(document.savedManifest);

const applyToDocument = (
  document: EditorDocumentState,
  command: EditorCommand,
): { readonly document: EditorDocumentState; readonly inverse: EditorCommand } => {
  const applied = applyEditorCommand(document.manifest, command);
  return {
    document: {
      ...document,
      manifest: applied.manifest,
      operationRevision: document.operationRevision + 1,
    },
    inverse: applied.inverse,
  };
};

export const createEditorHistory = (manifest: SceneInstanceManifest): EditorHistoryState => ({
  document: createEditorDocument(manifest),
  undoStack: [],
  redoStack: [],
});

export const executeEditorCommand = (
  history: EditorHistoryState,
  command: EditorCommand,
): EditorHistoryState => {
  const applied = applyToDocument(history.document, command);
  return {
    document: applied.document,
    undoStack: [...history.undoStack, { undo: applied.inverse, redo: cloneJson(command) }],
    redoStack: [],
  };
};

export const undoEditorCommand = (history: EditorHistoryState): EditorHistoryState => {
  const entry = history.undoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(history.document, entry.undo);
  return {
    document: applied.document,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, entry],
  };
};

export const redoEditorCommand = (history: EditorHistoryState): EditorHistoryState => {
  const entry = history.redoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(history.document, entry.redo);
  return {
    document: applied.document,
    undoStack: [...history.undoStack, entry],
    redoStack: history.redoStack.slice(0, -1),
  };
};

export const markEditorHistorySaved = (history: EditorHistoryState): EditorHistoryState => ({
  ...history,
  document: markEditorDocumentSaved(history.document),
});
