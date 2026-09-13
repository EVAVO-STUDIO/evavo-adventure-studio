import { actionSchema, conditionSchema, idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

const routeIdSchema = z.string().regex(/^route\.[A-Za-z0-9._-]+$/u);
const nodeIdSchema = z.string().regex(/^route-node\.[A-Za-z0-9._-]+$/u);
const edgeIdSchema = z.string().regex(/^route-edge\.[A-Za-z0-9._-]+$/u);

export const runtimeAdventureRouteSchema = z
  .object({
    id: routeIdSchema,
    label: z.string().min(1),
    description: z.string().min(1).optional(),
  })
  .strict();
export type RuntimeAdventureRoute = z.infer<typeof runtimeAdventureRouteSchema>;

export const runtimeAdventureRouteNodeSchema = z
  .object({
    id: nodeIdSchema,
    label: z.string().min(1),
    sceneId: idSchema("scene").optional(),
    entranceId: idSchema("entrance").optional(),
    terminal: z.boolean().default(false),
    tags: z.array(z.string().min(1)).default([]),
  })
  .strict()
  .superRefine((node, context) => {
    if ((node.sceneId === undefined) !== (node.entranceId === undefined)) {
      context.addIssue({
        code: "custom",
        path: ["sceneId"],
        message: "Route node sceneId and entranceId must be authored together.",
      });
    }
  });
export type RuntimeAdventureRouteNode = z.infer<typeof runtimeAdventureRouteNodeSchema>;

export const runtimeAdventureRouteEdgeSchema = z
  .object({
    id: edgeIdSchema,
    label: z.string().min(1),
    fromNodeId: nodeIdSchema,
    toNodeId: nodeIdSchema,
    routeId: routeIdSchema.optional(),
    when: conditionSchema.optional(),
    actions: z.array(actionSchema).default([]),
  })
  .strict();
export type RuntimeAdventureRouteEdge = z.infer<typeof runtimeAdventureRouteEdgeSchema>;

export const runtimeAdventureRouteTopologyManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    startNodeId: nodeIdSchema,
    routes: z.array(runtimeAdventureRouteSchema),
    nodes: z.array(runtimeAdventureRouteNodeSchema).min(1),
    edges: z.array(runtimeAdventureRouteEdgeSchema),
    requiredReconvergenceNodeId: nodeIdSchema.optional(),
  })
  .strict();
export type RuntimeAdventureRouteTopologyManifest = z.infer<
  typeof runtimeAdventureRouteTopologyManifestSchema
>;

export type RuntimeAdventureRouteTopologyIssueCode =
  | "duplicate-route"
  | "duplicate-node"
  | "duplicate-edge"
  | "unknown-start-node"
  | "unknown-reconvergence-node"
  | "unknown-edge-node"
  | "unknown-route"
  | "self-edge"
  | "unknown-scene"
  | "unknown-entrance";

export interface RuntimeAdventureRouteTopologyIssue {
  readonly severity: "error";
  readonly code: RuntimeAdventureRouteTopologyIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface RuntimeAdventureRouteTopologyValidationContext {
  readonly entrancesByScene: ReadonlyMap<string, ReadonlySet<string>>;
}

export const validateRuntimeAdventureRouteTopology = (
  manifest: RuntimeAdventureRouteTopologyManifest,
  context: RuntimeAdventureRouteTopologyValidationContext,
): readonly RuntimeAdventureRouteTopologyIssue[] => {
  const issues: RuntimeAdventureRouteTopologyIssue[] = [];
  const routeIds = new Set<string>();
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  manifest.routes.forEach((route, index) => {
    if (routeIds.has(route.id)) {
      issues.push({ severity: "error", code: "duplicate-route", path: `routes[${index}].id`, message: `Route '${route.id}' is duplicated.` });
    }
    routeIds.add(route.id);
  });

  manifest.nodes.forEach((node, index) => {
    if (nodeIds.has(node.id)) {
      issues.push({ severity: "error", code: "duplicate-node", path: `nodes[${index}].id`, message: `Route node '${node.id}' is duplicated.` });
    }
    nodeIds.add(node.id);
    if (node.sceneId) {
      const entrances = context.entrancesByScene.get(node.sceneId);
      if (!entrances) {
        issues.push({ severity: "error", code: "unknown-scene", path: `nodes[${index}].sceneId`, message: `Route node '${node.id}' references missing scene '${node.sceneId}'.` });
      } else if (node.entranceId && !entrances.has(node.entranceId)) {
        issues.push({ severity: "error", code: "unknown-entrance", path: `nodes[${index}].entranceId`, message: `Route node '${node.id}' entrance '${node.entranceId}' does not exist in scene '${node.sceneId}'.` });
      }
    }
  });

  if (!nodeIds.has(manifest.startNodeId)) {
    issues.push({ severity: "error", code: "unknown-start-node", path: "startNodeId", message: `Start route node '${manifest.startNodeId}' does not exist.` });
  }
  if (manifest.requiredReconvergenceNodeId && !nodeIds.has(manifest.requiredReconvergenceNodeId)) {
    issues.push({ severity: "error", code: "unknown-reconvergence-node", path: "requiredReconvergenceNodeId", message: `Required reconvergence node '${manifest.requiredReconvergenceNodeId}' does not exist.` });
  }

  manifest.edges.forEach((edge, index) => {
    const path = `edges[${index}]`;
    if (edgeIds.has(edge.id)) {
      issues.push({ severity: "error", code: "duplicate-edge", path: `${path}.id`, message: `Route edge '${edge.id}' is duplicated.` });
    }
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      issues.push({ severity: "error", code: "unknown-edge-node", path, message: `Route edge '${edge.id}' must reference existing from/to nodes.` });
    }
    if (edge.fromNodeId === edge.toNodeId) {
      issues.push({ severity: "error", code: "self-edge", path, message: `Route edge '${edge.id}' cannot connect a node to itself.` });
    }
    if (edge.routeId && !routeIds.has(edge.routeId)) {
      issues.push({ severity: "error", code: "unknown-route", path: `${path}.routeId`, message: `Route edge '${edge.id}' references unknown major route '${edge.routeId}'.` });
    }
  });

  return issues.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
};

export class RuntimeAdventureRouteTopologyValidationError extends Error {
  readonly issues: readonly RuntimeAdventureRouteTopologyIssue[];

  constructor(issues: readonly RuntimeAdventureRouteTopologyIssue[]) {
    super(`Runtime route topology is invalid (${issues.length} issue(s)).`);
    this.name = "RuntimeAdventureRouteTopologyValidationError";
    this.issues = issues;
  }
}
