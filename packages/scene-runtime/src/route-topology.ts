import {
  applyActions,
  evaluateCondition,
  type RuntimeEvent,
  type RuntimeState,
} from "@evavo/adventure-core";
import type {
  RuntimeAdventureRouteEdge,
  RuntimeAdventureRouteTopologyManifest,
} from "@evavo/adventure-runtime-bundle/route-topology";

export interface AdventureRouteTopologyState {
  readonly currentNodeId: string;
  readonly visitedNodeIds: readonly string[];
  readonly traversedEdgeIds: readonly string[];
  readonly selectedRouteIds: readonly string[];
}

export type AdventureRouteTraversalResult =
  | {
      readonly kind: "traversed";
      readonly edge: RuntimeAdventureRouteEdge;
      readonly state: AdventureRouteTopologyState;
      readonly story: RuntimeState;
      readonly events: readonly RuntimeEvent[];
    }
  | {
      readonly kind: "rejected";
      readonly reason: "unknown-edge" | "wrong-node" | "condition-failed";
      readonly state: AdventureRouteTopologyState;
      readonly story: RuntimeState;
    };

const sortedUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const createAdventureRouteTopologyState = (
  manifest: RuntimeAdventureRouteTopologyManifest,
): AdventureRouteTopologyState => ({
  currentNodeId: manifest.startNodeId,
  visitedNodeIds: [manifest.startNodeId],
  traversedEdgeIds: [],
  selectedRouteIds: [],
});

const nodeFor = (
  manifest: RuntimeAdventureRouteTopologyManifest,
  nodeId: string,
) => manifest.nodes.find((node) => node.id === nodeId) ?? null;

export const availableAdventureRouteEdges = (
  manifest: RuntimeAdventureRouteTopologyManifest,
  story: RuntimeState,
  state: AdventureRouteTopologyState,
): readonly RuntimeAdventureRouteEdge[] =>
  manifest.edges
    .filter((edge) => edge.fromNodeId === state.currentNodeId)
    .filter((edge) => !edge.when || evaluateCondition(edge.when, story))
    .sort((left, right) => left.id.localeCompare(right.id));

export const adventureRouteAtTerminal = (
  manifest: RuntimeAdventureRouteTopologyManifest,
  state: AdventureRouteTopologyState,
): boolean => nodeFor(manifest, state.currentNodeId)?.terminal ?? false;

export const adventureRouteAtRequiredReconvergence = (
  manifest: RuntimeAdventureRouteTopologyManifest,
  state: AdventureRouteTopologyState,
): boolean =>
  manifest.requiredReconvergenceNodeId !== undefined &&
  state.currentNodeId === manifest.requiredReconvergenceNodeId;

export const traverseAdventureRouteEdge = (
  manifest: RuntimeAdventureRouteTopologyManifest,
  story: RuntimeState,
  state: AdventureRouteTopologyState,
  edgeId: string,
): AdventureRouteTraversalResult => {
  const edge = manifest.edges.find((candidate) => candidate.id === edgeId);
  if (!edge) return { kind: "rejected", reason: "unknown-edge", state, story };
  if (edge.fromNodeId !== state.currentNodeId) {
    return { kind: "rejected", reason: "wrong-node", state, story };
  }
  if (edge.when && !evaluateCondition(edge.when, story)) {
    return { kind: "rejected", reason: "condition-failed", state, story };
  }

  let transition = applyActions(story, edge.actions);
  const destination = nodeFor(manifest, edge.toNodeId);
  if (!destination) {
    throw new Error(`Route edge '${edge.id}' points to missing node '${edge.toNodeId}'.`);
  }
  if (destination.sceneId && destination.entranceId) {
    const changed = applyActions(transition.state, [
      {
        kind: "change-scene",
        sceneId: destination.sceneId,
        entranceId: destination.entranceId,
      },
    ]);
    transition = {
      state: changed.state,
      events: [...transition.events, ...changed.events],
    };
  }

  return {
    kind: "traversed",
    edge,
    story: transition.state,
    state: {
      currentNodeId: edge.toNodeId,
      visitedNodeIds: sortedUnique([...state.visitedNodeIds, edge.toNodeId]),
      traversedEdgeIds: sortedUnique([...state.traversedEdgeIds, edge.id]),
      selectedRouteIds: edge.routeId
        ? sortedUnique([...state.selectedRouteIds, edge.routeId])
        : state.selectedRouteIds,
    },
    events: transition.events,
  };
};
