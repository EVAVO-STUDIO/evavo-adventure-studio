import type {
  AdventureProject,
  DepthBand,
  Entrance,
  Hotspot,
  Id,
  NavigationArea,
  PresentationProfile,
  Scene,
} from "@evavo/adventure-project-schema";

export class ProjectEditorCommandError extends Error {
  readonly code:
    | "invalid-index"
    | "duplicate-id"
    | "missing-entity"
    | "identity-change"
    | "protected-entity"
    | "empty-batch";
  readonly path: string;

  constructor(
    code: ProjectEditorCommandError["code"],
    path: string,
    message: string,
  ) {
    super(message);
    this.name = "ProjectEditorCommandError";
    this.code = code;
    this.path = path;
  }
}

export interface BatchProjectEditorCommand {
  readonly kind: "batch";
  readonly commands: readonly ProjectEditorCommand[];
}

export type ProjectEditorCommand =
  | BatchProjectEditorCommand
  | {
      readonly kind: "replace-presentation";
      readonly presentation: PresentationProfile;
    }
  | { readonly kind: "insert-scene"; readonly index: number; readonly scene: Scene }
  | { readonly kind: "remove-scene"; readonly sceneId: Id<"scene"> }
  | {
      readonly kind: "replace-scene";
      readonly sceneId: Id<"scene">;
      readonly scene: Scene;
    }
  | {
      readonly kind: "insert-navigation-area";
      readonly sceneId: Id<"scene">;
      readonly index: number;
      readonly area: NavigationArea;
    }
  | {
      readonly kind: "remove-navigation-area";
      readonly sceneId: Id<"scene">;
      readonly areaId: Id<"navigation-area">;
    }
  | {
      readonly kind: "replace-navigation-area";
      readonly sceneId: Id<"scene">;
      readonly areaId: Id<"navigation-area">;
      readonly area: NavigationArea;
    }
  | {
      readonly kind: "insert-depth-band";
      readonly sceneId: Id<"scene">;
      readonly index: number;
      readonly band: DepthBand;
    }
  | {
      readonly kind: "remove-depth-band";
      readonly sceneId: Id<"scene">;
      readonly bandId: Id<"depth-band">;
    }
  | {
      readonly kind: "replace-depth-band";
      readonly sceneId: Id<"scene">;
      readonly bandId: Id<"depth-band">;
      readonly band: DepthBand;
    }
  | {
      readonly kind: "insert-hotspot";
      readonly sceneId: Id<"scene">;
      readonly index: number;
      readonly hotspot: Hotspot;
    }
  | {
      readonly kind: "remove-hotspot";
      readonly sceneId: Id<"scene">;
      readonly hotspotId: Id<"hotspot">;
    }
  | {
      readonly kind: "replace-hotspot";
      readonly sceneId: Id<"scene">;
      readonly hotspotId: Id<"hotspot">;
      readonly hotspot: Hotspot;
    }
  | {
      readonly kind: "insert-entrance";
      readonly sceneId: Id<"scene">;
      readonly index: number;
      readonly entrance: Entrance;
    }
  | {
      readonly kind: "remove-entrance";
      readonly sceneId: Id<"scene">;
      readonly entranceId: Id<"entrance">;
    }
  | {
      readonly kind: "replace-entrance";
      readonly sceneId: Id<"scene">;
      readonly entranceId: Id<"entrance">;
      readonly entrance: Entrance;
    };

export interface AppliedProjectEditorCommand {
  readonly project: AdventureProject;
  readonly inverse: ProjectEditorCommand;
}

export interface ProjectEditorDocumentState {
  readonly project: AdventureProject;
  readonly savedProject: AdventureProject;
  readonly operationRevision: number;
}

export interface ProjectEditorHistoryEntry {
  readonly undo: ProjectEditorCommand;
  readonly redo: ProjectEditorCommand;
}

export interface ProjectEditorHistoryState {
  readonly document: ProjectEditorDocumentState;
  readonly undoStack: readonly ProjectEditorHistoryEntry[];
  readonly redoStack: readonly ProjectEditorHistoryEntry[];
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) =>
      left.localeCompare(right),
    )) {
      const child = source[key];
      if (child !== undefined) {
        result[key] = canonicalize(child);
      }
    }
    return result;
  }
  return value;
};

export const canonicalProjectEditorJson = (value: unknown): string => {
  const output = JSON.stringify(canonicalize(value));
  if (output === undefined) {
    throw new TypeError("Project editor data cannot be represented as JSON.");
  }
  return output;
};

const assertInsertIndex = (
  index: number,
  length: number,
  path: string,
): void => {
  if (!Number.isSafeInteger(index) || index < 0 || index > length) {
    throw new ProjectEditorCommandError(
      "invalid-index",
      path,
      `Insert index ${index} is outside 0 to ${length}.`,
    );
  }
};

const insertAt = <T>(
  values: readonly T[],
  index: number,
  value: T,
  path: string,
): readonly T[] => {
  assertInsertIndex(index, values.length, path);
  return [...values.slice(0, index), cloneJson(value), ...values.slice(index)];
};

const replaceAt = <T>(
  values: readonly T[],
  index: number,
  value: T,
): readonly T[] => [
  ...values.slice(0, index),
  cloneJson(value),
  ...values.slice(index + 1),
];

const removeAt = <T>(values: readonly T[], index: number): readonly T[] => [
  ...values.slice(0, index),
  ...values.slice(index + 1),
];

const findIndexOrThrow = <T>(
  values: readonly T[],
  matches: (value: T) => boolean,
  path: string,
  label: string,
): number => {
  const index = values.findIndex(matches);
  if (index < 0) {
    throw new ProjectEditorCommandError(
      "missing-entity",
      path,
      `${label} does not exist.`,
    );
  }
  return index;
};

const assertStableIdentity = (
  expected: string,
  actual: string,
  path: string,
): void => {
  if (expected !== actual) {
    throw new ProjectEditorCommandError(
      "identity-change",
      path,
      `Replace commands cannot change ID '${expected}' to '${actual}'.`,
    );
  }
};

const collectSceneIds = (scene: Scene): readonly string[] => [
  scene.id,
  ...scene.navigationAreas.map((area) => area.id),
  ...scene.depthBands.map((band) => band.id),
  ...scene.occluders.map((occluder) => occluder.id),
  ...scene.hotspots.flatMap((hotspot) => [
    hotspot.id,
    ...hotspot.interactions.map((interaction) => interaction.id),
  ]),
  ...scene.entrances.map((entrance) => entrance.id),
];

const collectProjectIds = (project: AdventureProject): ReadonlySet<string> => {
  const ids = new Set<string>([project.id]);
  for (const scene of project.scenes) {
    for (const id of collectSceneIds(scene)) ids.add(id);
  }
  for (const actor of project.actors) {
    ids.add(actor.id);
    for (const frame of actor.frames) ids.add(frame.id);
    for (const animation of actor.animations) ids.add(animation.id);
  }
  for (const dialogue of project.dialogues) {
    ids.add(dialogue.id);
    for (const node of dialogue.nodes) {
      ids.add(node.id);
      for (const line of node.lines) ids.add(line.id);
      for (const choice of node.choices) ids.add(choice.id);
    }
  }
  for (const sequence of project.sequences) {
    ids.add(sequence.id);
    for (const track of sequence.tracks) ids.add(track.id);
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
  const existing = collectProjectIds(project);
  const local = new Set<string>();
  for (const id of ids) {
    if (local.has(id)) {
      throw new ProjectEditorCommandError(
        "duplicate-id",
        path,
        `Inserted data declares ID '${id}' more than once.`,
      );
    }
    local.add(id);
    if (existing.has(id) && !ignored.has(id)) {
      throw new ProjectEditorCommandError(
        "duplicate-id",
        path,
        `ID '${id}' already exists in the project.`,
      );
    }
  }
};

const sceneIndex = (
  project: AdventureProject,
  sceneId: Id<"scene">,
): number =>
  findIndexOrThrow(
    project.scenes,
    (scene) => scene.id === sceneId,
    "sceneId",
    `Scene '${sceneId}'`,
  );

const updateScene = (
  project: AdventureProject,
  index: number,
  scene: Scene,
): AdventureProject => ({
  ...project,
  scenes: replaceAt(project.scenes, index, scene),
});

type SceneCollectionKey =
  | "navigationAreas"
  | "depthBands"
  | "hotspots"
  | "entrances";

type SceneEntity<K extends SceneCollectionKey> = Scene[K][number];

const insertSceneEntity = <K extends SceneCollectionKey>(
  project: AdventureProject,
  sceneId: Id<"scene">,
  key: K,
  index: number,
  entity: SceneEntity<K>,
  entityIds: readonly string[],
): AdventureProject => {
  const indexOfScene = sceneIndex(project, sceneId);
  const scene = project.scenes[indexOfScene];
  if (!scene) throw new Error("Scene insertion index is invalid.");
  assertUniqueIds(project, entityIds, `${key}[${index}]`);
  return updateScene(project, indexOfScene, {
    ...scene,
    [key]: insertAt(scene[key], index, entity, "index"),
  });
};

const removeSceneEntity = <K extends SceneCollectionKey>(
  project: AdventureProject,
  sceneId: Id<"scene">,
  key: K,
  entityId: string,
  path: string,
  label: string,
): {
  readonly project: AdventureProject;
  readonly removed: SceneEntity<K>;
  readonly index: number;
} => {
  const indexOfScene = sceneIndex(project, sceneId);
  const scene = project.scenes[indexOfScene];
  if (!scene) throw new Error("Scene removal index is invalid.");
  const index = findIndexOrThrow(
    scene[key],
    (entity) => entity.id === entityId,
    path,
    label,
  );
  const removed = scene[key][index];
  if (!removed) throw new Error("Scene entity removal index is invalid.");
  return {
    project: updateScene(project, indexOfScene, {
      ...scene,
      [key]: removeAt(scene[key], index),
    }),
    removed,
    index,
  };
};

const replaceSceneEntity = <K extends SceneCollectionKey>(
  project: AdventureProject,
  sceneId: Id<"scene">,
  key: K,
  entityId: string,
  entity: SceneEntity<K>,
  entityIds: readonly string[],
  path: string,
  label: string,
): {
  readonly project: AdventureProject;
  readonly previous: SceneEntity<K>;
} => {
  const indexOfScene = sceneIndex(project, sceneId);
  const scene = project.scenes[indexOfScene];
  if (!scene) throw new Error("Scene replacement index is invalid.");
  const index = findIndexOrThrow(
    scene[key],
    (candidate) => candidate.id === entityId,
    path,
    label,
  );
  const previous = scene[key][index];
  if (!previous) throw new Error("Scene entity replacement index is invalid.");
  assertStableIdentity(entityId, entity.id, `${path}.id`);
  const previousIds =
    key === "hotspots"
      ? [
          previous.id,
          ...(previous as Hotspot).interactions.map(
            (interaction) => interaction.id,
          ),
        ]
      : [previous.id];
  assertUniqueIds(project, entityIds, path, new Set(previousIds));
  return {
    project: updateScene(project, indexOfScene, {
      ...scene,
      [key]: replaceAt(scene[key], index, entity),
    }),
    previous,
  };
};

export const applyProjectEditorCommand = (
  project: AdventureProject,
  command: ProjectEditorCommand,
): AppliedProjectEditorCommand => {
  switch (command.kind) {
    case "batch": {
      if (command.commands.length === 0) {
        throw new ProjectEditorCommandError(
          "empty-batch",
          "commands",
          "Project editor command batches cannot be empty.",
        );
      }
      let next = project;
      const inverses: ProjectEditorCommand[] = [];
      for (const child of command.commands) {
        const applied = applyProjectEditorCommand(next, child);
        next = applied.project;
        inverses.unshift(applied.inverse);
      }
      return {
        project: next,
        inverse: { kind: "batch", commands: inverses },
      };
    }
    case "replace-presentation":
      return {
        project: { ...project, presentation: cloneJson(command.presentation) },
        inverse: {
          kind: "replace-presentation",
          presentation: project.presentation,
        },
      };
    case "insert-scene": {
      assertUniqueIds(project, collectSceneIds(command.scene), "scene");
      return {
        project: {
          ...project,
          scenes: insertAt(project.scenes, command.index, command.scene, "index"),
        },
        inverse: { kind: "remove-scene", sceneId: command.scene.id },
      };
    }
    case "remove-scene": {
      if (command.sceneId === project.startSceneId) {
        throw new ProjectEditorCommandError(
          "protected-entity",
          "sceneId",
          `Start scene '${command.sceneId}' cannot be removed.`,
        );
      }
      const index = sceneIndex(project, command.sceneId);
      const removed = project.scenes[index];
      if (!removed) throw new Error("Scene removal index is invalid.");
      return {
        project: { ...project, scenes: removeAt(project.scenes, index) },
        inverse: { kind: "insert-scene", index, scene: removed },
      };
    }
    case "replace-scene": {
      const index = sceneIndex(project, command.sceneId);
      const previous = project.scenes[index];
      if (!previous) throw new Error("Scene replacement index is invalid.");
      assertStableIdentity(command.sceneId, command.scene.id, "scene.id");
      if (
        command.sceneId === project.startSceneId &&
        !command.scene.entrances.some(
          (entrance) => entrance.id === project.startEntranceId,
        )
      ) {
        throw new ProjectEditorCommandError(
          "protected-entity",
          "scene.entrances",
          `Start entrance '${project.startEntranceId}' must remain in the start scene.`,
        );
      }
      assertUniqueIds(
        project,
        collectSceneIds(command.scene),
        "scene",
        new Set(collectSceneIds(previous)),
      );
      return {
        project: updateScene(project, index, command.scene),
        inverse: {
          kind: "replace-scene",
          sceneId: command.sceneId,
          scene: previous,
        },
      };
    }
    case "insert-navigation-area":
      return {
        project: insertSceneEntity(
          project,
          command.sceneId,
          "navigationAreas",
          command.index,
          command.area,
          [command.area.id],
        ),
        inverse: {
          kind: "remove-navigation-area",
          sceneId: command.sceneId,
          areaId: command.area.id,
        },
      };
    case "remove-navigation-area": {
      const removed = removeSceneEntity(
        project,
        command.sceneId,
        "navigationAreas",
        command.areaId,
        "areaId",
        `Navigation area '${command.areaId}'`,
      );
      return {
        project: removed.project,
        inverse: {
          kind: "insert-navigation-area",
          sceneId: command.sceneId,
          index: removed.index,
          area: removed.removed,
        },
      };
    }
    case "replace-navigation-area": {
      const replaced = replaceSceneEntity(
        project,
        command.sceneId,
        "navigationAreas",
        command.areaId,
        command.area,
        [command.area.id],
        "areaId",
        `Navigation area '${command.areaId}'`,
      );
      return {
        project: replaced.project,
        inverse: {
          kind: "replace-navigation-area",
          sceneId: command.sceneId,
          areaId: command.areaId,
          area: replaced.previous,
        },
      };
    }
    case "insert-depth-band":
      return {
        project: insertSceneEntity(
          project,
          command.sceneId,
          "depthBands",
          command.index,
          command.band,
          [command.band.id],
        ),
        inverse: {
          kind: "remove-depth-band",
          sceneId: command.sceneId,
          bandId: command.band.id,
        },
      };
    case "remove-depth-band": {
      const removed = removeSceneEntity(
        project,
        command.sceneId,
        "depthBands",
        command.bandId,
        "bandId",
        `Depth band '${command.bandId}'`,
      );
      return {
        project: removed.project,
        inverse: {
          kind: "insert-depth-band",
          sceneId: command.sceneId,
          index: removed.index,
          band: removed.removed,
        },
      };
    }
    case "replace-depth-band": {
      const replaced = replaceSceneEntity(
        project,
        command.sceneId,
        "depthBands",
        command.bandId,
        command.band,
        [command.band.id],
        "bandId",
        `Depth band '${command.bandId}'`,
      );
      return {
        project: replaced.project,
        inverse: {
          kind: "replace-depth-band",
          sceneId: command.sceneId,
          bandId: command.bandId,
          band: replaced.previous,
        },
      };
    }
    case "insert-hotspot":
      return {
        project: insertSceneEntity(
          project,
          command.sceneId,
          "hotspots",
          command.index,
          command.hotspot,
          [
            command.hotspot.id,
            ...command.hotspot.interactions.map(
              (interaction) => interaction.id,
            ),
          ],
        ),
        inverse: {
          kind: "remove-hotspot",
          sceneId: command.sceneId,
          hotspotId: command.hotspot.id,
        },
      };
    case "remove-hotspot": {
      const removed = removeSceneEntity(
        project,
        command.sceneId,
        "hotspots",
        command.hotspotId,
        "hotspotId",
        `Hotspot '${command.hotspotId}'`,
      );
      return {
        project: removed.project,
        inverse: {
          kind: "insert-hotspot",
          sceneId: command.sceneId,
          index: removed.index,
          hotspot: removed.removed,
        },
      };
    }
    case "replace-hotspot": {
      const replaced = replaceSceneEntity(
        project,
        command.sceneId,
        "hotspots",
        command.hotspotId,
        command.hotspot,
        [
          command.hotspot.id,
          ...command.hotspot.interactions.map(
            (interaction) => interaction.id,
          ),
        ],
        "hotspotId",
        `Hotspot '${command.hotspotId}'`,
      );
      return {
        project: replaced.project,
        inverse: {
          kind: "replace-hotspot",
          sceneId: command.sceneId,
          hotspotId: command.hotspotId,
          hotspot: replaced.previous,
        },
      };
    }
    case "insert-entrance":
      return {
        project: insertSceneEntity(
          project,
          command.sceneId,
          "entrances",
          command.index,
          command.entrance,
          [command.entrance.id],
        ),
        inverse: {
          kind: "remove-entrance",
          sceneId: command.sceneId,
          entranceId: command.entrance.id,
        },
      };
    case "remove-entrance": {
      if (
        command.sceneId === project.startSceneId &&
        command.entranceId === project.startEntranceId
      ) {
        throw new ProjectEditorCommandError(
          "protected-entity",
          "entranceId",
          `Start entrance '${command.entranceId}' cannot be removed.`,
        );
      }
      const removed = removeSceneEntity(
        project,
        command.sceneId,
        "entrances",
        command.entranceId,
        "entranceId",
        `Entrance '${command.entranceId}'`,
      );
      return {
        project: removed.project,
        inverse: {
          kind: "insert-entrance",
          sceneId: command.sceneId,
          index: removed.index,
          entrance: removed.removed,
        },
      };
    }
    case "replace-entrance": {
      const replaced = replaceSceneEntity(
        project,
        command.sceneId,
        "entrances",
        command.entranceId,
        command.entrance,
        [command.entrance.id],
        "entranceId",
        `Entrance '${command.entranceId}'`,
      );
      return {
        project: replaced.project,
        inverse: {
          kind: "replace-entrance",
          sceneId: command.sceneId,
          entranceId: command.entranceId,
          entrance: replaced.previous,
        },
      };
    }
  }
};

export const createProjectEditorDocument = (
  project: AdventureProject,
): ProjectEditorDocumentState => {
  const snapshot = cloneJson(project);
  return {
    project: snapshot,
    savedProject: cloneJson(snapshot),
    operationRevision: 0,
  };
};

export const markProjectEditorDocumentSaved = (
  document: ProjectEditorDocumentState,
): ProjectEditorDocumentState => ({
  ...document,
  savedProject: cloneJson(document.project),
});

export const isProjectEditorDocumentDirty = (
  document: ProjectEditorDocumentState,
): boolean =>
  canonicalProjectEditorJson(document.project) !==
  canonicalProjectEditorJson(document.savedProject);

const applyToDocument = (
  document: ProjectEditorDocumentState,
  command: ProjectEditorCommand,
): {
  readonly document: ProjectEditorDocumentState;
  readonly inverse: ProjectEditorCommand;
} => {
  const applied = applyProjectEditorCommand(document.project, command);
  return {
    document: {
      ...document,
      project: applied.project,
      operationRevision: document.operationRevision + 1,
    },
    inverse: applied.inverse,
  };
};

export const createProjectEditorHistory = (
  project: AdventureProject,
): ProjectEditorHistoryState => ({
  document: createProjectEditorDocument(project),
  undoStack: [],
  redoStack: [],
});

export const executeProjectEditorCommand = (
  history: ProjectEditorHistoryState,
  command: ProjectEditorCommand,
): ProjectEditorHistoryState => {
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

export const undoProjectEditorCommand = (
  history: ProjectEditorHistoryState,
): ProjectEditorHistoryState => {
  const entry = history.undoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(history.document, entry.undo);
  return {
    document: applied.document,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, entry],
  };
};

export const redoProjectEditorCommand = (
  history: ProjectEditorHistoryState,
): ProjectEditorHistoryState => {
  const entry = history.redoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(history.document, entry.redo);
  return {
    document: applied.document,
    undoStack: [...history.undoStack, entry],
    redoStack: history.redoStack.slice(0, -1),
  };
};

export const markProjectEditorHistorySaved = (
  history: ProjectEditorHistoryState,
): ProjectEditorHistoryState => ({
  ...history,
  document: markProjectEditorDocumentSaved(history.document),
});
