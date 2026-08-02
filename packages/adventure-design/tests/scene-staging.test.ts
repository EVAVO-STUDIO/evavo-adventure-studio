import { describe, expect, it } from "vitest";
import type { AdventureProject, Id } from "@evavo/adventure-project-schema";
import type { SceneInstanceManifest } from "@evavo/adventure-scene-instances";
import {
  AdventureSceneStagingError,
  createAdventureSceneStagingReports,
  evaluateAdventureSceneStaging,
  objectStagingMarker,
} from "../src/scene-staging.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const project = (): AdventureProject => ({
  schemaVersion: 1,
  id: id<"project">("project.staging"),
  title: "Staging Test",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: true,
    allowHotspotAssist: false,
  },
  startSceneId: id<"scene">("scene.office"),
  startEntranceId: id<"entrance">("entrance.office.front"),
  scenes: [
    {
      id: id<"scene">("scene.office"),
      name: "Rain Office",
      width: 320,
      height: 200,
      backgroundAssetId: id<"asset">("asset.background"),
      navigationAreas: [
        {
          id: id<"navigation-area">("navigation.office.main"),
          elevation: 0,
          shape: {
            points: [
              { x: 10, y: 105 },
              { x: 270, y: 105 },
              { x: 270, y: 192 },
              { x: 10, y: 192 },
            ],
          },
        },
        {
          id: id<"navigation-area">("navigation.office.threshold"),
          elevation: 1,
          shape: {
            points: [
              { x: 250, y: 120 },
              { x: 315, y: 120 },
              { x: 315, y: 175 },
              { x: 250, y: 175 },
            ],
          },
        },
      ],
      depthBands: [
        {
          id: id<"depth-band">("depth.office"),
          farY: 105,
          nearY: 192,
          farScale: 0.7,
          nearScale: 1.05,
        },
      ],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: id<"entrance">("entrance.office.front"),
          position: { x: 22, y: 172 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing else happens.",
    },
    {
      id: id<"scene">("scene.alley"),
      name: "Service Alley",
      width: 320,
      height: 200,
      backgroundAssetId: id<"asset">("asset.background"),
      navigationAreas: [
        {
          id: id<"navigation-area">("navigation.alley.main"),
          elevation: 0,
          shape: {
            points: [
              { x: 8, y: 110 },
              { x: 312, y: 110 },
              { x: 312, y: 194 },
              { x: 8, y: 194 },
            ],
          },
        },
      ],
      depthBands: [
        {
          id: id<"depth-band">("depth.alley"),
          farY: 110,
          nearY: 194,
          farScale: 0.7,
          nearScale: 1.05,
        },
      ],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: id<"entrance">("entrance.alley.office"),
          position: { x: 280, y: 170 },
          facing: "west",
        },
      ],
      fallbackText: "Rain covers the attempt.",
    },
  ],
  actors: [
    {
      id: id<"actor">("actor.detective"),
      name: "Mara Voss",
      frames: [
        {
          id: id<"sprite-frame">("frame.detective.idle-east"),
          assetId: id<"asset">("asset.actor"),
          sourceRect: { x: 0, y: 0, width: 32, height: 56 },
          sourceSize: { width: 32, height: 56 },
          trimOffset: { x: 0, y: 0 },
          pivot: { x: 16, y: 55 },
          footPoint: { x: 16, y: 55 },
          durationTicks: 12,
          mirrorEligible: true,
        },
      ],
      animations: [
        {
          id: id<"animation-clip">("animation.detective.idle-east"),
          state: "idle",
          facing: "east",
          frameIds: [id<"sprite-frame">("frame.detective.idle-east")],
          loop: true,
          interruptible: true,
        },
      ],
    },
  ],
  dialogues: [],
  sequences: [],
  assets: [
    { id: id<"asset">("asset.background"), path: "art/background.png", kind: "image" },
    { id: id<"asset">("asset.actor"), path: "art/actor.png", kind: "spritesheet" },
    { id: id<"asset">("asset.lamp"), path: "art/lamp.png", kind: "spritesheet" },
  ],
  inventoryItems: [],
});

const manifest = (): SceneInstanceManifest => ({
  manifestVersion: 1,
  projectId: id<"project">("project.staging"),
  objectDefinitions: [
    {
      id: id<"object-definition">("definition.lamp"),
      name: "Desk lamp",
      initialStateId: id<"object-state">("state.lamp.on"),
      states: [
        {
          id: id<"object-state">("state.lamp.on"),
          visual: {
            kind: "sprite-frame",
            assetId: id<"asset">("asset.lamp"),
            frameId: id<"sprite-frame">("frame.lamp.on"),
            sourceRect: { x: 0, y: 0, width: 20, height: 30 },
            sourceSize: { width: 20, height: 30 },
            trimOffset: { x: 0, y: 0 },
            pivot: { x: 10, y: 29 },
            opacity: 1,
          },
          visible: true,
          interactionShape: {
            points: [
              { x: -10, y: -29 },
              { x: 10, y: -29 },
              { x: 10, y: 1 },
              { x: -10, y: 1 },
            ],
          },
          walkToOffset: { x: -24, y: 18 },
          faceDirection: "east",
          cursor: "use",
          interactions: [
            {
              id: id<"interaction">("interaction.lamp.off"),
              verb: "use",
              actions: [
                {
                  kind: "set-object-state",
                  objectId: id<"object">("object.office.lamp"),
                  state: "state.lamp.off",
                },
              ],
            },
          ],
        },
        {
          id: id<"object-state">("state.lamp.off"),
          visible: false,
          interactions: [],
        },
      ],
    },
  ],
  scenes: [
    {
      sceneId: id<"scene">("scene.office"),
      actorInstances: [
        {
          id: id<"actor-instance">("actor-instance.office.detective"),
          actorId: id<"actor">("actor.detective"),
          position: { x: 64, y: 170 },
          facing: "east",
          animationState: "idle",
          mobility: "walkable",
          elevation: 0,
          zOffset: 0,
          scaleMultiplier: 1,
        },
      ],
      objectInstances: [
        {
          id: id<"object">("object.office.lamp"),
          definitionId: id<"object-definition">("definition.lamp"),
          position: { x: 182, y: 132 },
          layer: "world",
          elevation: 0,
          zOffset: 1,
          scaleMultiplier: 1,
          mirrored: false,
        },
      ],
      navigationPortals: [
        {
          id: id<"navigation-portal">("portal.office.threshold"),
          fromAreaId: id<"navigation-area">("navigation.office.main"),
          toAreaId: id<"navigation-area">("navigation.office.threshold"),
          fromPoint: { x: 252, y: 150 },
          toPoint: { x: 282, y: 145 },
          bidirectional: true,
          traversalCost: 1,
        },
      ],
    },
    {
      sceneId: id<"scene">("scene.alley"),
      actorInstances: [
        {
          id: id<"actor-instance">("actor-instance.alley.detective"),
          actorId: id<"actor">("actor.detective"),
          position: { x: 270, y: 170 },
          facing: "east",
          animationState: "idle",
          mobility: "walkable",
          elevation: 0,
          zOffset: 0,
          scaleMultiplier: 1,
        },
      ],
      objectInstances: [],
      navigationPortals: [],
    },
  ],
});

describe("scene staging audit", () => {
  it("produces a deterministic ready report for coherent initial staging", () => {
    const sourceProject = project();
    const sourceManifest = manifest();
    const report = evaluateAdventureSceneStaging(
      sourceProject,
      sourceManifest,
      sourceProject.startSceneId,
    );

    expect(report.status).toBe("ready");
    expect(report.score).toBe(100);
    expect(report.findings).toEqual([]);
    expect(report.metrics).toMatchObject({
      actorCount: 1,
      walkableActorCount: 1,
      objectCount: 1,
      interactiveObjectCount: 1,
      portalCount: 1,
      unresolvedVisualCount: 0,
    });
    expect(
      evaluateAdventureSceneStaging(
        sourceProject,
        sourceManifest,
        sourceProject.startSceneId,
      ),
    ).toEqual(report);
  });

  it("blocks ambiguous control and overlapping actor silhouettes", () => {
    const sourceProject = project();
    const sourceManifest = manifest();
    const office = sourceManifest.scenes[0]!;
    const broken: SceneInstanceManifest = {
      ...sourceManifest,
      scenes: [
        {
          ...office,
          actorInstances: [
            ...office.actorInstances,
            {
              ...office.actorInstances[0]!,
              id: id<"actor-instance">("actor-instance.office.second"),
              position: { x: 68, y: 170 },
            },
          ],
        },
        sourceManifest.scenes[1]!,
      ],
    };

    const report = evaluateAdventureSceneStaging(
      sourceProject,
      broken,
      sourceProject.startSceneId,
    );
    expect(report.status).toBe("blocked");
    expect(report.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining([
        "control-start-scene-ambiguous-walkable-actors",
        "actor-silhouette-collision-actor-instance.office.detective-actor-instance.office.second",
      ]),
    );
  });

  it("detects unreachable, hidden and ambient object interactions", () => {
    const sourceProject = project();
    const sourceManifest = manifest();
    const definition = sourceManifest.objectDefinitions[0]!;
    const onState = definition.states[0]!;
    const broken: SceneInstanceManifest = {
      ...sourceManifest,
      objectDefinitions: [
        {
          ...definition,
          states: [
            {
              ...onState,
              visible: false,
              walkToOffset: { x: 500, y: 500 },
              visual: { ...onState.visual!, opacity: 0.2 },
            },
            definition.states[1]!,
          ],
        },
      ],
      scenes: [
        {
          ...sourceManifest.scenes[0]!,
          objectInstances: [
            {
              ...sourceManifest.scenes[0]!.objectInstances[0]!,
              layer: "front-ambient",
            },
          ],
        },
        sourceManifest.scenes[1]!,
      ],
    };

    const report = evaluateAdventureSceneStaging(
      sourceProject,
      broken,
      sourceProject.startSceneId,
    );
    expect(report.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining([
        "object-walk-to-unreachable-object.office.lamp",
        "object-hidden-but-interactive-object.office.lamp",
        "object-interactive-on-ambient-layer-object.office.lamp",
        "object-interactive-low-opacity-object.office.lamp",
      ]),
    );
  });

  it("detects invalid portal intent and an obstructed handoff", () => {
    const sourceProject = project();
    const sourceManifest = manifest();
    const office = sourceManifest.scenes[0]!;
    const portal = office.navigationPortals[0]!;
    const broken: SceneInstanceManifest = {
      ...sourceManifest,
      scenes: [
        {
          ...office,
          objectInstances: [
            {
              ...office.objectInstances[0]!,
              position: { ...portal.fromPoint },
            },
          ],
          navigationPortals: [
            {
              ...portal,
              toAreaId: portal.fromAreaId,
              toPoint: { x: 253, y: 150 },
            },
          ],
        },
        sourceManifest.scenes[1]!,
      ],
    };

    const report = evaluateAdventureSceneStaging(
      sourceProject,
      broken,
      sourceProject.startSceneId,
    );
    expect(report.status).toBe("blocked");
    expect(report.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining([
        "portal-same-area-portal.office.threshold",
        "portal-redundant-handoff-portal.office.threshold",
        "portal-obstructed-portal.office.threshold-object.office.lamp",
      ]),
    );
  });

  it("keeps canonical scene-instance errors visible in the staging report", () => {
    const sourceProject = project();
    const sourceManifest = manifest();
    const broken: SceneInstanceManifest = {
      ...sourceManifest,
      scenes: [
        {
          ...sourceManifest.scenes[0]!,
          objectInstances: [
            {
              ...sourceManifest.scenes[0]!.objectInstances[0]!,
              definitionId: id<"object-definition">("definition.missing"),
            },
          ],
        },
        sourceManifest.scenes[1]!,
      ],
    };

    const report = evaluateAdventureSceneStaging(
      sourceProject,
      broken,
      sourceProject.startSceneId,
    );
    expect(report.status).toBe("blocked");
    expect(report.findings.some((finding) => finding.id.includes("missing-object-definition"))).toBe(true);
  });

  it("blocks a start scene without a composition record", () => {
    const sourceProject = project();
    const sourceManifest = manifest();
    const report = evaluateAdventureSceneStaging(
      sourceProject,
      { ...sourceManifest, scenes: [sourceManifest.scenes[1]!] },
      sourceProject.startSceneId,
    );
    expect(report.status).toBe("blocked");
    expect(report.findings.map((finding) => finding.id)).toContain(
      "manifest-scene-composition-missing",
    );
  });

  it("preserves canonical project scene order", () => {
    const reports = createAdventureSceneStagingReports(project(), manifest());
    expect(reports.map((report) => report.sceneId)).toEqual([
      "scene.office",
      "scene.alley",
    ]);
  });

  it("transforms mirrored object shapes and approach offsets", () => {
    const sourceManifest = manifest();
    const definition = sourceManifest.objectDefinitions[0]!;
    const instance = {
      ...sourceManifest.scenes[0]!.objectInstances[0]!,
      mirrored: true,
      scaleMultiplier: 2,
    };
    const marker = objectStagingMarker(definition, instance);
    expect(marker.walkTo).toEqual({ x: 230, y: 168 });
    expect(marker.interactionShape?.points[0]).toEqual({ x: 202, y: 74 });
  });

  it("rejects unknown project scenes", () => {
    expect(() =>
      evaluateAdventureSceneStaging(
        project(),
        manifest(),
        id<"scene">("scene.missing"),
      ),
    ).toThrow(AdventureSceneStagingError);
  });
});
