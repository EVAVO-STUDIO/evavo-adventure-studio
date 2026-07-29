import {
  createProjectEditorHistory,
  executeProjectEditorCommand,
  isProjectEditorDocumentDirty,
  markProjectEditorHistorySaved,
  redoProjectEditorCommand,
  undoProjectEditorCommand,
  type ProjectEditorCommand,
  type ProjectEditorHistoryState,
} from "@evavo/adventure-project-editor-core";
import type {
  AdventureProject,
  DepthBand,
  Entrance,
  Hotspot,
  Id,
  NavigationArea,
  Point,
  Scene,
} from "@evavo/adventure-project-schema";

export type GeometryTool = "walkmesh" | "depth" | "hotspots" | "entrances";

export type GeometrySelection =
  | { readonly kind: "navigation-area"; readonly id: Id<"navigation-area"> }
  | { readonly kind: "depth-band"; readonly id: Id<"depth-band"> }
  | { readonly kind: "hotspot"; readonly id: Id<"hotspot"> }
  | { readonly kind: "entrance"; readonly id: Id<"entrance"> }
  | null;

export interface GeometryWorkspaceState {
  readonly history: ProjectEditorHistoryState;
  readonly activeSceneId: Id<"scene">;
  readonly tool: GeometryTool;
  readonly selection: GeometrySelection;
  readonly zoom: number;
  readonly showGrid: boolean;
  readonly notice: string | null;
}

export type GeometryWorkspaceAction =
  | { readonly type: "select-scene"; readonly sceneId: Id<"scene"> }
  | { readonly type: "select"; readonly selection: GeometrySelection }
  | { readonly type: "set-tool"; readonly tool: GeometryTool }
  | {
      readonly type: "execute";
      readonly command: ProjectEditorCommand;
      readonly selection?: GeometrySelection;
      readonly notice?: string;
    }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "mark-saved" }
  | { readonly type: "toggle-grid" }
  | { readonly type: "set-zoom"; readonly zoom: number };

const asId = <T extends string>(value: string): Id<T> => value as Id<T>;

export const createGeometryWorkspace = (
  project: AdventureProject,
): GeometryWorkspaceState => ({
  history: createProjectEditorHistory(project),
  activeSceneId: project.startSceneId,
  tool: "walkmesh",
  selection: null,
  zoom: 1,
  showGrid: true,
  notice: null,
});

export const geometryWorkspaceReducer = (
  state: GeometryWorkspaceState,
  action: GeometryWorkspaceAction,
): GeometryWorkspaceState => {
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
    case "set-tool":
      return { ...state, tool: action.tool, selection: null, notice: null };
    case "execute":
      return {
        ...state,
        history: executeProjectEditorCommand(state.history, action.command),
        selection:
          action.selection === undefined ? state.selection : action.selection,
        notice: action.notice ?? null,
      };
    case "undo":
      return {
        ...state,
        history: undoProjectEditorCommand(state.history),
        selection: null,
        notice: "Undid the last project geometry edit.",
      };
    case "redo":
      return {
        ...state,
        history: redoProjectEditorCommand(state.history),
        selection: null,
        notice: "Redid the project geometry edit.",
      };
    case "mark-saved":
      return {
        ...state,
        history: markProjectEditorHistorySaved(state.history),
        notice: "Project document marked as saved.",
      };
    case "toggle-grid":
      return { ...state, showGrid: !state.showGrid };
    case "set-zoom":
      return { ...state, zoom: Math.min(3, Math.max(0.5, action.zoom)) };
  }
};

export const geometryProject = (
  state: GeometryWorkspaceState,
): AdventureProject => state.history.document.project;

export const geometryScene = (state: GeometryWorkspaceState): Scene => {
  const scene = geometryProject(state).scenes.find(
    (candidate) => candidate.id === state.activeSceneId,
  );
  if (!scene) {
    throw new Error(`Scene '${state.activeSceneId}' does not exist.`);
  }
  return scene;
};

export const geometryWorkspaceIsDirty = (
  state: GeometryWorkspaceState,
): boolean => isProjectEditorDocumentDirty(state.history.document);

export type SelectedGeometryEntity =
  | { readonly kind: "navigation-area"; readonly value: NavigationArea }
  | { readonly kind: "depth-band"; readonly value: DepthBand }
  | { readonly kind: "hotspot"; readonly value: Hotspot }
  | { readonly kind: "entrance"; readonly value: Entrance }
  | null;

export const selectedGeometryEntity = (
  state: GeometryWorkspaceState,
): SelectedGeometryEntity => {
  const selection = state.selection;
  if (!selection) {
    return null;
  }
  const scene = geometryScene(state);
  switch (selection.kind) {
    case "navigation-area": {
      const value = scene.navigationAreas.find(
        (candidate) => candidate.id === selection.id,
      );
      return value ? { kind: "navigation-area", value } : null;
    }
    case "depth-band": {
      const value = scene.depthBands.find(
        (candidate) => candidate.id === selection.id,
      );
      return value ? { kind: "depth-band", value } : null;
    }
    case "hotspot": {
      const value = scene.hotspots.find(
        (candidate) => candidate.id === selection.id,
      );
      return value ? { kind: "hotspot", value } : null;
    }
    case "entrance": {
      const value = scene.entrances.find(
        (candidate) => candidate.id === selection.id,
      );
      return value ? { kind: "entrance", value } : null;
    }
  }
};

const clampPoint = (scene: Scene, point: Point): Point => ({
  x: Math.min(scene.width - 1, Math.max(0, Math.round(point.x))),
  y: Math.min(scene.height - 1, Math.max(0, Math.round(point.y))),
});

export const replaceNavigationVertexCommand = (
  state: GeometryWorkspaceState,
  areaId: Id<"navigation-area">,
  vertexIndex: number,
  point: Point,
): ProjectEditorCommand => {
  const scene = geometryScene(state);
  const area = scene.navigationAreas.find((candidate) => candidate.id === areaId);
  if (!area) {
    throw new Error(`Navigation area '${areaId}' does not exist.`);
  }
  const vertex = area.shape.points[vertexIndex];
  if (!vertex) {
    throw new RangeError(
      `Navigation area '${areaId}' has no vertex ${vertexIndex}.`,
    );
  }
  const points = [...area.shape.points];
  points[vertexIndex] = clampPoint(scene, point);
  return {
    kind: "replace-navigation-area",
    sceneId: scene.id,
    areaId,
    area: { ...area, shape: { points } },
  };
};

export const replaceHotspotVertexCommand = (
  state: GeometryWorkspaceState,
  hotspotId: Id<"hotspot">,
  vertexIndex: number,
  point: Point,
): ProjectEditorCommand => {
  const scene = geometryScene(state);
  const hotspot = scene.hotspots.find(
    (candidate) => candidate.id === hotspotId,
  );
  if (!hotspot) {
    throw new Error(`Hotspot '${hotspotId}' does not exist.`);
  }
  const vertex = hotspot.shape.points[vertexIndex];
  if (!vertex) {
    throw new RangeError(`Hotspot '${hotspotId}' has no vertex ${vertexIndex}.`);
  }
  const points = [...hotspot.shape.points];
  points[vertexIndex] = clampPoint(scene, point);
  return {
    kind: "replace-hotspot",
    sceneId: scene.id,
    hotspotId,
    hotspot: { ...hotspot, shape: { points } },
  };
};

export const replaceEntrancePositionCommand = (
  state: GeometryWorkspaceState,
  entranceId: Id<"entrance">,
  point: Point,
): ProjectEditorCommand => {
  const scene = geometryScene(state);
  const entrance = scene.entrances.find(
    (candidate) => candidate.id === entranceId,
  );
  if (!entrance) {
    throw new Error(`Entrance '${entranceId}' does not exist.`);
  }
  return {
    kind: "replace-entrance",
    sceneId: scene.id,
    entranceId,
    entrance: { ...entrance, position: clampPoint(scene, point) },
  };
};

const projectIds = (project: AdventureProject): ReadonlySet<string> => {
  const ids = new Set<string>();
  for (const scene of project.scenes) {
    ids.add(scene.id);
    for (const area of scene.navigationAreas) ids.add(area.id);
    for (const band of scene.depthBands) ids.add(band.id);
    for (const hotspot of scene.hotspots) {
      ids.add(hotspot.id);
      for (const interaction of hotspot.interactions) ids.add(interaction.id);
    }
    for (const entrance of scene.entrances) ids.add(entrance.id);
  }
  return ids;
};

const uniqueId = (ids: ReadonlySet<string>, prefix: string): string => {
  let index = 1;
  while (ids.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
};

export const insertGeometryEntityCommand = (
  state: GeometryWorkspaceState,
): { readonly command: ProjectEditorCommand; readonly selection: GeometrySelection } => {
  const project = geometryProject(state);
  const scene = geometryScene(state);
  const ids = projectIds(project);
  switch (state.tool) {
    case "walkmesh": {
      const id = asId<"navigation-area">(
        uniqueId(ids, `navigation.${scene.id}.area`),
      );
      return {
        command: {
          kind: "insert-navigation-area",
          sceneId: scene.id,
          index: scene.navigationAreas.length,
          area: {
            id,
            shape: {
              points: [
                { x: 120, y: 125 },
                { x: 200, y: 125 },
                { x: 210, y: 180 },
                { x: 110, y: 180 },
              ],
            },
            elevation: 0,
          },
        },
        selection: { kind: "navigation-area", id },
      };
    }
    case "depth": {
      const id = asId<"depth-band">(uniqueId(ids, `depth.${scene.id}.band`));
      return {
        command: {
          kind: "insert-depth-band",
          sceneId: scene.id,
          index: scene.depthBands.length,
          band: {
            id,
            farY: Math.round(scene.height * 0.55),
            nearY: scene.height - 10,
            farScale: 0.7,
            nearScale: 1,
          },
        },
        selection: { kind: "depth-band", id },
      };
    }
    case "hotspots": {
      const id = asId<"hotspot">(
        uniqueId(ids, `hotspot.${scene.id}.target`),
      );
      const interactionId = asId<"interaction">(
        uniqueId(ids, `interaction.${scene.id}.target.look`),
      );
      return {
        command: {
          kind: "insert-hotspot",
          sceneId: scene.id,
          index: scene.hotspots.length,
          hotspot: {
            id,
            name: "New hotspot",
            shape: {
              points: [
                { x: 130, y: 90 },
                { x: 190, y: 90 },
                { x: 190, y: 140 },
                { x: 130, y: 140 },
              ],
            },
            interactions: [
              {
                id: interactionId,
                verb: "look",
                actions: [{ kind: "say", text: "Nothing unusual." }],
              },
            ],
          },
        },
        selection: { kind: "hotspot", id },
      };
    }
    case "entrances": {
      const id = asId<"entrance">(
        uniqueId(ids, `entrance.${scene.id}.entry`),
      );
      return {
        command: {
          kind: "insert-entrance",
          sceneId: scene.id,
          index: scene.entrances.length,
          entrance: {
            id,
            position: { x: 160, y: 170 },
            facing: "south",
          },
        },
        selection: { kind: "entrance", id },
      };
    }
  }
};

export const deleteGeometrySelectionCommand = (
  state: GeometryWorkspaceState,
): ProjectEditorCommand | null => {
  const selection = state.selection;
  if (!selection) return null;
  switch (selection.kind) {
    case "navigation-area":
      return {
        kind: "remove-navigation-area",
        sceneId: state.activeSceneId,
        areaId: selection.id,
      };
    case "depth-band":
      return {
        kind: "remove-depth-band",
        sceneId: state.activeSceneId,
        bandId: selection.id,
      };
    case "hotspot":
      return {
        kind: "remove-hotspot",
        sceneId: state.activeSceneId,
        hotspotId: selection.id,
      };
    case "entrance":
      return {
        kind: "remove-entrance",
        sceneId: state.activeSceneId,
        entranceId: selection.id,
      };
  }
};
