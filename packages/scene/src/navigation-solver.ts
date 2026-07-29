import type {
  Id,
  NavigationArea,
  Point,
  Polygon,
} from "@evavo/adventure-project-schema";
import { pointInPolygon } from "./index.js";

const EPSILON = 1e-7;

export interface NavigationPortal {
  readonly id: Id<"navigation-portal">;
  readonly fromAreaId: Id<"navigation-area">;
  readonly toAreaId: Id<"navigation-area">;
  readonly fromPoint: Point;
  readonly toPoint: Point;
  readonly bidirectional: boolean;
  readonly traversalCost?: number;
}

export interface NavigationRouteSegment {
  readonly from: Point;
  readonly to: Point;
  readonly kind: "walk" | "portal";
  readonly areaId: Id<"navigation-area"> | null;
  readonly portalId: Id<"navigation-portal"> | null;
  readonly distance: number;
}

export interface NavigationRoute {
  readonly points: readonly Point[];
  readonly segments: readonly NavigationRouteSegment[];
  readonly distance: number;
  readonly startAreaId: Id<"navigation-area">;
  readonly endAreaId: Id<"navigation-area">;
  readonly snappedStart: boolean;
  readonly snappedEnd: boolean;
}

export type NavigationRouteResult =
  | { readonly kind: "route"; readonly route: NavigationRoute }
  | {
      readonly kind: "unreachable";
      readonly reason:
        | "no-navigation-areas"
        | "start-outside-navigation"
        | "end-outside-navigation"
        | "no-connected-route";
    };

export interface NavigationRouteOptions {
  readonly snapStart?: boolean;
  readonly snapEnd?: boolean;
}

interface ResolvedNavigationPoint {
  readonly point: Point;
  readonly areaIds: readonly Id<"navigation-area">[];
  readonly snapped: boolean;
}

interface GraphNode {
  readonly key: string;
  readonly point: Point;
  readonly areaId: Id<"navigation-area">;
}

interface GraphEdge {
  readonly fromKey: string;
  readonly toKey: string;
  readonly cost: number;
  readonly kind: "walk" | "portal";
  readonly areaId: Id<"navigation-area"> | null;
  readonly portalId: Id<"navigation-portal"> | null;
}

interface PreviousStep {
  readonly previousKey: string;
  readonly edge: GraphEdge;
}

interface GraphSolution {
  readonly startKey: string;
  readonly endKey: string;
  readonly previous: ReadonlyMap<string, PreviousStep>;
}

const squaredDistance = (left: Point, right: Point): number => {
  const x = left.x - right.x;
  const y = left.y - right.y;
  return x * x + y * y;
};

const distance = (left: Point, right: Point): number =>
  Math.sqrt(squaredDistance(left, right));

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const closestPointOnSegment = (
  point: Point,
  start: Point,
  end: Point,
): Point => {
  const x = end.x - start.x;
  const y = end.y - start.y;
  const lengthSquared = x * x + y * y;
  if (lengthSquared <= EPSILON) {
    return start;
  }
  const progress = clamp01(
    ((point.x - start.x) * x + (point.y - start.y) * y) / lengthSquared,
  );
  return {
    x: start.x + x * progress,
    y: start.y + y * progress,
  };
};

export const closestPointOnPolygon = (
  point: Point,
  polygon: Polygon,
): Point => {
  if (pointInPolygon(point, polygon)) {
    return point;
  }

  let selected: Point | null = null;
  let selectedDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.points.length; index += 1) {
    const start = polygon.points[index];
    const end = polygon.points[(index + 1) % polygon.points.length];
    if (!start || !end) {
      continue;
    }
    const candidate = closestPointOnSegment(point, start, end);
    const candidateDistance = squaredDistance(point, candidate);
    if (
      candidateDistance < selectedDistance - EPSILON ||
      (Math.abs(candidateDistance - selectedDistance) <= EPSILON &&
        selected !== null &&
        (candidate.x < selected.x ||
          (candidate.x === selected.x && candidate.y < selected.y)))
    ) {
      selected = candidate;
      selectedDistance = candidateDistance;
    }
  }

  if (!selected) {
    throw new RangeError("Navigation polygon has no usable edges.");
  }
  return selected;
};

const cross = (left: Point, right: Point): number =>
  left.x * right.y - left.y * right.x;

const subtract = (left: Point, right: Point): Point => ({
  x: left.x - right.x,
  y: left.y - right.y,
});

const pointAt = (start: Point, end: Point, progress: number): Point => ({
  x: start.x + (end.x - start.x) * progress,
  y: start.y + (end.y - start.y) * progress,
});

const segmentIntersectionParameters = (
  start: Point,
  end: Point,
  edgeStart: Point,
  edgeEnd: Point,
): readonly number[] => {
  const route = subtract(end, start);
  const edge = subtract(edgeEnd, edgeStart);
  const offset = subtract(edgeStart, start);
  const denominator = cross(route, edge);

  if (Math.abs(denominator) > EPSILON) {
    const routeProgress = cross(offset, edge) / denominator;
    const edgeProgress = cross(offset, route) / denominator;
    return routeProgress >= -EPSILON &&
      routeProgress <= 1 + EPSILON &&
      edgeProgress >= -EPSILON &&
      edgeProgress <= 1 + EPSILON
      ? [clamp01(routeProgress)]
      : [];
  }

  if (Math.abs(cross(offset, route)) > EPSILON) {
    return [];
  }

  const routeLengthSquared = squaredDistance(start, end);
  if (routeLengthSquared <= EPSILON) {
    return [0];
  }
  const project = (point: Point): number =>
    ((point.x - start.x) * route.x + (point.y - start.y) * route.y) /
    routeLengthSquared;
  const first = project(edgeStart);
  const second = project(edgeEnd);
  const minimum = Math.max(0, Math.min(first, second));
  const maximum = Math.min(1, Math.max(first, second));
  return minimum <= maximum + EPSILON
    ? [clamp01(minimum), clamp01(maximum)]
    : [];
};

const uniqueSorted = (values: readonly number[]): readonly number[] => {
  const result: number[] = [];
  for (const value of [...values].sort((left, right) => left - right)) {
    const previous = result[result.length - 1];
    if (previous === undefined || Math.abs(value - previous) > EPSILON) {
      result.push(value);
    }
  }
  return result;
};

export const segmentInsidePolygon = (
  start: Point,
  end: Point,
  polygon: Polygon,
): boolean => {
  if (!pointInPolygon(start, polygon) || !pointInPolygon(end, polygon)) {
    return false;
  }
  if (squaredDistance(start, end) <= EPSILON) {
    return true;
  }

  const intersections: number[] = [0, 1];
  for (let index = 0; index < polygon.points.length; index += 1) {
    const edgeStart = polygon.points[index];
    const edgeEnd = polygon.points[(index + 1) % polygon.points.length];
    if (edgeStart && edgeEnd) {
      intersections.push(
        ...segmentIntersectionParameters(start, end, edgeStart, edgeEnd),
      );
    }
  }

  const parameters = uniqueSorted(intersections);
  for (let index = 0; index < parameters.length - 1; index += 1) {
    const from = parameters[index];
    const to = parameters[index + 1];
    if (from === undefined || to === undefined || to - from <= EPSILON) {
      continue;
    }
    if (!pointInPolygon(pointAt(start, end, (from + to) / 2), polygon)) {
      return false;
    }
  }
  return true;
};

const resolvePoint = (
  point: Point,
  areas: readonly NavigationArea[],
  snap: boolean,
): ResolvedNavigationPoint | null => {
  const containing = areas
    .filter((area) => pointInPolygon(point, area.shape))
    .sort((left, right) => {
      if (left.elevation !== right.elevation) {
        return right.elevation - left.elevation;
      }
      return left.id.localeCompare(right.id);
    });
  if (containing.length > 0) {
    return {
      point,
      areaIds: containing.map((area) => area.id),
      snapped: false,
    };
  }
  if (!snap) {
    return null;
  }

  const selected = areas
    .map((area) => {
      const candidate = closestPointOnPolygon(point, area.shape);
      return {
        area,
        point: candidate,
        distanceSquared: squaredDistance(point, candidate),
      };
    })
    .sort((left, right) => {
      if (Math.abs(left.distanceSquared - right.distanceSquared) > EPSILON) {
        return left.distanceSquared - right.distanceSquared;
      }
      return left.area.id.localeCompare(right.area.id);
    })[0];
  return selected
    ? { point: selected.point, areaIds: [selected.area.id], snapped: true }
    : null;
};

const buildGraph = (
  areas: readonly NavigationArea[],
  portals: readonly NavigationPortal[],
  start: ResolvedNavigationPoint,
  end: ResolvedNavigationPoint,
): {
  readonly nodes: ReadonlyMap<string, GraphNode>;
  readonly edges: ReadonlyMap<string, readonly GraphEdge[]>;
  readonly startKeys: readonly string[];
  readonly endKeys: ReadonlySet<string>;
} => {
  const areaMap = new Map(areas.map((area) => [area.id as string, area] as const));
  const nodes = new Map<string, GraphNode>();
  const nodesByArea = new Map<string, GraphNode[]>();
  const edges = new Map<string, GraphEdge[]>();

  const addNode = (node: GraphNode): void => {
    nodes.set(node.key, node);
    const areaNodes = nodesByArea.get(node.areaId) ?? [];
    areaNodes.push(node);
    nodesByArea.set(node.areaId, areaNodes);
    edges.set(node.key, []);
  };
  const addEdge = (edge: GraphEdge): void => {
    edges.get(edge.fromKey)?.push(edge);
  };

  const startKeys = start.areaIds.map((areaId) => {
    const key = `start:${areaId}`;
    addNode({ key, point: start.point, areaId });
    return key;
  });
  const endKeys = new Set(
    end.areaIds.map((areaId) => {
      const key = `end:${areaId}`;
      addNode({ key, point: end.point, areaId });
      return key;
    }),
  );

  for (const area of areas) {
    area.shape.points.forEach((point, index) =>
      addNode({
        key: `vertex:${area.id}:${index}`,
        point,
        areaId: area.id,
      }),
    );
  }

  const validPortals: {
    readonly from: GraphNode;
    readonly to: GraphNode;
    readonly portal: NavigationPortal;
  }[] = [];
  for (const portal of [...portals].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const fromArea = areaMap.get(portal.fromAreaId);
    const toArea = areaMap.get(portal.toAreaId);
    if (
      !fromArea ||
      !toArea ||
      !pointInPolygon(portal.fromPoint, fromArea.shape) ||
      !pointInPolygon(portal.toPoint, toArea.shape) ||
      !Number.isFinite(portal.traversalCost ?? 0) ||
      (portal.traversalCost ?? 0) < 0
    ) {
      continue;
    }
    const from: GraphNode = {
      key: `portal:${portal.id}:from`,
      point: portal.fromPoint,
      areaId: portal.fromAreaId,
    };
    const to: GraphNode = {
      key: `portal:${portal.id}:to`,
      point: portal.toPoint,
      areaId: portal.toAreaId,
    };
    addNode(from);
    addNode(to);
    validPortals.push({ from, to, portal });
  }

  for (const [areaId, areaNodes] of nodesByArea) {
    const area = areaMap.get(areaId);
    if (!area) {
      continue;
    }
    areaNodes.sort((left, right) => left.key.localeCompare(right.key));
    for (let leftIndex = 0; leftIndex < areaNodes.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < areaNodes.length;
        rightIndex += 1
      ) {
        const left = areaNodes[leftIndex];
        const right = areaNodes[rightIndex];
        if (
          !left ||
          !right ||
          !segmentInsidePolygon(left.point, right.point, area.shape)
        ) {
          continue;
        }
        const cost = distance(left.point, right.point);
        addEdge({
          fromKey: left.key,
          toKey: right.key,
          cost,
          kind: "walk",
          areaId: area.id,
          portalId: null,
        });
        addEdge({
          fromKey: right.key,
          toKey: left.key,
          cost,
          kind: "walk",
          areaId: area.id,
          portalId: null,
        });
      }
    }
  }

  for (const { from, to, portal } of validPortals) {
    const cost =
      distance(from.point, to.point) + (portal.traversalCost ?? 0);
    addEdge({
      fromKey: from.key,
      toKey: to.key,
      cost,
      kind: "portal",
      areaId: null,
      portalId: portal.id,
    });
    if (portal.bidirectional) {
      addEdge({
        fromKey: to.key,
        toKey: from.key,
        cost,
        kind: "portal",
        areaId: null,
        portalId: portal.id,
      });
    }
  }

  for (const edgeList of edges.values()) {
    edgeList.sort((left, right) => {
      if (Math.abs(left.cost - right.cost) > EPSILON) {
        return left.cost - right.cost;
      }
      return left.toKey.localeCompare(right.toKey);
    });
  }

  return { nodes, edges, startKeys, endKeys };
};

const solveGraph = (
  nodes: ReadonlyMap<string, GraphNode>,
  edges: ReadonlyMap<string, readonly GraphEdge[]>,
  startKeys: readonly string[],
  endKeys: ReadonlySet<string>,
): GraphSolution | null => {
  const distances = new Map<string, number>();
  const origins = new Map<string, string>();
  const previous = new Map<string, PreviousStep>();
  const pending = new Set(nodes.keys());
  for (const key of nodes.keys()) {
    distances.set(key, Number.POSITIVE_INFINITY);
  }
  for (const key of [...startKeys].sort((left, right) => left.localeCompare(right))) {
    distances.set(key, 0);
    origins.set(key, key);
  }

  while (pending.size > 0) {
    const currentKey = [...pending].sort((left, right) => {
      const difference =
        (distances.get(left) ?? Number.POSITIVE_INFINITY) -
        (distances.get(right) ?? Number.POSITIVE_INFINITY);
      return Math.abs(difference) > EPSILON
        ? difference
        : left.localeCompare(right);
    })[0];
    if (!currentKey) {
      break;
    }
    const currentDistance = distances.get(currentKey) ?? Number.POSITIVE_INFINITY;
    if (!Number.isFinite(currentDistance)) {
      break;
    }
    pending.delete(currentKey);
    if (endKeys.has(currentKey)) {
      const startKey = origins.get(currentKey);
      return startKey ? { startKey, endKey: currentKey, previous } : null;
    }

    for (const edge of edges.get(currentKey) ?? []) {
      if (!pending.has(edge.toKey)) {
        continue;
      }
      const candidate = currentDistance + edge.cost;
      const existing = distances.get(edge.toKey) ?? Number.POSITIVE_INFINITY;
      const candidateOrigin = origins.get(currentKey) ?? currentKey;
      const existingOrigin = origins.get(edge.toKey);
      const existingPrevious = previous.get(edge.toKey);
      if (
        candidate < existing - EPSILON ||
        (Math.abs(candidate - existing) <= EPSILON &&
          (existingOrigin === undefined ||
            candidateOrigin < existingOrigin ||
            (candidateOrigin === existingOrigin &&
              (!existingPrevious ||
                currentKey < existingPrevious.previousKey))))
      ) {
        distances.set(edge.toKey, candidate);
        origins.set(edge.toKey, candidateOrigin);
        previous.set(edge.toKey, { previousKey: currentKey, edge });
      }
    }
  }
  return null;
};

const reconstructRoute = (
  nodes: ReadonlyMap<string, GraphNode>,
  solution: GraphSolution,
): { readonly points: readonly Point[]; readonly segments: readonly NavigationRouteSegment[] } => {
  const reversedEdges: GraphEdge[] = [];
  let cursor = solution.endKey;
  while (cursor !== solution.startKey) {
    const step = solution.previous.get(cursor);
    if (!step) {
      throw new Error("Navigation predecessor chain did not reach its start node.");
    }
    reversedEdges.push(step.edge);
    cursor = step.previousKey;
  }

  const graphEdges = reversedEdges.reverse();
  const startNode = nodes.get(solution.startKey);
  if (!startNode) {
    throw new Error("Navigation route start node is missing.");
  }
  const points: Point[] = [startNode.point];
  const segments = graphEdges.map((edge) => {
    const from = nodes.get(edge.fromKey);
    const to = nodes.get(edge.toKey);
    if (!from || !to) {
      throw new Error("Navigation graph route references a missing node.");
    }
    const last = points[points.length - 1];
    if (!last || squaredDistance(last, to.point) > EPSILON) {
      points.push(to.point);
    }
    return {
      from: from.point,
      to: to.point,
      kind: edge.kind,
      areaId: edge.areaId,
      portalId: edge.portalId,
      distance: edge.cost,
    } satisfies NavigationRouteSegment;
  });
  return { points, segments };
};

export const findNavigationRoute = (
  startPoint: Point,
  endPoint: Point,
  areas: readonly NavigationArea[],
  portals: readonly NavigationPortal[] = [],
  options: NavigationRouteOptions = {},
): NavigationRouteResult => {
  if (areas.length === 0) {
    return { kind: "unreachable", reason: "no-navigation-areas" };
  }
  const start = resolvePoint(startPoint, areas, options.snapStart ?? false);
  if (!start) {
    return { kind: "unreachable", reason: "start-outside-navigation" };
  }
  const end = resolvePoint(endPoint, areas, options.snapEnd ?? true);
  if (!end) {
    return { kind: "unreachable", reason: "end-outside-navigation" };
  }

  const commonArea = [...start.areaIds]
    .filter((areaId) => end.areaIds.includes(areaId))
    .sort((left, right) => left.localeCompare(right))[0];
  if (commonArea && squaredDistance(start.point, end.point) <= EPSILON) {
    return {
      kind: "route",
      route: {
        points: [start.point],
        segments: [],
        distance: 0,
        startAreaId: commonArea,
        endAreaId: commonArea,
        snappedStart: start.snapped,
        snappedEnd: end.snapped,
      },
    };
  }

  const graph = buildGraph(areas, portals, start, end);
  const solution = solveGraph(
    graph.nodes,
    graph.edges,
    graph.startKeys,
    graph.endKeys,
  );
  if (!solution) {
    return { kind: "unreachable", reason: "no-connected-route" };
  }
  const startNode = graph.nodes.get(solution.startKey);
  const endNode = graph.nodes.get(solution.endKey);
  if (!startNode || !endNode) {
    throw new Error("Navigation solution references missing endpoint nodes.");
  }
  const reconstructed = reconstructRoute(graph.nodes, solution);

  return {
    kind: "route",
    route: {
      points: reconstructed.points,
      segments: reconstructed.segments,
      distance: reconstructed.segments.reduce(
        (total, segment) => total + segment.distance,
        0,
      ),
      startAreaId: startNode.areaId,
      endAreaId: endNode.areaId,
      snappedStart: start.snapped,
      snappedEnd: end.snapped,
    },
  };
};
