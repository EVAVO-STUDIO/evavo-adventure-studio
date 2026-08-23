import { describe, expect, it } from "vitest";
import { studioProject, studioSceneInstances } from "../src/fixture.js";
import { studioSceneStaging } from "../src/scene-staging-fixture.js";
import {
  createSceneDirectorOverlay,
  sceneDirectorModeSummary,
} from "../src/scene-director-model.js";

describe("Scene Director overlay model", () => {
  it("joins project, scene instances and staging into one native-scene contract", () => {
    const overlay = createSceneDirectorOverlay(
      studioProject,
      studioSceneInstances,
      studioSceneStaging,
      studioProject.startSceneId,
    );

    expect(overlay.sceneName).toBe("Rain Office");
    expect(overlay.nativeSize).toEqual({ width: 320, height: 200 });
    expect(overlay.navigationAreas).toHaveLength(2);
    expect(overlay.portals).toHaveLength(1);
    expect(overlay.actors).toHaveLength(2);
    expect(overlay.actors.find((actor) => actor.actorId === "actor.detective")?.footprint).toMatchObject({
      width: 12,
      depth: 7,
      clearance: 2,
    });
    expect(overlay.objects.flatMap((object) => object.approachSlots)).toHaveLength(2);
    expect(overlay.staging?.preferredWalkLanes).toHaveLength(1);
    expect(overlay.staging?.surfaceZones[0]?.surface).toBe("carpet");
    expect(overlay.staging?.navigationScaleOverrides).toHaveLength(2);
    expect(overlay.staging?.navigationStateModifiers[0]?.objectId).toBe("object.office.door");
    expect(overlay.staging?.entryChoreographies[0]?.spawnPosition).toEqual({ x: 24, y: 174 });
    expect(overlay.staging?.paletteLightZones[0]?.blendMode).toBe("ordered-dither");
  });

  it("summarises mode-specific authored evidence", () => {
    const overlay = createSceneDirectorOverlay(
      studioProject,
      studioSceneInstances,
      studioSceneStaging,
      studioProject.startSceneId,
    );

    expect(sceneDirectorModeSummary(overlay, "approach")).toMatchObject({ count: 2 });
    expect(sceneDirectorModeSummary(overlay, "actors")).toMatchObject({ count: 2 });
    expect(sceneDirectorModeSummary(overlay, "light")).toMatchObject({ count: 1 });
    expect(sceneDirectorModeSummary(overlay, "entry")).toMatchObject({ count: 1 });
  });
});
