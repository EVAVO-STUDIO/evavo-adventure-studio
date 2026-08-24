import { z } from "zod";
import type { AdventureRouteTopologyState } from "@evavo/adventure-scene-runtime/route-topology";

const routeNodeIdSchema = z.string().regex(/^route-node\.[A-Za-z0-9._-]+$/u);
const routeEdgeIdSchema = z.string().regex(/^route-edge\.[A-Za-z0-9._-]+$/u);
const routeIdSchema = z.string().regex(/^route\.[A-Za-z0-9._-]+$/u);

export const saveGameRouteTopologyStateSchema = z
  .object({
    currentNodeId: routeNodeIdSchema,
    visitedNodeIds: z.array(routeNodeIdSchema),
    traversedEdgeIds: z.array(routeEdgeIdSchema),
    selectedRouteIds: z.array(routeIdSchema),
  })
  .strict() as z.ZodType<AdventureRouteTopologyState>;
