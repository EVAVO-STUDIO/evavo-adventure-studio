import type { Id } from "@evavo/adventure-project-schema";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { createInitialRuntimeWorldState, resolveRuntimeSceneFrame } from "../src/index.js";
import {
  executeSceneObjectCommand,
  hitTestSceneObject,
  resolveSceneObjectHotspots,
} from "../src/interactions.js";

const hash = "0".repeat(64);
const id = <T extends string>(value: string) => value as Id<T>;

const imageAsset = (assetId: string, runtimePath: string, width: number, height: number) => ({
  assetId,
  kind: "image" as const,
  outputFiles: [
    {
      role: "primary",
      runtimePath,
      mediaType: "image/png",
      sha256: hash,
      byteLength: 1,
    },
  ],
  metadata: {
    kind: "image" as const,
    width,
    height,
    palette: false,
    colourCount: 8,
  },
});

const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.object-interactions",
  title: "Object Interactions",
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
  assetManifestFingerprint: hash,
  assetCompilerVersion: "0.1.0-test",
  assets: [
    imageAsset("asset.office", "assets/office.png", 320, 200),
    imageAsset("asset.cabinet", "assets/cabinet.png", 20, 20),
    imageAsset("asset.note", "assets/note.png", 16, 12),
  ],
  inventoryItems: [],
  actors: [],
  scenes: [
    {
      id: "scene.office",
      name: "Office",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.office",
      navigationAreas: [],
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
      fallbackText: "That does nothing useful.",
    },
  ],
  dialogues: [],
  sequences: [],
  sceneInstances: {
    manifestVersion: 1,
    projectId: "project.object-interactions",
    objectDefinitions: [
      {
        id: "object-definition.cabinet",
        name: "Filing cabinet",
        initialStateId: "object-state.cabinet.closed",
        states: [
          {
            id: "object-state.cabinet.closed",
            visual: {
              kind: "image",
              assetId: "asset.cabinet",
              pivot: { x: 10, y: 10 },
            },
            interactionShape: {
              points: [
                { x: 0, y: 0 },
                { x: 20, y: 0 },
                { x: 20, y: 20 },
                { x: 0, y: 20 },
              ],
            },
            cursor: "use",
            interactions: [
              {
                id: "interaction.cabinet.open",
                verb: "use",
                actions: [
                  {
                    kind: "set-object-state",
                    objectId: "object.office.cabinet",
                    state: "object-state.cabinet.open",
                  },
                ],
              },
            ],
            fallbackText: "The cabinet is firmly shut.",
          },
          {
            id: "object-state.cabinet.open",
            visual: {
              kind: "image",
              assetId: "asset.cabinet",
              pivot: { x: 10, y: 10 },
            },
            interactionShape: {
              points: [
                { x: 0, y: 0 },
                { x: 20, y: 0 },
                { x: 20, y: 20 },
                { x: 0, y: 20 },
              ],
            },
            interactions: [
              {
                id: "interaction.cabinet.look-open",
                verb: "look",
                actions: [{ kind: "say", text: "The top drawer is empty." }],
              },
            ],
          },
        ],
      },
      {
        id: "object-definition.note",
        name: "Note",
        initialStateId: "object-state.note.default",
        states: [
          {
            id: "object-state.note.default",
            visual: {
              kind: "image",
              assetId: "asset.note",
              pivot: { x: 8, y: 6 },
            },
            interactionShape: {
              points: [
                { x: 0, y: 0 },
                { x: 16, y: 0 },
                { x: 16, y: 12 },
                { x: 0, y: 12 },
              ],
            },
            interactions: [
              {
                id: "interaction.note.look",
                verb: "look",
                actions: [{ kind: "say", text: "A hurried warning." }],
              },
            ],
          },
        ],
      },
    ],
    scenes: [
      {
        sceneId: "scene.office",
        actorInstances: [],
        objectInstances: [
          {
            id: "object.office.cabinet",
            definitionId: "object-definition.cabinet",
            position: { x: 100, y: 100 },
            layer: "world",
          },
          {
            id: "object.office.note",
            definitionId: "object-definition.note",
            position: { x: 100, y: 105 },
            layer: "front-ambient",
          },
        ],
      },
    ],
  },
});

describe("stateful object interactions", () => {
  it("transforms local interaction shapes around the authored pivot", () => {
    const world = createInitialRuntimeWorldState(bundle);
    const cabinet = resolveSceneObjectHotspots(bundle, world).find(
      (target) => target.objectInstanceId === "object.office.cabinet",
    );

    expect(cabinet?.hotspot.shape.points).toEqual([
      { x: 90, y: 90 },
      { x: 110, y: 90 },
      { x: 110, y: 110 },
      { x: 90, y: 110 },
    ]);
    expect(hitTestSceneObject(bundle, world, { x: 89, y: 100 })).toBeNull();
  });

  it("returns the visually topmost overlapping object", () => {
    const target = hitTestSceneObject(bundle, createInitialRuntimeWorldState(bundle), { x: 100, y: 103 });

    expect(target?.objectInstanceId).toBe("object.office.note");
  });

  it("uses state fallback feedback for unmatched commands", () => {
    const world = createInitialRuntimeWorldState(bundle);
    const result = executeSceneObjectCommand(bundle, world, {
      actorId: id<"actor">("actor.player"),
      objectInstanceId: id<"object">("object.office.cabinet"),
      verb: "talk",
      itemId: null,
    });

    expect(result.kind).toBe("fallback");
    if (result.kind === "fallback") {
      expect(result.execution.resolution.text).toBe("The cabinet is firmly shut.");
    }
    expect(result.state).toBe(world);
  });

  it("executes an interaction and persists the new object state", () => {
    const initial = createInitialRuntimeWorldState(bundle);
    const result = executeSceneObjectCommand(bundle, initial, {
      actorId: id<"actor">("actor.player"),
      objectInstanceId: id<"object">("object.office.cabinet"),
      verb: "use",
      itemId: null,
    });

    expect(result.kind).toBe("executed");
    expect(result.state.story.objectStates["object.office.cabinet"]).toBe("object-state.cabinet.open");
    expect(
      resolveSceneObjectHotspots(bundle, result.state).find(
        (target) => target.objectInstanceId === "object.office.cabinet",
      )?.stateId,
    ).toBe("object-state.cabinet.open");
    expect(resolveRuntimeSceneFrame(bundle, result.state).nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "render.object.object.office.cabinet" })]),
    );
  });
});
