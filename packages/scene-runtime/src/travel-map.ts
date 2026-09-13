import { evaluateCondition, type RuntimeState } from "@evavo/adventure-core";
import type {
  RuntimeAdventureRouteTopologyManifest,
} from "@evavo/adventure-runtime-bundle/route-topology";
import {
  traverseAdventureRouteEdge,
  type AdventureRouteTopologyState,
  type AdventureRouteTraversalResult,
} from "./route-topology.js";

export type AdventureTravelDestinationStatus = "current" | "available" | "locked" | "visited";

export interface AdventureTravelDestination {
  readonly nodeId: string;
  readonly label: string;
  readonly sceneId: string | null;
  readonly entranceId: string | null;
  readonly status: AdventureTravelDestinationStatus;
  readonly viaEdgeIds: readonly string[];
  readonly routeIds: readonly string[];
}

export type AdventureTravelResult =
  | AdventureRouteTraversalResult
  | {
      readonly kind: "rejected";
      readonly reason: "unknown-destination" | "not-adjacent" | "locked" | "ambiguous";
      readonly state: AdventureRouteTopologyState;
      readonly story: RuntimeState;
    };

const uniqueSorted = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const adventureTravelDestinations = (
  manifest: RuntimeAdventureRouteTopologyManifest,
  story: RuntimeState,
  state: AdventureRouteTopologyState,
): readonly AdventureTravelDestination[] => {
  const outgoing = manifest.edges.filter((edge) => edge.fromNodeId === state.currentNodeId);
  const outgoingByNode = new Map<string, typeof outgoing>();
  for (const edge of outgoing) {
    const list = outgoingByNode.get(edge.toNodeId) ?? [];
    outgoingByNode.set(edge.toNodeId, [...list, edge]);
  }
  const visibleNodeIds = new Set<string>([
    state.currentNodeId,
    ...state.visitedNodeIds,
    ...outgoing.map((edge) => edge.toNodeId),
  ]);

  return manifest.nodes
    .filter((node) => visibleNodeIds.has(node.id))
    .map((node): AdventureTravelDestination => {
      const edges = outgoingByNode.get(node.id) ?? [];
      const available = edges.filter((edge) => !edge.when || evaluateCondition(edge.when, story));
      let status: AdventureTravelDestinationStatus;
      if (node.id === state.currentNodeId) status = "current";
      else if (available.length > 0) status = "available";
      else if (edges.length > 0) status = "locked";
      else status = "visited";
      return {
        nodeId: node.id,
        label: node.label,
        sceneId: node.sceneId ?? null,
        entranceId: node.entranceId ?? null,
        status,
        viaEdgeIds: uniqueSorted(edges.map((edge) => edge.id)),
        routeIds: uniqueSorted(edges.flatMap((edge) => edge.routeId ? [edge.routeId] : [])),
      };
    })
    .sort((left, right) => left.nodeId.localeCompare(right.nodeId));
};

export const travelToAdventureRouteNode = (
  manifest: RuntimeAdventureRouteTopologyManifest,
  story: RuntimeState,
  state: AdventureRouteTopologyState,
  destinationNodeId: string,
): AdventureTravelResult => {
  if (!manifest.nodes.some((node) => node.id === destinationNodeId)) {
    return { kind: "rejected", reason: "unknown-destination", state, story };
  }
  const candidates = manifest.edges.filter(
    (edge) => edge.fromNodeId === state.currentNodeId && edge.toNodeId === destinationNodeId,
  );
  if (candidates.length === 0) return { kind: "rejected", reason: "not-adjacent", state, story };
  const available = candidates.filter((edge) => !edge.when || evaluateCondition(edge.when, story));
  if (available.length === 0) return { kind: "rejected", reason: "locked", state, story };
  if (available.length > 1) return { kind: "rejected", reason: "ambiguous", state, story };
  return traverseAdventureRouteEdge(manifest, story, state, available[0]!.id);
};
