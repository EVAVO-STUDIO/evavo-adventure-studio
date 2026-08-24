import type {
  RuntimeAdventureRouteTopologyManifest,
} from "./route-topology.js";

export type RuntimeAdventureRouteAnalysisIssueCode =
  | "unreachable-node"
  | "dead-end"
  | "route-without-edge"
  | "unreachable-route"
  | "route-cannot-reconverge"
  | "terminal-has-outgoing-edge";

export interface RuntimeAdventureRouteAnalysisIssue {
  readonly severity: "error" | "warning";
  readonly code: RuntimeAdventureRouteAnalysisIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface RuntimeAdventureRouteAnalysis {
  readonly reachableNodeIds: readonly string[];
  readonly terminalNodeIds: readonly string[];
  readonly branchNodeIds: readonly string[];
  readonly reconvergenceNodeIds: readonly string[];
  readonly routeEntryNodeIds: Readonly<Record<string, readonly string[]>>;
  readonly issues: readonly RuntimeAdventureRouteAnalysisIssue[];
}

const adjacencyFor = (
  manifest: RuntimeAdventureRouteTopologyManifest,
): ReadonlyMap<string, readonly string[]> => {
  const adjacency = new Map<string, string[]>();
  for (const node of manifest.nodes) adjacency.set(node.id, []);
  for (const edge of manifest.edges) {
    const list = adjacency.get(edge.fromNodeId) ?? [];
    list.push(edge.toNodeId);
    adjacency.set(edge.fromNodeId, list);
  }
  return new Map(
    [...adjacency.entries()].map(([nodeId, targets]) => [
      nodeId,
      [...new Set(targets)].sort((left, right) => left.localeCompare(right)),
    ] as const),
  );
};

const reachableFrom = (
  adjacency: ReadonlyMap<string, readonly string[]>,
  startNodeIds: readonly string[],
): ReadonlySet<string> => {
  const visited = new Set<string>();
  const queue = [...startNodeIds];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) continue;
    visited.add(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return visited;
};

export const analyzeRuntimeAdventureRouteTopology = (
  manifest: RuntimeAdventureRouteTopologyManifest,
): RuntimeAdventureRouteAnalysis => {
  const issues: RuntimeAdventureRouteAnalysisIssue[] = [];
  const adjacency = adjacencyFor(manifest);
  const reachable = reachableFrom(adjacency, [manifest.startNodeId]);
  const incomingCounts = new Map<string, number>();
  for (const node of manifest.nodes) incomingCounts.set(node.id, 0);
  for (const edge of manifest.edges) {
    incomingCounts.set(edge.toNodeId, (incomingCounts.get(edge.toNodeId) ?? 0) + 1);
  }

  for (const [index, node] of manifest.nodes.entries()) {
    const outgoing = adjacency.get(node.id) ?? [];
    if (!reachable.has(node.id)) {
      issues.push({
        severity: "warning",
        code: "unreachable-node",
        path: `nodes[${index}]`,
        message: `Route node '${node.id}' cannot be reached structurally from '${manifest.startNodeId}'.`,
      });
    }
    if (reachable.has(node.id) && !node.terminal && outgoing.length === 0) {
      issues.push({
        severity: "error",
        code: "dead-end",
        path: `nodes[${index}]`,
        message: `Reachable route node '${node.id}' is a non-terminal dead end.`,
      });
    }
    if (node.terminal && outgoing.length > 0) {
      issues.push({
        severity: "warning",
        code: "terminal-has-outgoing-edge",
        path: `nodes[${index}]`,
        message: `Terminal route node '${node.id}' still has outgoing edges.`,
      });
    }
  }

  const routeEntryNodeIds: Record<string, readonly string[]> = {};
  for (const [routeIndex, route] of manifest.routes.entries()) {
    const routeEdges = manifest.edges.filter((edge) => edge.routeId === route.id);
    const reachableRouteEdges = routeEdges.filter((edge) => reachable.has(edge.fromNodeId));
    routeEntryNodeIds[route.id] = [...new Set(reachableRouteEdges.map((edge) => edge.toNodeId))]
      .sort((left, right) => left.localeCompare(right));
    if (routeEdges.length === 0) {
      issues.push({
        severity: "error",
        code: "route-without-edge",
        path: `routes[${routeIndex}]`,
        message: `Major route '${route.id}' is declared but no edge selects it.`,
      });
      continue;
    }
    if (reachableRouteEdges.length === 0) {
      issues.push({
        severity: "error",
        code: "unreachable-route",
        path: `routes[${routeIndex}]`,
        message: `Major route '${route.id}' has no selection edge reachable from the start node.`,
      });
      continue;
    }
    if (manifest.requiredReconvergenceNodeId) {
      for (const entryNodeId of routeEntryNodeIds[route.id] ?? []) {
        const routeReachable = reachableFrom(adjacency, [entryNodeId]);
        if (!routeReachable.has(manifest.requiredReconvergenceNodeId)) {
          issues.push({
            severity: "error",
            code: "route-cannot-reconverge",
            path: `routes[${routeIndex}]`,
            message: `Major route '${route.id}' entry '${entryNodeId}' cannot reach required reconvergence '${manifest.requiredReconvergenceNodeId}'.`,
          });
        }
      }
    }
  }

  const branchNodeIds = manifest.nodes
    .filter((node) => (adjacency.get(node.id)?.length ?? 0) > 1)
    .map((node) => node.id)
    .sort((left, right) => left.localeCompare(right));
  const reconvergenceNodeIds = manifest.nodes
    .filter((node) => (incomingCounts.get(node.id) ?? 0) > 1)
    .map((node) => node.id)
    .sort((left, right) => left.localeCompare(right));

  return {
    reachableNodeIds: [...reachable].sort((left, right) => left.localeCompare(right)),
    terminalNodeIds: manifest.nodes.filter((node) => node.terminal).map((node) => node.id).sort((left, right) => left.localeCompare(right)),
    branchNodeIds,
    reconvergenceNodeIds,
    routeEntryNodeIds,
    issues: issues.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code)),
  };
};
