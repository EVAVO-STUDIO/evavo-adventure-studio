import {
  type AdventureProject,
  type Id,
  type Point,
  type Polygon,
  parseAdventureProject,
} from "@evavo/adventure-project-schema";
import {
  type SceneInstanceManifest,
  parseSceneInstanceManifest,
  validateSceneInstanceManifest,
} from "@evavo/adventure-scene-instances";
import type { SceneStagingManifest } from "@evavo/adventure-scene-instances/staging";
import {
  applySceneDirectorEdit,
  type SceneDirectorEditCommand,
  SceneDirectorEditError,
} from "./scene-director-edit.js";

export interface SceneDirectorDocuments {
  readonly project: AdventureProject;
  readonly sceneInstances: SceneInstanceManifest;
  readonly staging: SceneStagingManifest;
}

export type SceneDirectorDocumentCommand =
  | SceneDirectorEditCommand
  | {
      readonly kind: "set-navigation-area-shape";
      readonly sceneId: Id<"scene">;
      readonly areaId: Id<"navigation-area">;
      readonly shape: Polygon;
    }
  | {
      readonly kind: "set-entrance-position";
      readonly sceneId: Id<"scene">;
      readonly entranceId: Id<"entrance">;
      readonly position: Point;
    }
  | {
      readonly kind: "set-navigation-portal-endpoint";
      readonly sceneId: Id<"scene">;
      readonly portalId: Id<"navigation-portal">;
      readonly endpoint: "from" | "to";
      readonly position: Point;
    }
  | {
      readonly kind: "set-object-state-interaction-shape";
      readonly definitionId: Id<"object-definition">;
      readonly stateId: Id<"object-state">;
      readonly shape: Polygon;
    }
  | {
      readonly kind: "set-object-instance-position";
      readonly sceneId: Id<"scene">;
      readonly objectId: Id<"object">;
      readonly position: Point;
    };

const stagingKinds = new Set<SceneDirectorEditCommand["kind"]>([
  "set-actor-footprint",
  "set-walk-lane-points",
  "move-approach-slot",
  "set-depth-key",
  "set-occlusion-baseline",
  "set-light-zone-shape",
  "set-surface-zone-shape",
  "set-entry-path",
]);

const isStagingCommand = (
  command: SceneDirectorDocumentCommand,
): command is SceneDirectorEditCommand => stagingKinds.has(command.kind as SceneDirectorEditCommand["kind"]);

export class SceneDirectorDocumentEditError extends Error {
  readonly command: SceneDirectorDocumentCommand;

  constructor(command: SceneDirectorDocumentCommand, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SceneDirectorDocumentEditError";
    this.command = command;
  }
}

const finitePoint = (point: Point): boolean => Number.isFinite(point.x) && Number.isFinite(point.y);

const assertNativePoint = (
  command: SceneDirectorDocumentCommand,
  point: Point,
  width: number,
  height: number,
  label: string,
): void => {
  if (!finitePoint(point) || point.x < 0 || point.y < 0 || point.x > width || point.y > height) {
    throw new SceneDirectorDocumentEditError(
      command,
      `${label} (${point.x}, ${point.y}) must remain inside 0..${width} × 0..${height}.`,
    );
  }
};

const polygonArea = (shape: Polygon): number => {
  let total = 0;
  for (let index = 0; index < shape.points.length; index += 1) {
    const current = shape.points[index];
    const next = shape.points[(index + 1) % shape.points.length];
    if (current && next) total += current.x * next.y - next.x * current.y;
  }
  return Math.abs(total / 2);
};

const assertNativePolygon = (
  command: SceneDirectorDocumentCommand,
  shape: Polygon,
  width: number,
  height: number,
  label: string,
): void => {
  if (shape.points.length < 3 || polygonArea(shape) <= 0.0001) {
    throw new SceneDirectorDocumentEditError(command, `${label} must contain a non-degenerate polygon.`);
  }
  for (const point of shape.points) assertNativePoint(command, point, width, height, label);
};

const assertLocalPolygon = (
  command: SceneDirectorDocumentCommand,
  shape: Polygon,
  label: string,
): void => {
  if (shape.points.length < 3 || polygonArea(shape) <= 0.0001) {
    throw new SceneDirectorDocumentEditError(command, `${label} must contain a non-degenerate polygon.`);
  }
  if (!shape.points.every(finitePoint)) {
    throw new SceneDirectorDocumentEditError(command, `${label} must contain finite local coordinates.`);
  }
};

const sceneById = (project: AdventureProject, sceneId: Id<"scene">) => {
  const sceneIndex = project.scenes.findIndex((scene) => scene.id === sceneId);
  const scene = project.scenes[sceneIndex];
  if (!scene) {
    throw new SceneDirectorDocumentEditError(
      { kind: "set-entrance-position", sceneId, entranceId: "unknown" as never, position: { x: 0, y: 0 } },
      `Scene '${sceneId}' was not found.`,
    );
  }
  return { scene, sceneIndex };
};

const validateSceneInstancesAgainstProject = (
  command: SceneDirectorDocumentCommand,
  project: AdventureProject,
  sceneInstances: SceneInstanceManifest,
): void => {
  const issues = validateSceneInstanceManifest(
    {
      projectId: project.id,
      scenes: project.scenes,
      actors: project.actors,
      assets: project.assets,
      inventoryItems: project.inventoryItems,
      dialogues: project.dialogues,
      sequences: project.sequences,
    },
    sceneInstances,
  );
  if (issues.length > 0) {
    throw new SceneDirectorDocumentEditError(
      command,
      `Director edit would create ${issues.length} invalid scene-instance reference(s): ${issues[0]?.message ?? "unknown issue"}`,
    );
  }
};

const parseProjectEdit = (
  command: SceneDirectorDocumentCommand,
  input: unknown,
): AdventureProject => {
  try {
    return parseAdventureProject(input);
  } catch (error) {
    throw new SceneDirectorDocumentEditError(command, `Director edit would create invalid project data.`, {
      cause: error,
    });
  }
};

const parseInstanceEdit = (
  command: SceneDirectorDocumentCommand,
  input: unknown,
): SceneInstanceManifest => {
  try {
    return parseSceneInstanceManifest(input);
  } catch (error) {
    throw new SceneDirectorDocumentEditError(
      command,
      `Director edit would create invalid scene-instance data.`,
      { cause: error },
    );
  }
};

export const applySceneDirectorDocumentEdit = (
  documents: SceneDirectorDocuments,
  command: SceneDirectorDocumentCommand,
): SceneDirectorDocuments => {
  if (isStagingCommand(command)) {
    try {
      return {
        ...documents,
        staging: applySceneDirectorEdit(documents.project, documents.staging, command),
      };
    } catch (error) {
      if (error instanceof SceneDirectorEditError) {
        throw new SceneDirectorDocumentEditError(command, error.message, { cause: error });
      }
      throw error;
    }
  }

  switch (command.kind) {
    case "set-navigation-area-shape": {
      const { scene, sceneIndex } = sceneById(documents.project, command.sceneId);
      assertNativePolygon(command, command.shape, scene.width, scene.height, "Navigation area");
      const areaIndex = scene.navigationAreas.findIndex((area) => area.id === command.areaId);
      const area = scene.navigationAreas[areaIndex];
      if (!area) {
        throw new SceneDirectorDocumentEditError(command, `Navigation area '${command.areaId}' was not found.`);
      }
      const project = parseProjectEdit(documents.project, {
        ...documents.project,
        scenes: documents.project.scenes.map((candidate, index) =>
          index === sceneIndex
            ? {
                ...scene,
                navigationAreas: scene.navigationAreas.map((candidateArea, candidateIndex) =>
                  candidateIndex === areaIndex ? { ...area, shape: command.shape } : candidateArea,
                ),
              }
            : candidate,
        ),
      });
      validateSceneInstancesAgainstProject(command, project, documents.sceneInstances);
      return { ...documents, project };
    }

    case "set-entrance-position": {
      const { scene, sceneIndex } = sceneById(documents.project, command.sceneId);
      assertNativePoint(command, command.position, scene.width, scene.height, "Entrance position");
      const entranceIndex = scene.entrances.findIndex((entrance) => entrance.id === command.entranceId);
      const entrance = scene.entrances[entranceIndex];
      if (!entrance) {
        throw new SceneDirectorDocumentEditError(command, `Entrance '${command.entranceId}' was not found.`);
      }
      const project = parseProjectEdit(documents.project, {
        ...documents.project,
        scenes: documents.project.scenes.map((candidate, index) =>
          index === sceneIndex
            ? {
                ...scene,
                entrances: scene.entrances.map((candidateEntrance, candidateIndex) =>
                  candidateIndex === entranceIndex
                    ? { ...entrance, position: command.position }
                    : candidateEntrance,
                ),
              }
            : candidate,
        ),
      });
      validateSceneInstancesAgainstProject(command, project, documents.sceneInstances);
      return { ...documents, project };
    }

    case "set-navigation-portal-endpoint": {
      const { scene } = sceneById(documents.project, command.sceneId);
      assertNativePoint(command, command.position, scene.width, scene.height, "Portal endpoint");
      const compositionIndex = documents.sceneInstances.scenes.findIndex(
        (composition) => composition.sceneId === command.sceneId,
      );
      const composition = documents.sceneInstances.scenes[compositionIndex];
      if (!composition) {
        throw new SceneDirectorDocumentEditError(command, `Scene '${command.sceneId}' has no composition.`);
      }
      const portalIndex = composition.navigationPortals.findIndex((portal) => portal.id === command.portalId);
      const portal = composition.navigationPortals[portalIndex];
      if (!portal) {
        throw new SceneDirectorDocumentEditError(command, `Portal '${command.portalId}' was not found.`);
      }
      const sceneInstances = parseInstanceEdit(command, {
        ...documents.sceneInstances,
        scenes: documents.sceneInstances.scenes.map((candidate, index) =>
          index === compositionIndex
            ? {
                ...composition,
                navigationPortals: composition.navigationPortals.map((candidatePortal, candidateIndex) =>
                  candidateIndex === portalIndex
                    ? {
                        ...portal,
                        ...(command.endpoint === "from"
                          ? { fromPoint: command.position }
                          : { toPoint: command.position }),
                      }
                    : candidatePortal,
                ),
              }
            : candidate,
        ),
      });
      validateSceneInstancesAgainstProject(command, documents.project, sceneInstances);
      return { ...documents, sceneInstances };
    }

    case "set-object-state-interaction-shape": {
      assertLocalPolygon(command, command.shape, "Object interaction shape");
      const definitionIndex = documents.sceneInstances.objectDefinitions.findIndex(
        (definition) => definition.id === command.definitionId,
      );
      const definition = documents.sceneInstances.objectDefinitions[definitionIndex];
      if (!definition) {
        throw new SceneDirectorDocumentEditError(
          command,
          `Object definition '${command.definitionId}' was not found.`,
        );
      }
      const stateIndex = definition.states.findIndex((state) => state.id === command.stateId);
      const state = definition.states[stateIndex];
      if (!state) {
        throw new SceneDirectorDocumentEditError(command, `Object state '${command.stateId}' was not found.`);
      }
      const sceneInstances = parseInstanceEdit(command, {
        ...documents.sceneInstances,
        objectDefinitions: documents.sceneInstances.objectDefinitions.map((candidate, index) =>
          index === definitionIndex
            ? {
                ...definition,
                states: definition.states.map((candidateState, candidateIndex) =>
                  candidateIndex === stateIndex
                    ? { ...state, interactionShape: command.shape }
                    : candidateState,
                ),
              }
            : candidate,
        ),
      });
      validateSceneInstancesAgainstProject(command, documents.project, sceneInstances);
      return { ...documents, sceneInstances };
    }

    case "set-object-instance-position": {
      const { scene } = sceneById(documents.project, command.sceneId);
      assertNativePoint(command, command.position, scene.width, scene.height, "Object position");
      const compositionIndex = documents.sceneInstances.scenes.findIndex(
        (composition) => composition.sceneId === command.sceneId,
      );
      const composition = documents.sceneInstances.scenes[compositionIndex];
      if (!composition) {
        throw new SceneDirectorDocumentEditError(command, `Scene '${command.sceneId}' has no composition.`);
      }
      const objectIndex = composition.objectInstances.findIndex((object) => object.id === command.objectId);
      const object = composition.objectInstances[objectIndex];
      if (!object) {
        throw new SceneDirectorDocumentEditError(command, `Object '${command.objectId}' was not found.`);
      }
      const sceneInstances = parseInstanceEdit(command, {
        ...documents.sceneInstances,
        scenes: documents.sceneInstances.scenes.map((candidate, index) =>
          index === compositionIndex
            ? {
                ...composition,
                objectInstances: composition.objectInstances.map((candidateObject, candidateIndex) =>
                  candidateIndex === objectIndex
                    ? { ...object, position: command.position }
                    : candidateObject,
                ),
              }
            : candidate,
        ),
      });
      validateSceneInstancesAgainstProject(command, documents.project, sceneInstances);
      return { ...documents, sceneInstances };
    }
  }
};

export interface SceneDirectorDocumentHistory {
  readonly past: readonly SceneDirectorDocuments[];
  readonly present: SceneDirectorDocuments;
  readonly future: readonly SceneDirectorDocuments[];
}

export const createSceneDirectorDocumentHistory = (
  documents: SceneDirectorDocuments,
): SceneDirectorDocumentHistory => ({ past: [], present: documents, future: [] });

export const commitSceneDirectorDocumentEdit = (
  history: SceneDirectorDocumentHistory,
  command: SceneDirectorDocumentCommand,
): SceneDirectorDocumentHistory => ({
  past: [...history.past, history.present],
  present: applySceneDirectorDocumentEdit(history.present, command),
  future: [],
});

export const undoSceneDirectorDocumentEdit = (
  history: SceneDirectorDocumentHistory,
): SceneDirectorDocumentHistory => {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
};

export const redoSceneDirectorDocumentEdit = (
  history: SceneDirectorDocumentHistory,
): SceneDirectorDocumentHistory => {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
};
