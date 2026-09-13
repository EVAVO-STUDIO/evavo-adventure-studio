import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "./schema.js";
import { addSaveGameIssue, type SaveGameCompatibilityIssue } from "./errors.js";

export const validateSavedRouteTopology = (
  bundle: RuntimeBundle,
  save: SaveGame,
): readonly SaveGameCompatibilityIssue[] => {
  const state = save.routeTopology;
  if (!state) return [];
  const issues: SaveGameCompatibilityIssue[] = [];
  const manifest = bundle.routeTopology;
  if (!manifest) {
    addSaveGameIssue(
      issues,
      "route-topology-state-without-runtime-manifest",
      "routeTopology",
      "Save contains branching route state but this runtime bundle has no route topology manifest.",
    );
    return issues;
  }

  const nodeIds = new Set(manifest.nodes.map((node) => node.id));
  const edgeIds = new Set(manifest.edges.map((edge) => edge.id));
  const routeIds = new Set(manifest.routes.map((route) => route.id));
  const checkNode = (nodeId: string, path: string): void => {
    if (!nodeIds.has(nodeId)) {
      addSaveGameIssue(issues, "route-topology-node-missing", path, `Saved route node '${nodeId}' no longer exists.`);
    }
  };

  checkNode(state.currentNodeId, "routeTopology.currentNodeId");
  state.visitedNodeIds.forEach((nodeId, index) => checkNode(nodeId, `routeTopology.visitedNodeIds[${index}]`));
  state.traversedEdgeIds.forEach((edgeId, index) => {
    if (!edgeIds.has(edgeId)) {
      addSaveGameIssue(issues, "route-topology-edge-missing", `routeTopology.traversedEdgeIds[${index}]`, `Saved route edge '${edgeId}' no longer exists.`);
    }
  });
  state.selectedRouteIds.forEach((routeId, index) => {
    if (!routeIds.has(routeId)) {
      addSaveGameIssue(issues, "route-topology-route-missing", `routeTopology.selectedRouteIds[${index}]`, `Saved major route '${routeId}' no longer exists.`);
    }
  });
  return issues;
};
