import {
  createEditorHistory,
  executeEditorCommand,
  isEditorDocumentDirty,
  markEditorHistorySaved,
  redoEditorCommand,
  undoEditorCommand,
  type EditorCommand,
  type EditorHistoryState,
} from "@evavo/adventure-editor-core";
import type {
  Actor,
  AdventureProject,
  Id,
  Point,
  Scene,
} from "@evavo/adventure-project-schema";
import type {
  ObjectDefinition,
  SceneActorInstance,
  SceneComposition,
  SceneInstanceManifest,
  SceneNavigationPortal,
  SceneObjectInstance,
} from "@evavo/adventure-scene-instances";

export type WorkspaceSelection =
  | { readonly kind: "actor"; readonly id: Id<"actor-instance"> }
  | { readonly kind: "object"; readonly id: Id<"object"> }
  | { readonly kind: "portal"; readonly id: Id<"navigation-portal"> }
  | null;

export interface WorkspaceViewOptions {
  readonly showGrid: boolean;
  readonly showNavigation: boolean;
  readonly showPortals: boolean;
  readonly zoom: number;
}

export interface StudioWorkspaceState {
  readonly project: AdventureProject;
  readonly history: EditorHistoryState;
  readonly activeSceneId: Id<"scene">;
  readonly selection: WorkspaceSelection;
  readonly view: WorkspaceViewOptions;
  readonly notice: string | null;
}

export type StudioWorkspaceAction =
  | { readonly type: "select-scene"; readonly sceneId: Id<"scene"> }
  | { readonly type: "select"; readonly selection: WorkspaceSelection }
  | {
      readonly type: "execute";
      readonly command: EditorCommand;
      readonly selection?: WorkspaceSelection;
      readonly notice?: string;
    }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "mark-saved" }
  | { readonly type: "replace-manifest"; readonly manifest: SceneInstanceManifest }
  | { readonly type: "toggle-grid" }
  | { readonly type: "toggle-navigation" }
  | { readonly type: "toggle-portals" }
  | { readonly type: "set-zoom"; readonly zoom: number }
  | { readonly type: "clear-notice" };

const asId = <T extends string>(value: string): Id<T> => value as Id<T>;

const firstSceneId = (project: AdventureProject): Id<"scene"> => {
  const scene = project.scenes[0];
  if (!scene) {
    throw new Error("Adventure projects require at least one scene.");
  }
  return scene.id;
};

export const createStudioWorkspace = (
  project: AdventureProject,
  manifest: SceneInstanceManifest,
): StudioWorkspaceState => ({
  project,
  history: createEditorHistory(manifest),
  activeSceneId: project.startSceneId ?? firstSceneId(project),
  selection: null,
  view: {
    showGrid: true,
    showNavigation: true,
    showPortals: true,
    zoom: 1,
  },
  notice: null,
});

export const studioWorkspaceReducer = (
  state: StudioWorkspaceState,
  action: StudioWorkspaceAction,
): StudioWorkspaceState => {
  switch (action.type) {
    case "select-scene":
      return {
        ...state,
        activeSceneId: action.sceneId,
        selection: null,
        notice: null,
      };
    case "select":
      return { ...state, selection: action.selection, notice: null };
    case "execute":
      return {
        ...state,
        history: executeEditorCommand(state.history, action.command),
        selection: action.selection ?? state.selection,
        notice: action.notice ?? null,
      };
    case "undo":
      return {
        ...state,
        history: undoEditorCommand(state.history),
        selection: null,
        notice: "Undid the last scene edit.",
      };
    case "redo":
      return {
        ...state,
        history: redoEditorCommand(state.history),
        selection: null,
        notice: "Redid the scene edit.",
      };
    case "mark-saved":
      return {
        ...state,
        history: markEditorHistorySaved(state.history),
        notice: "Scene composition marked as saved.",
      };
    case "replace-manifest":
      return {
        ...state,
        history: createEditorHistory(action.manifest),
        selection: null,
        notice: "Opened scene composition manifest.",
      };
    case "toggle-grid":
      return {
        ...state,
        view: { ...state.view, showGrid: !state.view.showGrid },
      };
    case "toggle-navigation":
      return {
        ...state,
        view: {
          ...state.view,
          showNavigation: !state.view.showNavigation,
        },
      };
    case "toggle-portals":
      return {
        ...state,
        view: { ...state.view, showPortals: !state.view.showPortals },
      };
    case "set-zoom":
      return {
        ...state,
        view: {
          ...state.view,
          zoom: Math.min(3, Math.max(0.5, action.zoom)),
        },
      };
    case "clear-notice":
      return { ...state, notice: null };
  }
};

export const workspaceIsDirty = (state: StudioWorkspaceState): boolean =>
  isEditorDocumentDirty(state.history.document);

export const activeProjectScene = (state: StudioWorkspaceState): Scene => {
  const scene = state.project.scenes.find(
    (candidate) => candidate.id === state.activeSceneId,
  );
  if (!scene) {
    throw new Error(`Scene '${state.activeSceneId}' does not exist.`);
  }
  return scene;
};

export const activeSceneComposition = (
  state: StudioWorkspaceState,
): SceneComposition => {
  const composition = state.history.document.manifest.scenes.find(
    (candidate) => candidate.sceneId === state.activeSceneId,
  );
  return (
    composition ?? {
      sceneId: state.activeSceneId,
      actorInstances: [],
      objectInstances: [],
      navigationPortals: [],
    }
  );
};

export type SelectedEntity =
  | { readonly kind: "actor"; readonly value: SceneActorInstance }
  | { readonly kind: "object"; readonly value: SceneObjectInstance }
  | { readonly kind: "portal"; readonly value: SceneNavigationPortal }
  | null;

export const selectedEntity = (state: StudioWorkspaceState): SelectedEntity => {
  const selection = state.selection;
  if (!selection) {
    return null;
  }
  const composition = activeSceneComposition(state);
  switch (selection.kind) {
    case "actor": {
      const value = composition.actorInstances.find(
        (candidate) => candidate.id === selection.id,
      );
      return value ? { kind: "actor", value } : null;
    }
    case "object": {
      const value = composition.objectInstances.find(
        (candidate) => candidate.id === selection.id,
      );
      return value ? { kind: "object", value } : null;
    }
    case "portal": {
      const value = composition.navigationPortals.find(
        (candidate) => candidate.id === selection.id,
      );
      return value ? { kind: "portal", value } : null;
    }
  }
};

const clampPoint = (scene: Scene, point: Point): Point => ({
  x: Math.min(scene.width - 1, Math.max(0, Math.round(point.x))),
  y: Math.min(scene.height - 1, Math.max(0, Math.round(point.y))),
});

export const replaceSelectedPositionCommand = (
  state: StudioWorkspaceState,
  position: Point,
): EditorCommand | null => {
  const entity = selectedEntity(state);
  if (!entity) {
    return null;
  }
  const nextPosition = clampPoint(activeProjectScene(state), position);
  switch (entity.kind) {
    case "actor":
      return {
        kind: "replace-actor-instance",
        sceneId: state.activeSceneId,
        instanceId: entity.value.id,
        instance: { ...entity.value, position: nextPosition },
      };
    case "object":
      return {
        kind: "replace-object-instance",
        sceneId: state.activeSceneId,
        instanceId: entity.value.id,
        instance: { ...entity.value, position: nextPosition },
      };
    case "portal":
      return null;
  }
};

const uniqueId = (
  existing: ReadonlySet<string>,
  prefix: string,
): string => {
  let index = 1;
  while (existing.has(`${prefix}-${index}`)) {
    index += 1;
  }
  return `${prefix}-${index}`;
};

const manifestIds = (manifest: SceneInstanceManifest): ReadonlySet<string> => {
  const ids = new Set<string>();
  for (const definition of manifest.objectDefinitions) {
    ids.add(definition.id);
    for (const objectState of definition.states) {
      ids.add(objectState.id);
      for (const interaction of objectState.interactions) {
        ids.add(interaction.id);
      }
    }
  }
  for (const scene of manifest.scenes) {
    ids.add(scene.sceneId);
    for (const actor of scene.actorInstances) ids.add(actor.id);
    for (const object of scene.objectInstances) ids.add(object.id);
    for (const portal of scene.navigationPortals) ids.add(portal.id);
  }
  return ids;
};

const firstActor = (project: AdventureProject): Actor => {
  const actor = project.actors[0];
  if (!actor) {
    throw new Error("Add an actor definition before placing an actor instance.");
  }
  return actor;
};

const firstDefinition = (manifest: SceneInstanceManifest): ObjectDefinition => {
  const definition = manifest.objectDefinitions[0];
  if (!definition) {
    throw new Error("Add an object definition before placing an object instance.");
  }
  return definition;
};

export const insertActorCommand = (
  state: StudioWorkspaceState,
): { readonly command: EditorCommand; readonly selection: WorkspaceSelection } => {
  const manifest = state.history.document.manifest;
  const actor = firstActor(state.project);
  const animation = actor.animations[0];
  if (!animation) {
    throw new Error(`Actor '${actor.id}' has no animations.`);
  }
  const id = asId<"actor-instance">(
    uniqueId(manifestIds(manifest), `actor-instance.${state.activeSceneId}`),
  );
  const composition = activeSceneComposition(state);
  const instance: SceneActorInstance = {
    id,
    actorId: actor.id,
    position: { x: 160, y: 160 },
    facing: animation.facing,
    animationState: animation.state,
    mobility: "walkable",
    elevation: 0,
    zOffset: 0,
    scaleMultiplier: 1,
  };
  return {
    command: {
      kind: "insert-actor-instance",
      sceneId: state.activeSceneId,
      index: composition.actorInstances.length,
      instance,
    },
    selection: { kind: "actor", id },
  };
};

export const insertObjectCommand = (
  state: StudioWorkspaceState,
): { readonly command: EditorCommand; readonly selection: WorkspaceSelection } => {
  const manifest = state.history.document.manifest;
  const definition = firstDefinition(manifest);
  const id = asId<"object">(
    uniqueId(manifestIds(manifest), `object.${state.activeSceneId}`),
  );
  const composition = activeSceneComposition(state);
  const instance: SceneObjectInstance = {
    id,
    definitionId: definition.id,
    position: { x: 160, y: 140 },
    layer: "world",
    elevation: 0,
    zOffset: 0,
    scaleMultiplier: 1,
    mirrored: false,
  };
  return {
    command: {
      kind: "insert-object-instance",
      sceneId: state.activeSceneId,
      index: composition.objectInstances.length,
      instance,
    },
    selection: { kind: "object", id },
  };
};

export const deleteSelectionCommand = (
  state: StudioWorkspaceState,
): EditorCommand | null => {
  const selection = state.selection;
  if (!selection) {
    return null;
  }
  switch (selection.kind) {
    case "actor":
      return {
        kind: "remove-actor-instance",
        sceneId: state.activeSceneId,
        instanceId: selection.id,
      };
    case "object":
      return {
        kind: "remove-object-instance",
        sceneId: state.activeSceneId,
        instanceId: selection.id,
      };
    case "portal":
      return {
        kind: "remove-navigation-portal",
        sceneId: state.activeSceneId,
        portalId: selection.id,
      };
  }
};

export const selectionTitle = (state: StudioWorkspaceState): string => {
  const entity = selectedEntity(state);
  if (!entity) {
    return activeProjectScene(state).name;
  }
  switch (entity.kind) {
    case "actor": {
      const actor = state.project.actors.find(
        (candidate) => candidate.id === entity.value.actorId,
      );
      return actor?.name ?? entity.value.id;
    }
    case "object": {
      const definition = state.history.document.manifest.objectDefinitions.find(
        (candidate) => candidate.id === entity.value.definitionId,
      );
      return definition?.name ?? entity.value.id;
    }
    case "portal":
      return entity.value.id;
  }
};
