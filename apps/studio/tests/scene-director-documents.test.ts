import { describe, expect, it } from "vitest";
import {
  nightShiftDirectorInstances,
  nightShiftDirectorProject,
  nightShiftDirectorStaging,
} from "../src/night-shift-director-fixture.js";
import {
  applySceneDirectorDocumentEdit,
  commitSceneDirectorDocumentEdit,
  createSceneDirectorDocumentHistory,
  redoSceneDirectorDocumentEdit,
  SceneDirectorDocumentEditError,
  undoSceneDirectorDocumentEdit,
  validateSceneDirectorDocuments,
} from "../src/scene-director-documents.js";

const initial = () => ({
  project: nightShiftDirectorProject,
  sceneInstances: nightShiftDirectorInstances,
  staging: nightShiftDirectorStaging,
});

describe("Scene Director composite documents", () => {
  it("starts from a semantically valid linked document set", () => {
    expect(validateSceneDirectorDocuments(initial())).toEqual([]);
  });

  it("edits canonical navigation polygons in project.json while preserving valid composition", () => {
    const documents = applySceneDirectorDocumentEdit(initial(), {
      kind: "set-navigation-area-shape",
      sceneId: "scene.night-shift.station" as never,
      areaId: "navigation.night-shift.station.main" as never,
      shape: {
        points: [
          { x: 18, y: 121 },
          { x: 279, y: 117 },
          { x: 282, y: 191 },
          { x: 15, y: 193 },
        ],
      },
    });
    expect(
      documents.project.scenes[0]?.navigationAreas.find(
        (area) => area.id === "navigation.night-shift.station.main",
      )?.shape.points[0],
    ).toEqual({ x: 18, y: 121 });
    expect(documents.sceneInstances).toBe(initial().sceneInstances);
  });

  it("rejects navigation edits that strand a walkable actor or portal endpoint", () => {
    expect(() =>
      applySceneDirectorDocumentEdit(initial(), {
        kind: "set-navigation-area-shape",
        sceneId: "scene.night-shift.station" as never,
        areaId: "navigation.night-shift.station.main" as never,
        shape: {
          points: [
            { x: 180, y: 120 },
            { x: 250, y: 120 },
            { x: 250, y: 160 },
            { x: 180, y: 160 },
          ],
        },
      }),
    ).toThrow(SceneDirectorDocumentEditError);
  });

  it("rejects self-intersecting canonical navigation polygons before schema export", () => {
    expect(() =>
      applySceneDirectorDocumentEdit(initial(), {
        kind: "set-navigation-area-shape",
        sceneId: "scene.night-shift.station" as never,
        areaId: "navigation.night-shift.station.main" as never,
        shape: {
          points: [
            { x: 20, y: 120 },
            { x: 280, y: 190 },
            { x: 20, y: 190 },
            { x: 280, y: 120 },
          ],
        },
      }),
    ).toThrow(/self-intersects/u);
  });

  it("revalidates staging semantics after staging edits, not only Zod shape", () => {
    expect(() =>
      applySceneDirectorDocumentEdit(initial(), {
        kind: "move-approach-slot",
        sceneId: "scene.night-shift.station" as never,
        objectId: "object.night-shift.radio" as never,
        slotId: "approach-slot.night-shift.radio.front" as never,
        position: { x: 5, y: 5 },
      }),
    ).toThrow(/staging/u);
  });

  it("moves canonical navigation portal endpoints only when semantic validation remains valid", () => {
    const documents = applySceneDirectorDocumentEdit(initial(), {
      kind: "set-navigation-portal-endpoint",
      sceneId: "scene.night-shift.station" as never,
      portalId: "navigation-portal.night-shift.station.threshold" as never,
      endpoint: "from",
      position: { x: 268, y: 150 },
    });
    expect(documents.sceneInstances.scenes[0]?.navigationPortals[0]?.fromPoint).toEqual({
      x: 268,
      y: 150,
    });
  });

  it("edits exact object-state interaction polygons in scene-instances.json", () => {
    const documents = applySceneDirectorDocumentEdit(initial(), {
      kind: "set-object-state-interaction-shape",
      definitionId: "object-definition.night-shift.radio" as never,
      stateId: "object-state.night-shift.radio.rack" as never,
      shape: {
        points: [
          { x: -1, y: -1 },
          { x: 19, y: -1 },
          { x: 19, y: 15 },
          { x: -1, y: 15 },
        ],
      },
    });
    const radio = documents.sceneInstances.objectDefinitions.find(
      (definition) => definition.id === "object-definition.night-shift.radio",
    );
    expect(radio?.states.find((state) => state.id === "object-state.night-shift.radio.rack")?.interactionShape)
      .toMatchObject({ points: [{ x: -1, y: -1 }] });
  });

  it("rejects self-intersecting local hotspot polygons", () => {
    expect(() =>
      applySceneDirectorDocumentEdit(initial(), {
        kind: "set-object-state-interaction-shape",
        definitionId: "object-definition.night-shift.radio" as never,
        stateId: "object-state.night-shift.radio.rack" as never,
        shape: {
          points: [
            { x: 0, y: 0 },
            { x: 16, y: 14 },
            { x: 0, y: 14 },
            { x: 16, y: 0 },
          ],
        },
      }),
    ).toThrow(/self-intersects/u);
  });

  it("moves placed objects without changing their reusable object definitions", () => {
    const originalDefinitions = initial().sceneInstances.objectDefinitions;
    const documents = applySceneDirectorDocumentEdit(initial(), {
      kind: "set-object-instance-position",
      sceneId: "scene.night-shift.station" as never,
      objectId: "object.night-shift.radio" as never,
      position: { x: 122, y: 129 },
    });
    expect(
      documents.sceneInstances.scenes[0]?.objectInstances.find(
        (object) => object.id === "object.night-shift.radio",
      )?.position,
    ).toEqual({ x: 122, y: 129 });
    expect(documents.sceneInstances.objectDefinitions).toEqual(originalDefinitions);
  });

  it("shares one undo/redo history across project, scene-instance and staging edits", () => {
    let history = createSceneDirectorDocumentHistory(initial());
    history = commitSceneDirectorDocumentEdit(history, {
      kind: "set-object-instance-position",
      sceneId: "scene.night-shift.station" as never,
      objectId: "object.night-shift.radio" as never,
      position: { x: 122, y: 129 },
    });
    history = commitSceneDirectorDocumentEdit(history, {
      kind: "move-approach-slot",
      sceneId: "scene.night-shift.station" as never,
      objectId: "object.night-shift.radio" as never,
      slotId: "approach-slot.night-shift.radio.front" as never,
      position: { x: 98, y: 151 },
    });
    expect(history.past).toHaveLength(2);
    history = undoSceneDirectorDocumentEdit(history);
    expect(
      history.present.staging.scenes[0]?.approachSlotsByObject["object.night-shift.radio"]?.[0]?.position,
    ).toEqual({ x: 94, y: 149 });
    history = undoSceneDirectorDocumentEdit(history);
    expect(
      history.present.sceneInstances.scenes[0]?.objectInstances.find(
        (object) => object.id === "object.night-shift.radio",
      )?.position,
    ).toEqual({ x: 118, y: 127 });
    history = redoSceneDirectorDocumentEdit(history);
    expect(
      history.present.sceneInstances.scenes[0]?.objectInstances.find(
        (object) => object.id === "object.night-shift.radio",
      )?.position,
    ).toEqual({ x: 122, y: 129 });
  });
});
