import { describe, expect, it } from "vitest";
import {
  nightShiftDirectorInstances,
  nightShiftDirectorProject,
  nightShiftDirectorStaging,
} from "../src/night-shift-director-fixture.js";
import { applySceneDirectorDocumentEdit } from "../src/scene-director-documents.js";
import {
  sceneDirectorProjectFileName,
  sceneDirectorSceneInstancesFileName,
  sceneDirectorStagingFileName,
  serializeSceneDirectorDocuments,
  serializeSceneDirectorStaging,
} from "../src/scene-director-export.js";

describe("Scene Director document export", () => {
  it("serializes schema-valid staging with a trailing newline", () => {
    const serialized = serializeSceneDirectorStaging(nightShiftDirectorStaging);
    expect(serialized.endsWith("\n")).toBe(true);
    expect(JSON.parse(serialized)).toMatchObject({
      manifestVersion: 1,
      projectId: nightShiftDirectorStaging.projectId,
    });
  });

  it("uses portable proof-specific filenames for all canonical documents", () => {
    expect(sceneDirectorProjectFileName("Night Shift / Proof")).toBe(
      "night-shift-proof.project.json",
    );
    expect(sceneDirectorSceneInstancesFileName("Night Shift / Proof")).toBe(
      "night-shift-proof.scene-instances.json",
    );
    expect(sceneDirectorStagingFileName("Night Shift / Proof")).toBe(
      "night-shift-proof.scene-staging.json",
    );
  });

  it("round-trips project, scene-instance and staging ownership separately", () => {
    let documents = {
      project: nightShiftDirectorProject,
      sceneInstances: nightShiftDirectorInstances,
      staging: nightShiftDirectorStaging,
    };
    documents = applySceneDirectorDocumentEdit(documents, {
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
    documents = applySceneDirectorDocumentEdit(documents, {
      kind: "set-object-instance-position",
      sceneId: "scene.night-shift.station" as never,
      objectId: "object.night-shift.radio" as never,
      position: { x: 122, y: 129 },
    });
    documents = applySceneDirectorDocumentEdit(documents, {
      kind: "move-approach-slot",
      sceneId: "scene.night-shift.station" as never,
      objectId: "object.night-shift.radio" as never,
      slotId: "approach-slot.night-shift.radio.front" as never,
      position: { x: 98, y: 151 },
    });

    const files = serializeSceneDirectorDocuments(documents, "night-shift");
    expect(files).toHaveLength(3);
    const project = JSON.parse(files.find((file) => file.fileName.endsWith(".project.json"))!.data);
    const instances = JSON.parse(
      files.find((file) => file.fileName.endsWith(".scene-instances.json"))!.data,
    );
    const staging = JSON.parse(
      files.find((file) => file.fileName.endsWith(".scene-staging.json"))!.data,
    );

    expect(project.id).toBe(nightShiftDirectorProject.id);
    expect(instances.projectId).toBe(nightShiftDirectorProject.id);
    expect(staging.projectId).toBe(nightShiftDirectorProject.id);
    expect(project.scenes[0].navigationAreas[0].shape.points[0]).toEqual({ x: 18, y: 121 });
    expect(instances.scenes[0].objectInstances[0].position).toEqual({ x: 122, y: 129 });
    expect(staging.scenes[0].approachSlotsByObject["object.night-shift.radio"][0].position).toEqual({
      x: 98,
      y: 151,
    });
  });
});
