import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { createAdventureRoutePackagedRuntimeController } from "../src/route-topology-controller.js";

const hash = "0".repeat(64);

const imageAsset = (id: string, path: string) => ({
  assetId: id,
  kind: "image",
  outputFiles: [
    { role: "primary", runtimePath: path, mediaType: "image/png", sha256: hash, byteLength: 1 },
  ],
  metadata: { kind: "image", width: 320, height: 200, palette: true, colourCount: 16 },
});

const scene = (id: string, entranceId: string, backgroundAssetId: string) => ({
  id,
  name: id,
  width: 320,
  height: 200,
  backgroundAssetId,
  navigationAreas: [],
  depthBands: [],
  occluders: [],
  hotspots: [],
  entrances: [{ id: entranceId, position: { x: 20, y: 170 }, facing: "east" }],
  fallbackText: "Nothing happens.",
});

const bundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.route-controller",
  title: "Route Controller",
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
  startSceneId: "scene.choice",
  startEntranceId: "entrance.choice",
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [
    imageAsset("asset.choice", "assets/choice.png"),
    imageAsset("asset.wits", "assets/wits.png"),
    imageAsset("asset.rejoin", "assets/rejoin.png"),
  ],
  inventoryItems: [],
  actors: [],
  scenes: [
    scene("scene.choice", "entrance.choice", "asset.choice"),
    scene("scene.wits", "entrance.wits", "asset.wits"),
    scene("scene.rejoin", "entrance.rejoin", "asset.rejoin"),
  ],
  dialogues: [],
  sequences: [],
  routeTopology: {
    manifestVersion: 1,
    projectId: "project.route-controller",
    startNodeId: "route-node.choice",
    requiredReconvergenceNodeId: "route-node.rejoin",
    routes: [{ id: "route.wits", label: "Wits" }],
    nodes: [
      { id: "route-node.choice", label: "Choice", terminal: false, tags: [] },
      { id: "route-node.wits", label: "Wits", sceneId: "scene.wits", entranceId: "entrance.wits", terminal: false, tags: [] },
      { id: "route-node.rejoin", label: "Rejoin", sceneId: "scene.rejoin", entranceId: "entrance.rejoin", terminal: true, tags: [] },
    ],
    edges: [
      { id: "route-edge.wits", label: "Choose Wits", fromNodeId: "route-node.choice", toNodeId: "route-node.wits", routeId: "route.wits", actions: [{ kind: "set-flag", flag: "witsChosen", value: true }] },
      { id: "route-edge.rejoin", label: "Rejoin", fromNodeId: "route-node.wits", toNodeId: "route-node.rejoin", actions: [] },
    ],
  },
} as unknown as RuntimeBundle;

describe("packaged branching route controller", () => {
  it("traverses room destinations and restores exact route progress", () => {
    const controller = createAdventureRoutePackagedRuntimeController(bundle);
    expect(controller.routeState().currentNodeId).toBe("route-node.choice");
    expect(controller.availableRouteEdges().map((edge) => edge.id)).toEqual(["route-edge.wits"]);

    const selected = controller.traverseRouteEdge("route-edge.wits");
    expect(selected.kind).toBe("traversed");
    expect(controller.worldState().story.currentSceneId).toBe("scene.wits");
    expect(controller.worldState().story.flags.witsChosen).toBe(true);
    expect(controller.routeState().selectedRouteIds).toEqual(["route.wits"]);

    const save = controller.createSaveGame();
    controller.traverseRouteEdge("route-edge.rejoin");
    expect(controller.routeAtRequiredReconvergence()).toBe(true);
    expect(controller.routeAtTerminal()).toBe(true);
    expect(controller.worldState().story.currentSceneId).toBe("scene.rejoin");

    controller.restoreSaveGame(save);
    expect(controller.routeState().currentNodeId).toBe("route-node.wits");
    expect(controller.routeAtTerminal()).toBe(false);
    expect(controller.worldState().story.currentSceneId).toBe("scene.wits");
  });
});
