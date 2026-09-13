import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { createAudioPackagedRuntimeController } from "../src/index.js";

const hash = "0".repeat(64);

const image = {
  assetId: "asset.room",
  kind: "image",
  outputFiles: [
    {
      role: "primary",
      runtimePath: "assets/room.png",
      mediaType: "image/png",
      sha256: hash,
      byteLength: 1,
    },
  ],
  metadata: {
    kind: "image",
    width: 320,
    height: 200,
    palette: true,
    colourCount: 16,
  },
};

const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.audio-feature-preservation",
  title: "Audio Feature Preservation",
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
  startSceneId: "scene.room",
  startEntranceId: "entrance.room",
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [image],
  inventoryItems: [],
  actors: [],
  scenes: [
    {
      id: "scene.room",
      name: "Room",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.room",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.room",
          position: { x: 10, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  dialogues: [],
  sequences: [
    {
      id: "sequence.test",
      name: "Test",
      mode: "cutscene",
      durationTicks: 4,
      loop: false,
      blocking: true,
      savePolicy: "allowed",
      skip: { allowed: true, safeAfterTick: 0, completionActions: [] },
      tracks: [],
      cueCount: 0,
    },
  ],
  routeTopology: {
    manifestVersion: 1,
    projectId: "project.audio-feature-preservation",
    startNodeId: "route-node.start",
    routes: [{ id: "route.main", label: "Main" }],
    nodes: [
      { id: "route-node.start", label: "Start", terminal: false, tags: [] },
      { id: "route-node.end", label: "End", terminal: true, tags: [] },
    ],
    edges: [
      {
        id: "route-edge.advance",
        label: "Advance",
        fromNodeId: "route-node.start",
        toNodeId: "route-node.end",
        routeId: "route.main",
        actions: [],
      },
    ],
  },
  specializedModes: {
    manifestVersion: 1,
    projectId: "project.audio-feature-preservation",
    modes: [
      {
        id: "specialized-mode.panel",
        kind: "puzzle-closeup",
        once: false,
        sceneId: "scene.room",
        entranceId: "entrance.room",
        startStateId: "idle",
        return: { kind: "stay" },
        states: [
          {
            id: "idle",
            inputRegions: [],
          },
        ],
      },
    ],
  },
});

describe("audio feature companion preservation", () => {
  it("keeps route and specialized-mode state across internal narrative world replacement", () => {
    const controller = createAudioPackagedRuntimeController(bundle);
    const traversed = controller.traverseRouteEdge?.("route-edge.advance");
    expect(traversed?.kind).toBe("traversed");
    controller.startSpecializedMode?.("specialized-mode.panel");

    const before = controller.createSaveGame();
    expect(before.routeTopology?.currentNodeId).toBe("route-node.end");
    expect(before.specializedModes?.active?.modeId).toBe("specialized-mode.panel");

    controller.startNarrativeSequence("sequence.test" as never);

    const after = controller.createSaveGame();
    expect(after.routeTopology).toEqual(before.routeTopology);
    expect(after.specializedModes).toEqual(before.specializedModes);
  });
});
