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

  constructor(code: ProjectEditorCommandError["code"], path: string, message: string) {
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

export const canonicalProjectEditorJson = (value: unknown): string => {
  const output = JSON.stringify(canonicalize(value));
  if (output === undefined) {
    throw new TypeError("Project editor data cannot be represented as JSON.");
  }
  return output;
};

const insertAt = <T>(values: readonly T[], index: number, value: T, path: string): T[] => {
  if (!Number.isSafeInteger(index) || index < 0 || index > values.length) {
    throw new ProjectEditorCommandError(
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
    throw new ProjectEditorCommandError("missing-entity", path, `${label} does not exist.`);
  }
  return index;
};

const assertStableIdentity = (expected: string, actual: string, path: string): void => {
  if (expected !== actual) {
    throw new ProjectEditorCommandError(
      "identity-change",
      path,
      `Replace commands cannot change ID '${expected}' to '${actual}'.`,
    );
  }
};

const sceneIds = (scene: Scene): string[] => [
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

const projectIds = (project: AdventureProject): ReadonlySet<string> => {
  const ids = new Set<string>([project.id]);
  for (const scene of project.scenes) {
    for (const id of sceneIds(scene)) ids.add(id);
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
  const existing = projectIds(project);
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
      throw new ProjectEditorCommandError("duplicate-id", path, `ID '${id}' already exists in the project.`);
    }
  }
};

const getScene = (
  project: AdventureProject,
  sceneId: Id<"scene">,
): { readonly index: number; readonly scene: Scene } => {
  const index = findIndexOrThrow(
    project.scenes,
    (scene) => scene.id === sceneId,
    "sceneId",
    `Scene '${sceneId}'`,
  );
  const scene = project.scenes[index];
  if (!scene) throw new Error("Scene index is invalid.");
  return { index, scene };
};

const updateScene = (project: AdventureProject, index: number, scene: Scene): AdventureProject => ({
  ...project,
  scenes: replaceAt(project.scenes, index, scene),
});

const navigationAreaIds = (area: NavigationArea): string[] => [area.id];
const depthBandIds = (band: DepthBand): string[] => [band.id];
const hotspotIds = (hotspot: Hotspot): string[] => [
  hotspot.id,
  ...hotspot.interactions.map((interaction) => interaction.id),
];
const entranceIds = (entrance: Entrance): string[] => [entrance.id];

const applyNavigationArea = (
  project: AdventureProject,
  command:
    | Extract<ProjectEditorCommand, { readonly kind: "insert-navigation-area" }>
    | Extract<ProjectEditorCommand, { readonly kind: "remove-navigation-area" }>
    | Extract<ProjectEditorCommand, { readonly kind: "replace-navigation-area" }>,
): AppliedProjectEditorCommand => {
  const { index: sceneIndex, scene } = getScene(project, command.sceneId);
  if (command.kind === "insert-navigation-area") {
    assertUniqueIds(project, navigationAreaIds(command.area), "area");
    return {
      project: updateScene(project, sceneIndex, {
        ...scene,
        navigationAreas: insertAt(scene.navigationAreas, command.index, command.area, "index"),
      }),
      inverse: {
        kind: "remove-navigation-area",
        sceneId: command.sceneId,
        areaId: command.area.id,
      },
    };
  }
  const entityIndex = findIndexOrThrow(
    scene.navigationAreas,
    (area) => area.id === command.areaId,
    "areaId",
    `Navigation area '${command.areaId}'`,
  );
  const previous = scene.navigationAreas[entityIndex];
  if (!previous) throw new Error("Navigation area index is invalid.");
  if (command.kind === "remove-navigation-area") {
    return {
      project: updateScene(project, sceneIndex, {
        ...scene,
        navigationAreas: removeAt(scene.navigationAreas, entityIndex),
      }),
      inverse: {
        kind: "insert-navigation-area",
        sceneId: command.sceneId,
        index: entityIndex,
        area: previous,
      },
    };
  }
  assertStableIdentity(command.areaId, command.area.id, "area.id");
  assertUniqueIds(project, navigationAreaIds(command.area), "area", new Set(navigationAreaIds(previous)));
  return {
    project: updateScene(project, sceneIndex, {
      ...scene,
      navigationAreas: replaceAt(scene.navigationAreas, entityIndex, command.area),
    }),
    inverse: {
      kind: "replace-navigation-area",
      sceneId: command.sceneId,
      areaId: command.areaId,
      area: previous,
    },
  };
};

const applyDepthBand = (
  project: AdventureProject,
  command:
    | Extract<ProjectEditorCommand, { readonly kind: "insert-depth-band" }>
    | Extract<ProjectEditorCommand, { readonly kind: "remove-depth-band" }>
    | Extract<ProjectEditorCommand, { readonly kind: "replace-depth-band" }>,
): AppliedProjectEditorCommand => {
  const { index: sceneIndex, scene } = getScene(project, command.sceneId);
  if (command.kind === "insert-depth-band") {
    assertUniqueIds(project, depthBandIds(command.band), "band");
    return {
      project: updateScene(project, sceneIndex, {
        ...scene,
        depthBands: insertAt(scene.depthBands, command.index, command.band, "index"),
      }),
      inverse: {
        kind: "remove-depth-band",
        sceneId: command.sceneId,
        bandId: command.band.id,
      },
    };
  }
  const entityIndex = findIndexOrThrow(
    scene.depthBands,
    (band) => band.id === command.bandId,
    "bandId",
    `Depth band '${command.bandId}'`,
  );
  const previous = scene.depthBands[entityIndex];
  if (!previous) throw new Error("Depth band index is invalid.");
  if (command.kind === "remove-depth-band") {
    return {
      project: updateScene(project, sceneIndex, {
        ...scene,
        depthBands: removeAt(scene.depthBands, entityIndex),
      }),
      inverse: {
        kind: "insert-depth-band",
        sceneId: command.sceneId,
        index: entityIndex,
        band: previous,
      },
    };
  }
  assertStableIdentity(command.bandId, command.band.id, "band.id");
  assertUniqueIds(project, depthBandIds(command.band), "band", new Set(depthBandIds(previous)));
  return {
    project: updateScene(project, sceneIndex, {
      ...scene,
      depthBands: replaceAt(scene.depthBands, entityIndex, command.band),
    }),
    inverse: {
      kind: "replace-depth-band",
      sceneId: command.sceneId,
      bandId: command.bandId,
      band: previous,
    },
  };
};

const applyHotspot = (
  project: AdventureProject,
  command:
    | Extract<ProjectEditorCommand, { readonly kind: "insert-hotspot" }>
    | Extract<ProjectEditorCommand, { readonly kind: "remove-hotspot" }>
    | Extract<ProjectEditorCommand, { readonly kind: "replace-hotspot" }>,
): AppliedProjectEditorCommand => {
  const { index: sceneIndex, scene } = getScene(project, command.sceneId);
  if (command.kind === "insert-hotspot") {
    assertUniqueIds(project, hotspotIds(command.hotspot), "hotspot");
    return {
      project: updateScene(project, sceneIndex, {
        ...scene,
        hotspots: insertAt(scene.hotspots, command.index, command.hotspot, "index"),
      }),
      inverse: {
        kind: "remove-hotspot",
        sceneId: command.sceneId,
        hotspotId: command.hotspot.id,
      },
    };
  }
  const entityIndex = findIndexOrThrow(
    scene.hotspots,
    (hotspot) => hotspot.id === command.hotspotId,
    "hotspotId",
    `Hotspot '${command.hotspotId}'`,
  );
  const previous = scene.hotspots[entityIndex];
  if (!previous) throw new Error("Hotspot index is invalid.");
  if (command.kind === "remove-hotspot") {
    return {
      project: updateScene(project, sceneIndex, {
        ...scene,
        hotspots: removeAt(scene.hotspots, entityIndex),
      }),
      inverse: {
        kind: "insert-hotspot",
        sceneId: command.sceneId,
        index: entityIndex,
        hotspot: previous,
      },
    };
  }
  assertStableIdentity(command.hotspotId, command.hotspot.id, "hotspot.id");
  assertUniqueIds(project, hotspotIds(command.hotspot), "hotspot", new Set(hotspotIds(previous)));
  return {
    project: updateScene(project, sceneIndex, {
      ...scene,
      hotspots: replaceAt(scene.hotspots, entityIndex, command.hotspot),
    }),
    inverse: {
      kind: "replace-hotspot",
      sceneId: command.sceneId,
      hotspotId: command.hotspotId,
      hotspot: previous,
    },
  };
};

const applyEntrance = (
  project: AdventureProject,
  command:
    | Extract<ProjectEditorCommand, { readonly kind: "insert-entrance" }>
    | Extract<ProjectEditorCommand, { readonly kind: "remove-entrance" }>
    | Extract<ProjectEditorCommand, { readonly kind: "replace-entrance" }>,
): AppliedProjectEditorCommand => {
  const { index: sceneIndex, scene } = getScene(project, command.sceneId);
  if (command.kind === "insert-entrance") {
    assertUniqueIds(project, entranceIds(command.entrance), "entrance");
    return {
      project: updateScene(project, sceneIndex, {
        ...scene,
        entrances: insertAt(scene.entrances, command.index, command.entrance, "index"),
      }),
      inverse: {
        kind: "remove-entrance",
        sceneId: command.sceneId,
        entranceId: command.entrance.id,
      },
    };
  }
  if (
    command.kind === "remove-entrance" &&
    command.sceneId === project.startSceneId &&
    command.entranceId === project.startEntranceId
  ) {
    throw new ProjectEditorCommandError(
      "protected-entity",
      "entranceId",
      `Start entrance '${command.entranceId}' cannot be removed.`,
    );
  }
  const entityIndex = findIndexOrThrow(
    scene.entrances,
    (entrance) => entrance.id === command.entranceId,
    "entranceId",
    `Entrance '${command.entranceId}'`,
  );
  const previous = scene.entrances[entityIndex];
  if (!previous) throw new Error("Entrance index is invalid.");
  if (command.kind === "remove-entrance") {
    return {
      project: updateScene(project, sceneIndex, {
        ...scene,
        entrances: removeAt(scene.entrances, entityIndex),
      }),
      inverse: {
        kind: "insert-entrance",
        sceneId: command.sceneId,
        index: entityIndex,
        entrance: previous,
      },
    };
  }
  assertStableIdentity(command.entranceId, command.entrance.id, "entrance.id");
  assertUniqueIds(project, entranceIds(command.entrance), "entrance", new Set(entranceIds(previous)));
  return {
    project: updateScene(project, sceneIndex, {
      ...scene,
      entrances: replaceAt(scene.entrances, entityIndex, command.entrance),
    }),
    inverse: {
      kind: "replace-entrance",
      sceneId: command.sceneId,
      entranceId: command.entranceId,
      entrance: previous,
    },
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
    case "insert-scene":
      assertUniqueIds(project, sceneIds(command.scene), "scene");
      return {
        project: {
          ...project,
          scenes: insertAt(project.scenes, command.index, command.scene, "index"),
        },
        inverse: { kind: "remove-scene", sceneId: command.scene.id },
      };
    case "remove-scene": {
      if (command.sceneId === project.startSceneId) {
        throw new ProjectEditorCommandError(
          "protected-entity",
          "sceneId",
          `Start scene '${command.sceneId}' cannot be removed.`,
        );
      }
      const { index, scene } = getScene(project, command.sceneId);
      return {
        project: { ...project, scenes: removeAt(project.scenes, index) },
        inverse: { kind: "insert-scene", index, scene },
      };
    }
    case "replace-scene": {
      const { index, scene: previous } = getScene(project, command.sceneId);
      assertStableIdentity(command.sceneId, command.scene.id, "scene.id");
      if (
        command.sceneId === project.startSceneId &&
        !command.scene.entrances.some((entrance) => entrance.id === project.startEntranceId)
      ) {
        throw new ProjectEditorCommandError(
          "protected-entity",
          "scene.entrances",
          `Start entrance '${project.startEntranceId}' must remain in the start scene.`,
        );
      }
      assertUniqueIds(project, sceneIds(command.scene), "scene", new Set(sceneIds(previous)));
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
    case "remove-navigation-area":
    case "replace-navigation-area":
      return applyNavigationArea(project, command);
    case "insert-depth-band":
    case "remove-depth-band":
    case "replace-depth-band":
      return applyDepthBand(project, command);
    case "insert-hotspot":
    case "remove-hotspot":
    case "replace-hotspot":
      return applyHotspot(project, command);
    case "insert-entrance":
    case "remove-entrance":
    case "replace-entrance":
      return applyEntrance(project, command);
  }
};

export const createProjectEditorDocument = (project: AdventureProject): ProjectEditorDocumentState => {
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

export const isProjectEditorDocumentDirty = (document: ProjectEditorDocumentState): boolean =>
  canonicalProjectEditorJson(document.project) !== canonicalProjectEditorJson(document.savedProject);

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

export const createProjectEditorHistory = (project: AdventureProject): ProjectEditorHistoryState => ({
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
    undoStack: [...history.undoStack, { undo: applied.inverse, redo: cloneJson(command) }],
    redoStack: [],
  };
};

export const undoProjectEditorCommand = (history: ProjectEditorHistoryState): ProjectEditorHistoryState => {
  const entry = history.undoStack.at(-1);
  if (!entry) return history;
  const applied = applyToDocument(history.document, entry.undo);
  return {
    document: applied.document,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, entry],
  };
};

export const redoProjectEditorCommand = (history: ProjectEditorHistoryState): ProjectEditorHistoryState => {
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
