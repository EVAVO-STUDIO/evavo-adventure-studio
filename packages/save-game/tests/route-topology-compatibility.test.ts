import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "../src/schema.js";
import { describe, expect, it } from "vitest";
import { validateSavedRouteTopology } from "../src/route-topology-compatibility.js";

const bundle = {
  routeTopology: {
    manifestVersion: 1,
    projectId: "project.route-save",
    startNodeId: "route-node.start",
    routes: [{ id: "route.wits", label: "Wits" }],
    nodes: [
      { id: "route-node.start", label: "Start", terminal: false, tags: [] },
      { id: "route-node.wits", label: "Wits", terminal: true, tags: [] },
    ],
    edges: [
      {
        id: "route-edge.wits",
        label: "Choose Wits",
        fromNodeId: "route-node.start",
        toNodeId: "route-node.wits",
        routeId: "route.wits",
        actions: [],
      },
    ],
  },
} as unknown as RuntimeBundle;

const save = {
  routeTopology: {
    currentNodeId: "route-node.wits",
    visitedNodeIds: ["route-node.start", "route-node.wits"],
    traversedEdgeIds: ["route-edge.wits"],
    selectedRouteIds: ["route.wits"],
  },
} as unknown as SaveGame;

describe("saved branching route compatibility", () => {
  it("accepts route history that still exists in the packaged topology", () => {
    expect(validateSavedRouteTopology(bundle, save)).toEqual([]);
  });

  it("rejects stale route nodes, edges and major route ids", () => {
    const changed = {
      ...bundle,
      routeTopology: {
        ...bundle.routeTopology!,
        routes: [],
        nodes: [{ id: "route-node.start", label: "Start", terminal: true, tags: [] }],
        edges: [],
      },
    } as RuntimeBundle;
    expect(validateSavedRouteTopology(changed, save).map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "route-topology-node-missing",
        "route-topology-edge-missing",
        "route-topology-route-missing",
      ]),
    );
  });
});
