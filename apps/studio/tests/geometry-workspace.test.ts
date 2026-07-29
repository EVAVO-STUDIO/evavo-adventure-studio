import { describe, expect, it } from "vitest";
import { ProjectEditorCommandError } from "@evavo/adventure-project-editor-core";
import { studioProject } from "../src/fixture.js";
import {
  createGeometryWorkspace,
  deleteGeometrySelectionCommand,
  geometryProject,
  geometryScene,
  geometryWorkspaceIsDirty,
  geometryWorkspaceReducer,
  insertGeometryEntityCommand,
  replaceNavigationVertexCommand,
} from "../src/geometry-workspace.js";

describe("project geometry workspace", () => {
  it("moves walkmesh vertices through project history", () => {
    let state = createGeometryWorkspace(studioProject);
    const area = geometryScene(state).navigationAreas[0];
    if (!area) throw new Error("Expected fixture navigation area.");

    state = geometryWorkspaceReducer(state, {
      type: "select",
      selection: { kind: "navigation-area", id: area.id },
    });
    state = geometryWorkspaceReducer(state, {
      type: "execute",
      command: replaceNavigationVertexCommand(state, area.id, 0, {
        x: 26.4,
        y: 124.7,
      }),
    });

    expect(geometryScene(state).navigationAreas[0]?.shape.points[0]).toEqual({
      x: 26,
      y: 125,
    });
    expect(geometryWorkspaceIsDirty(state)).toBe(true);

    state = geometryWorkspaceReducer(state, { type: "undo" });
    expect(geometryScene(state).navigationAreas[0]?.shape.points[0]).toEqual(
      area.shape.points[0],
    );
    expect(geometryWorkspaceIsDirty(state)).toBe(false);

    state = geometryWorkspaceReducer(state, { type: "redo" });
    expect(geometryScene(state).navigationAreas[0]?.shape.points[0]).toEqual({
      x: 26,
      y: 125,
    });
  });

  it("inserts geometry based on the active authoring tool", () => {
    let state = createGeometryWorkspace(studioProject);
    state = geometryWorkspaceReducer(state, { type: "set-tool", tool: "depth" });
    const addition = insertGeometryEntityCommand(state);
    state = geometryWorkspaceReducer(state, {
      type: "execute",
      command: addition.command,
      selection: addition.selection,
    });

    expect(geometryScene(state).depthBands).toHaveLength(2);
    expect(state.selection?.kind).toBe("depth-band");
    expect(geometryProject(state)).not.toBe(studioProject);
  });

  it("protects the start entrance through project-editor-core", () => {
    let state = createGeometryWorkspace(studioProject);
    state = geometryWorkspaceReducer(state, {
      type: "set-tool",
      tool: "entrances",
    });
    state = geometryWorkspaceReducer(state, {
      type: "select",
      selection: {
        kind: "entrance",
        id: studioProject.startEntranceId,
      },
    });
    const command = deleteGeometrySelectionCommand(state);
    if (!command) throw new Error("Expected entrance deletion command.");

    expect(() =>
      geometryWorkspaceReducer(state, { type: "execute", command }),
    ).toThrowError(
      expect.objectContaining<Partial<ProjectEditorCommandError>>({
        code: "protected-entity",
      }),
    );
  });

  it("switches scenes without losing project edits", () => {
    let state = createGeometryWorkspace(studioProject);
    const area = geometryScene(state).navigationAreas[0]!;
    state = geometryWorkspaceReducer(state, {
      type: "execute",
      command: replaceNavigationVertexCommand(state, area.id, 0, {
        x: 30,
        y: 126,
      }),
    });
    state = geometryWorkspaceReducer(state, {
      type: "select-scene",
      sceneId: studioProject.scenes[1]!.id,
    });

    expect(state.activeSceneId).toBe("scene.alley");
    expect(geometryProject(state).scenes[0]?.navigationAreas[0]?.shape.points[0]).toEqual({
      x: 30,
      y: 126,
    });
  });
});
