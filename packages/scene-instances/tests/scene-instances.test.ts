import { describe, expect, it } from "vitest";
import { assetBuildManifestSchema } from "@evavo/adventure-asset-contract";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  parseSceneInstanceManifest,
  validateSceneInstanceManifest,
} from "../src/index.js";
import { validateCompiledObjectVisualMappings } from "../src/compiled-mapping.js";

const hash = "0".repeat(64);

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.scene-instances",
  title: "Scene Instances",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: false,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.office",
  startEntranceId: "entrance.office",
  scenes: [
    {
      id: "scene.office",
      name: "Office",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.office",
      navigationAreas: [
        {
          id: "navigation.office",
          shape: {
            points: [
              { x: 0, y: 100 },
              { x: 320, y: 100 },
              { x: 320, y: 200 },
              { x: 0, y: 200 },
            ],
          },
          elevation: 0,
        },
      ],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.office",
          position: { x: 20, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  actors: [
    {
      id: "actor.detective",
      name: "Detective",
      frames: [
        {
          id: "frame.detective.idle",
          assetId: "asset.detective",
          sourceRect: { x: 2, y: 2, width: 12, height: 20 },
          sourceSize: { width: 18, height: 24 },
          trimOffset: { x: 3, y: 4 },
          pivot: { x: 9, y: 23 },
          footPoint: { x: 9, y: 23 },
          durationTicks: 8,
          mirrorEligible: true,
        },
      ],
      animations: [
        {
          id: "animation.detective.idle-east",
          state: "idle",
          facing: "east",
          frameIds: ["frame.detective.idle"],
          loop: true,
          interruptible: true,
        },
      ],
    },
  ],
  dialogues: [],
  sequences: [],
  assets: [
    { id: "asset.office", path: "art/office.png", kind: "image" },
    {
      id: "asset.detective",
      path: "art/detective.aseprite",
      kind: "spritesheet",
    },
    { id: "asset.lamp", path: "art/lamp.aseprite", kind: "spritesheet" },
  ],
  inventoryItems: [],
});

const manifest = parseSceneInstanceManifest({
  manifestVersion: 1,
  projectId: project.id,
  objectDefinitions: [
    {
      id: "object-definition.lamp",
      name: "Desk lamp",
      initialStateId: "object-state.lamp.on",
      states: [
        {
          id: "object-state.lamp.on",
          visual: {
            kind: "sprite-frame",
            assetId: "asset.lamp",
            frameId: "frame.lamp.on",
            sourceRect: { x: 1, y: 1, width: 10, height: 16 },
            sourceSize: { width: 14, height: 18 },
            trimOffset: { x: 2, y: 1 },
            pivot: { x: 7, y: 17 },
          },
          interactions: [
            {
              id: "interaction.lamp.switch-off",
              verb: "use",
              actions: [
                {
                  kind: "set-object-state",
                  objectId: "object.office.lamp",
                  state: "object-state.lamp.off",
                },
              ],
            },
          ],
        },
        {
          id: "object-state.lamp.off",
          visible: false,
          interactions: [],
        },
      ],
    },
  ],
  scenes: [
    {
      sceneId: "scene.office",
      actorInstances: [
        {
          id: "actor-instance.office.detective",
          actorId: "actor.detective",
          position: { x: 40, y: 160 },
          facing: "east",
          animationState: "idle",
        },
      ],
      objectInstances: [
        {
          id: "object.office.lamp",
          definitionId: "object-definition.lamp",
          position: { x: 200, y: 100 },
        },
      ],
    },
  ],
});

const assetManifest = assetBuildManifestSchema.parse({
  manifestVersion: 1,
  projectId: project.id,
  compilerVersion: "0.1.0-test",
  fingerprint: hash,
  assets: project.assets.map((asset) =>
    asset.kind === "spritesheet"
      ? {
          assetId: asset.id,
          kind: "spritesheet",
          sourceFiles: [{ path: asset.path, sha256: hash, byteLength: 1 }],
          outputFiles: [
            {
              role: "atlas-manifest",
              runtimePath: `assets/${asset.id}.json`,
              mediaType: "application/json",
              sha256: hash,
              byteLength: 1,
            },
            {
              role: "page-000",
              runtimePath: `assets/${asset.id}.png`,
              mediaType: "image/png",
              sha256: hash,
              byteLength: 1,
            },
          ],
          metadata: {
            kind: "spritesheet",
            pages: [{ outputRole: "page-000", width: 64, height: 64 }],
            frames:
              asset.id === "asset.lamp"
                ? [
                    {
                      frameId: "frame.lamp.on",
                      pageOutputRole: "page-000",
                      sourceRect: { x: 1, y: 1, width: 10, height: 16 },
                      originalSize: { width: 14, height: 18 },
                      trimOffset: { x: 2, y: 1 },
                      padding: 1,
                    },
                  ]
                : [
                    {
                      frameId: "frame.detective.idle",
                      pageOutputRole: "page-000",
                      sourceRect: { x: 2, y: 2, width: 12, height: 20 },
                      originalSize: { width: 18, height: 24 },
                      trimOffset: { x: 3, y: 4 },
                      padding: 1,
                    },
                  ],
          },
        }
      : {
          assetId: asset.id,
          kind: "image",
          sourceFiles: [{ path: asset.path, sha256: hash, byteLength: 1 }],
          outputFiles: [
            {
              role: "primary",
              runtimePath: `assets/${asset.id}.png`,
              mediaType: "image/png",
              sha256: hash,
              byteLength: 1,
            },
          ],
          metadata: {
            kind: "image",
            width: 320,
            height: 200,
            palette: false,
            colourCount: 16,
          },
        },
  ),
});

describe("scene instance manifests", () => {
  it("validates actor placement, animation selection and object states", () => {
    expect(
      validateSceneInstanceManifest(
        {
          projectId: project.id,
          scenes: project.scenes,
          actors: project.actors,
          assets: project.assets,
        },
        manifest,
      ),
    ).toEqual([]);
    expect(validateCompiledObjectVisualMappings(manifest, assetManifest)).toEqual([]);
  });

  it("reports unreachable walk positions and missing animation facings", () => {
    const broken = parseSceneInstanceManifest({
      ...manifest,
      scenes: [
        {
          ...manifest.scenes[0],
          actorInstances: [
            {
              ...manifest.scenes[0]!.actorInstances[0],
              position: { x: 40, y: 40 },
              facing: "west",
            },
          ],
        },
      ],
    });
    const codes = validateSceneInstanceManifest(
      {
        projectId: project.id,
        scenes: project.scenes,
        actors: project.actors,
        assets: project.assets,
      },
      broken,
    ).map((issue) => issue.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "invalid-actor-instance-position",
        "missing-instance-animation",
      ]),
    );
  });

  it("rejects stale compiled object frame geometry", () => {
    const broken = parseSceneInstanceManifest({
      ...manifest,
      objectDefinitions: [
        {
          ...manifest.objectDefinitions[0],
          states: [
            {
              ...manifest.objectDefinitions[0]!.states[0],
              visual: {
                ...manifest.objectDefinitions[0]!.states[0]!.visual,
                sourceRect: { x: 1, y: 1, width: 9, height: 16 },
              },
            },
            manifest.objectDefinitions[0]!.states[1],
          ],
        },
      ],
    });

    expect(
      validateCompiledObjectVisualMappings(broken, assetManifest).map(
        (issue) => issue.code,
      ),
    ).toContain("compiled-object-frame-geometry-mismatch");
  });
});
