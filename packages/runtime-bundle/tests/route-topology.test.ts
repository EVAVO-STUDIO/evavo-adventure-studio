import { describe, expect, it } from "vitest";
import {
  runtimeAdventureRouteTopologyManifestSchema,
  validateRuntimeAdventureRouteTopology,
} from "../src/route-topology.js";
import { analyzeRuntimeAdventureRouteTopology } from "../src/route-topology-analysis.js";

const manifest = runtimeAdventureRouteTopologyManifestSchema.parse({
  manifestVersion: 1,
  projectId: "project.route-proof",
  startNodeId: "route-node.choice",
  requiredReconvergenceNodeId: "route-node.atlantis",
  routes: [
    { id: "route.team", label: "Team" },
    { id: "route.wits", label: "Wits" },
    { id: "route.fists", label: "Fists" },
  ],
  nodes: [
    { id: "route-node.choice", label: "Choose an approach" },
    { id: "route-node.team", label: "Team route", sceneId: "scene.team", entranceId: "entrance.team" },
    { id: "route-node.wits", label: "Wits route", sceneId: "scene.wits", entranceId: "entrance.wits" },
    { id: "route-node.fists", label: "Fists route", sceneId: "scene.fists", entranceId: "entrance.fists" },
    { id: "route-node.atlantis", label: "Reconvergence", sceneId: "scene.atlantis", entranceId: "entrance.atlantis" },
    { id: "route-node.end", label: "End", terminal: true },
  ],
  edges: [
    { id: "route-edge.choose-team", label: "Go together", fromNodeId: "route-node.choice", toNodeId: "route-node.team", routeId: "route.team" },
    { id: "route-edge.choose-wits", label: "Solve it alone", fromNodeId: "route-node.choice", toNodeId: "route-node.wits", routeId: "route.wits" },
    { id: "route-edge.choose-fists", label: "Fight through", fromNodeId: "route-node.choice", toNodeId: "route-node.fists", routeId: "route.fists" },
    { id: "route-edge.team-atlantis", label: "Reach Atlantis", fromNodeId: "route-node.team", toNodeId: "route-node.atlantis" },
    { id: "route-edge.wits-atlantis", label: "Reach Atlantis", fromNodeId: "route-node.wits", toNodeId: "route-node.atlantis" },
    { id: "route-edge.fists-atlantis", label: "Reach Atlantis", fromNodeId: "route-node.fists", toNodeId: "route-node.atlantis" },
    { id: "route-edge.finish", label: "Finish", fromNodeId: "route-node.atlantis", toNodeId: "route-node.end" },
  ],
});

const entrances = new Map([
  ["scene.team", new Set(["entrance.team"])],
  ["scene.wits", new Set(["entrance.wits"])],
  ["scene.fists", new Set(["entrance.fists"])],
  ["scene.atlantis", new Set(["entrance.atlantis"])],
]);

describe("branching route topology", () => {
  it("validates and proves three major routes can reconverge", () => {
    expect(validateRuntimeAdventureRouteTopology(manifest, { entrancesByScene: entrances })).toEqual([]);
    const analysis = analyzeRuntimeAdventureRouteTopology(manifest);
    expect(analysis.issues).toEqual([]);
    expect(analysis.branchNodeIds).toEqual(["route-node.choice"]);
    expect(analysis.reconvergenceNodeIds).toEqual(["route-node.atlantis"]);
    expect(analysis.routeEntryNodeIds).toEqual({
      "route.fists": ["route-node.fists"],
      "route.team": ["route-node.team"],
      "route.wits": ["route-node.wits"],
    });
  });

  it("reports a route that cannot reach the required reconvergence", () => {
    const broken = {
      ...manifest,
      edges: manifest.edges.filter((edge) => edge.id !== "route-edge.fists-atlantis"),
    };
    expect(analyzeRuntimeAdventureRouteTopology(broken).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "dead-end" }),
        expect.objectContaining({ code: "route-cannot-reconverge" }),
      ]),
    );
  });
});
