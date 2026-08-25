import type { AdventureCreativeAcceptance, AdventureCreativeWorkOrder } from "./creative-production-handoff.js";
import type { AdventureCreativeProductionSession } from "./creative-production-session.js";

export interface AdventureCreativeBatchReadiness {
  readonly ready: boolean;
  readonly requiredCount: number;
  readonly acceptedCount: number;
  readonly waitingCount: number;
  readonly reworkCount: number;
  readonly missingWorkOrderIds: readonly string[];
  readonly blockingWorkOrderIds: readonly string[];
  readonly acceptances: readonly AdventureCreativeAcceptance[];
}

export const evaluateAdventureCreativeBatch = (
  requiredOrders: readonly AdventureCreativeWorkOrder[],
  sessions: readonly AdventureCreativeProductionSession[],
): AdventureCreativeBatchReadiness => {
  const byOrder = new Map(sessions.map((session) => [session.workOrder.workOrderId, session] as const));
  const requiredIds = new Set(requiredOrders.map((order) => order.workOrderId));
  const duplicateIds = requiredOrders
    .map((order) => order.workOrderId)
    .filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    throw new Error(`Creative batch contains duplicate work orders: ${[...new Set(duplicateIds)].sort().join(", ")}.`);
  }
  for (const session of sessions) {
    if (!requiredIds.has(session.workOrder.workOrderId)) {
      throw new Error(`Creative session '${session.workOrder.workOrderId}' is not part of the required batch.`);
    }
  }

  const missing: string[] = [];
  const blocking: string[] = [];
  const acceptances: AdventureCreativeAcceptance[] = [];
  let waiting = 0;
  let rework = 0;

  for (const order of requiredOrders) {
    const session = byOrder.get(order.workOrderId);
    if (!session) {
      missing.push(order.workOrderId);
      blocking.push(order.workOrderId);
      waiting += 1;
      continue;
    }
    if (session.workOrder.assetId !== order.assetId || session.workOrder.destinationStudio !== order.destinationStudio) {
      throw new Error(`Creative session '${order.workOrderId}' does not match the required asset/studio authority.`);
    }
    if (session.status === "accepted") {
      const acceptance = session.iterations.at(-1)?.acceptance;
      if (!acceptance) throw new Error(`Accepted creative session '${order.workOrderId}' has no acceptance evidence.`);
      acceptances.push(acceptance);
      continue;
    }
    blocking.push(order.workOrderId);
    if (session.status === "rework-required") rework += 1;
    else waiting += 1;
  }

  const sorted = (values: readonly string[]) => [...values].sort((left, right) => left.localeCompare(right));
  return {
    ready: blocking.length === 0,
    requiredCount: requiredOrders.length,
    acceptedCount: acceptances.length,
    waitingCount: waiting,
    reworkCount: rework,
    missingWorkOrderIds: sorted(missing),
    blockingWorkOrderIds: sorted(blocking),
    acceptances: [...acceptances].sort((left, right) => left.workOrderId.localeCompare(right.workOrderId)),
  };
};
