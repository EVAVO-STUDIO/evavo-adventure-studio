import { validateSceneStagingManifest } from "@evavo/adventure-scene-instances/staging-validation";
import { describe, expect, it } from "vitest";
import { studioProject, studioSceneInstances } from "../src/fixture.js";
import {
  nightShiftDirectorInstances,
  nightShiftDirectorProject,
  nightShiftDirectorStaging,
} from "../src/night-shift-director-fixture.js";
import {
  nightShiftDirectorPaletteMaps,
  redLedgerDirectorPaletteMaps,
} from "../src/scene-director-palette-maps.js";
import { sceneDirectorSamples } from "../src/scene-director-samples.js";
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
      redLedgerDirectorPaletteMaps,
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
    expect(overlay.lightZones[0]).toMatchObject({
      bindingStatus: "missing-palette-asset",
      map: {
        id: "palette-map.office-lamp-warm",
        paletteAssetId: "asset.palette.red-ledger.actor-lighting",
        paletteOffset: 64,
      },
    });
  });

  it("summarises mode-specific authored evidence and unresolved palette assets", () => {
    const overlay = createSceneDirectorOverlay(
      studioProject,
      studioSceneInstances,
      studioSceneStaging,
      studioProject.startSceneId,
      redLedgerDirectorPaletteMaps,
    );

    expect(sceneDirectorModeSummary(overlay, "approach")).toMatchObject({ count: 2 });
    expect(sceneDirectorModeSummary(overlay, "actors")).toMatchObject({ count: 2 });
    expect(sceneDirectorModeSummary(overlay, "light")).toMatchObject({
      count: 1,
      note: expect.stringContaining("1 palette-light binding"),
    });
    expect(sceneDirectorModeSummary(overlay, "entry")).toMatchObject({ count: 1 });
  });

  it("ships Red Ledger and Night Shift as distinct production-proof samples", () => {
    expect(sceneDirectorSamples.map((sample) => sample.id)).toEqual([
      "red-ledger",
      "night-shift",
    ]);
    expect(sceneDirectorSamples.map((sample) => sample.productionLanguage)).toEqual([
      "Gothic investigation VGA",
      "Early procedural icon VGA",
    ]);
    expect(sceneDirectorSamples.every((sample) => sample.paletteMaps.projectId === sample.project.id)).toBe(
      true,
    );
  });

  it("resolves the Night Shift station as a fully staged early procedural room", () => {
    const overlay = createSceneDirectorOverlay(
      nightShiftDirectorProject,
      nightShiftDirectorInstances,
      nightShiftDirectorStaging,
      nightShiftDirectorProject.startSceneId,
      nightShiftDirectorPaletteMaps,
    );

    expect(overlay.sceneName).toBe("Municipal briefing room");
    expect(overlay.nativeSize).toEqual({ width: 320, height: 200 });
    expect(overlay.navigationAreas).toHaveLength(2);
    expect(overlay.portals).toHaveLength(1);
    expect(overlay.actors).toHaveLength(2);
    expect(
      overlay.actors.find((actor) => actor.actorId === "actor.night-shift.officer")?.footprint,
    ).toMatchObject({ width: 10, depth: 6, clearance: 2 });
    expect(overlay.objects.flatMap((object) => object.approachSlots)).toHaveLength(3);
    expect(overlay.objects.flatMap((object) => object.comfortRegions)).toHaveLength(2);
    expect(overlay.staging?.preferredWalkLanes).toHaveLength(1);
    expect(overlay.staging?.surfaceZones[0]?.customSurfaceId).toBe("vinyl-tile");
    expect(overlay.staging?.navigationStateModifiers[0]).toMatchObject({
      objectId: "object.night-shift.station-door",
      disabledPortalIds: ["navigation-portal.night-shift.station.threshold"],
    });
    expect(overlay.staging?.entryChoreographies[0]?.spawnPosition).toEqual({ x: 25, y: 176 });
    expect(overlay.staging?.occlusionPlanes).toHaveLength(2);
    expect(overlay.staging?.paletteLightZones[0]?.paletteMapId).toBe(
      "palette-map.night-shift.station-fluorescent",
    );
    expect(overlay.lightZones[0]).toMatchObject({
      bindingStatus: "missing-palette-asset",
      map: {
        paletteAssetId: "asset.palette.night-shift.actor-lighting",
        paletteOffset: 32,
      },
    });
  });

  it("keeps the Night Shift staging fixture semantically valid", () => {
    expect(
      validateSceneStagingManifest(
        {
          projectId: nightShiftDirectorProject.id,
          scenes: nightShiftDirectorProject.scenes,
          actors: nightShiftDirectorProject.actors,
          assets: nightShiftDirectorProject.assets,
          sequences: nightShiftDirectorProject.sequences,
          sceneInstances: nightShiftDirectorInstances,
        },
        nightShiftDirectorStaging,
      ),
    ).toEqual([]);
  });
});
