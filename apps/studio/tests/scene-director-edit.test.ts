import type { Id } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import {
  nightShiftDirectorProject,
  nightShiftDirectorStaging,
} from "../src/night-shift-director-fixture.js";
import {
  applySceneDirectorEdit,
  commitSceneDirectorEdit,
  createSceneDirectorEditHistory,
  redoSceneDirectorEdit,
  SceneDirectorEditError,
  undoSceneDirectorEdit,
} from "../src/scene-director-edit.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;
const stationId = id<"scene">("scene.night-shift.station");

const station = (manifest = nightShiftDirectorStaging) =>
  manifest.scenes.find((scene) => scene.sceneId === stationId)!;

describe("Scene Director immutable edit commands", () => {
  it("moves an approach slot without mutating the source staging manifest", () => {
    const original = station().approachSlotsByObject["object.night-shift.radio"]![0]!;
    const edited = applySceneDirectorEdit(nightShiftDirectorProject, nightShiftDirectorStaging, {
      kind: "move-approach-slot",
      sceneId: stationId,
      objectId: id<"object">("object.night-shift.radio"),
      slotId: id<"approach-slot">("approach-slot.night-shift.radio.front"),
      position: { x: 101, y: 153 },
      facing: "north",
    });

    expect(station(edited).approachSlotsByObject["object.night-shift.radio"]![0]).toMatchObject({
      position: { x: 101, y: 153 },
      facing: "north",
    });
    expect(original.position).toEqual({ x: 94, y: 149 });
    expect(station().approachSlotsByObject["object.night-shift.radio"]![0]?.position).toEqual({
      x: 94,
      y: 149,
    });
  });

  it("edits walk, depth, occlusion, light and entry contracts through the same schema-backed path", () => {
    let history = createSceneDirectorEditHistory(nightShiftDirectorStaging);
    history = commitSceneDirectorEdit(nightShiftDirectorProject, history, {
      kind: "set-walk-lane-points",
      sceneId: stationId,
      laneId: id<"preferred-walk-lane">("preferred-walk-lane.night-shift.station.duty-lane"),
      points: [
        { x: 50, y: 174 },
        { x: 130, y: 165 },
        { x: 210, y: 158 },
        { x: 269, y: 151 },
      ],
    });
    history = commitSceneDirectorEdit(nightShiftDirectorProject, history, {
      kind: "set-depth-key",
      sceneId: stationId,
      curveId: id<"depth-scale-curve">("depth-scale-curve.night-shift.station.floor"),
      keyIndex: 1,
      y: 138,
      scale: 0.8,
    });
    history = commitSceneDirectorEdit(nightShiftDirectorProject, history, {
      kind: "set-occlusion-baseline",
      sceneId: stationId,
      planeId: id<"occlusion-plane">("occlusion-plane.night-shift.station.desk-front"),
      baselineY: 156,
    });
    history = commitSceneDirectorEdit(nightShiftDirectorProject, history, {
      kind: "set-light-zone-shape",
      sceneId: stationId,
      zoneId: id<"palette-light-zone">("palette-light-zone.night-shift.station.fluorescent"),
      shape: {
        points: [
          { x: 72, y: 117 },
          { x: 248, y: 113 },
          { x: 267, y: 176 },
          { x: 55, y: 182 },
        ],
      },
    });
    history = commitSceneDirectorEdit(nightShiftDirectorProject, history, {
      kind: "set-entry-path",
      sceneId: stationId,
      entranceId: id<"entrance">("entrance.night-shift.station.front"),
      spawnPosition: { x: -12, y: 178 },
      entryPath: [
        { x: 18, y: 177 },
        { x: 35, y: 174 },
        { x: 50, y: 172 },
      ],
    });

    const edited = station(history.present);
    expect(edited.preferredWalkLanes[0]?.points[0]).toEqual({ x: 50, y: 174 });
    expect(edited.depthScaleCurves[0]?.keys[1]).toEqual({ y: 138, scale: 0.8 });
    expect(edited.occlusionPlanes[0]?.baselineY).toBe(156);
    expect(edited.paletteLightZones[0]?.shape.points[0]).toEqual({ x: 72, y: 117 });
    expect(edited.entryChoreographies[0]?.spawnPosition).toEqual({ x: -12, y: 178 });
    expect(history.past).toHaveLength(5);
  });

  it("undoes and redoes committed staging snapshots deterministically", () => {
    let history = createSceneDirectorEditHistory(nightShiftDirectorStaging);
    history = commitSceneDirectorEdit(nightShiftDirectorProject, history, {
      kind: "set-occlusion-baseline",
      sceneId: stationId,
      planeId: id<"occlusion-plane">("occlusion-plane.night-shift.station.desk-front"),
      baselineY: 159,
    });
    expect(station(history.present).occlusionPlanes[0]?.baselineY).toBe(159);

    history = undoSceneDirectorEdit(history);
    expect(station(history.present).occlusionPlanes[0]?.baselineY).toBe(154);
    expect(history.future).toHaveLength(1);

    history = redoSceneDirectorEdit(history);
    expect(station(history.present).occlusionPlanes[0]?.baselineY).toBe(159);
    expect(history.future).toHaveLength(0);
  });

  it("rejects native-space edits outside the room", () => {
    expect(() =>
      applySceneDirectorEdit(nightShiftDirectorProject, nightShiftDirectorStaging, {
        kind: "move-approach-slot",
        sceneId: stationId,
        objectId: id<"object">("object.night-shift.radio"),
        slotId: id<"approach-slot">("approach-slot.night-shift.radio.front"),
        position: { x: 400, y: 153 },
      }),
    ).toThrow(SceneDirectorEditError);
  });

  it("rejects a depth edit that breaks strict key ordering and reports the edit command", () => {
    try {
      applySceneDirectorEdit(nightShiftDirectorProject, nightShiftDirectorStaging, {
        kind: "set-depth-key",
        sceneId: stationId,
        curveId: id<"depth-scale-curve">("depth-scale-curve.night-shift.station.floor"),
        keyIndex: 1,
        y: 100,
        scale: 0.8,
      });
      throw new Error("Expected invalid depth edit to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(SceneDirectorEditError);
      if (error instanceof SceneDirectorEditError) {
        expect(error.command.kind).toBe("set-depth-key");
        expect(error.cause).toBeDefined();
      }
    }
  });
});
