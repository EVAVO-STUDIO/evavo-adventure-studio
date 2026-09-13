import type { Id } from "@evavo/adventure-project-schema";
import type { AdventureCreativeAcceptance, AdventureCreativeWorkOrder } from "./creative-production-handoff.js";
import {
  evaluateAdventureCreativeBatch,
  type AdventureCreativeBatchReadiness,
} from "./creative-production-batch.js";
import type { AdventureCreativeProductionSession } from "./creative-production-session.js";

export interface AdventureCreativeAdmissionRecord {
  readonly assetId: Id<"asset">;
  readonly workOrderId: string;
  readonly destinationStudio: "art-studio" | "cel-animation-studio";
  readonly candidateDigest: string;
  readonly acceptedRevision: number;
  readonly sourceDigest: string;
  readonly visualStandardDigest: string;
  readonly alphaAccepted: boolean;
  readonly animationAccepted: boolean;
}

export interface AdventureCreativeAdmissionManifest {
  readonly manifestVersion: 1;
  readonly projectId: Id<"project">;
  readonly records: readonly AdventureCreativeAdmissionRecord[];
}

const recordFrom = (
  order: AdventureCreativeWorkOrder,
  acceptance: AdventureCreativeAcceptance,
): AdventureCreativeAdmissionRecord => ({
  assetId: order.assetId,
  workOrderId: order.workOrderId,
  destinationStudio: order.destinationStudio,
  candidateDigest: acceptance.candidateDigest,
  acceptedRevision: acceptance.acceptedRevision,
  sourceDigest: acceptance.sourceDigest,
  visualStandardDigest: acceptance.visualStandardDigest,
  alphaAccepted: acceptance.alphaAccepted,
  animationAccepted: acceptance.animationAccepted,
});

export const createAdventureCreativeAdmissionManifest = (
  projectId: Id<"project">,
  requiredOrders: readonly AdventureCreativeWorkOrder[],
  sessions: readonly AdventureCreativeProductionSession[],
): AdventureCreativeAdmissionManifest => {
  const readiness = evaluateAdventureCreativeBatch(requiredOrders, sessions);
  if (!readiness.ready) {
    throw new Error(
      `Creative assets cannot be admitted while ${readiness.blockingWorkOrderIds.length} work order(s) remain blocked.`,
    );
  }
  const orderById = new Map(requiredOrders.map((order) => [order.workOrderId, order] as const));
  const records = readiness.acceptances.map((acceptance) => {
    const order = orderById.get(acceptance.workOrderId);
    if (!order) throw new Error(`Acceptance '${acceptance.workOrderId}' has no required work order.`);
    if (order.projectId !== projectId) {
      throw new Error(`Work order '${order.workOrderId}' belongs to project '${order.projectId}', not '${projectId}'.`);
    }
    return recordFrom(order, acceptance);
  });
  return {
    manifestVersion: 1,
    projectId,
    records: [...records].sort((left, right) => left.assetId.localeCompare(right.assetId)),
  };
};

export interface AdventureCreativeAdmissionIssue {
  readonly code:
    | "project-mismatch"
    | "missing-asset-admission"
    | "unexpected-asset-admission"
    | "work-order-mismatch"
    | "visual-standard-mismatch"
    | "alpha-not-accepted"
    | "animation-not-accepted";
  readonly assetId: Id<"asset"> | null;
  readonly message: string;
}

export const validateAdventureCreativeAdmissionManifest = (
  projectId: Id<"project">,
  requiredOrders: readonly AdventureCreativeWorkOrder[],
  manifest: AdventureCreativeAdmissionManifest,
): readonly AdventureCreativeAdmissionIssue[] => {
  const issues: AdventureCreativeAdmissionIssue[] = [];
  if (manifest.projectId !== projectId) {
    issues.push({ code: "project-mismatch", assetId: null, message: `Creative admission project '${manifest.projectId}' does not match '${projectId}'.` });
  }
  const requiredByAsset = new Map(requiredOrders.map((order) => [order.assetId as string, order] as const));
  const recordsByAsset = new Map(manifest.records.map((record) => [record.assetId as string, record] as const));
  for (const order of requiredOrders) {
    const record = recordsByAsset.get(order.assetId);
    if (!record) {
      issues.push({ code: "missing-asset-admission", assetId: order.assetId, message: `Asset '${order.assetId}' has no accepted creative admission record.` });
      continue;
    }
    if (record.workOrderId !== order.workOrderId || record.destinationStudio !== order.destinationStudio) {
      issues.push({ code: "work-order-mismatch", assetId: order.assetId, message: `Asset '${order.assetId}' admission is bound to the wrong work-order/studio authority.` });
    }
    if (record.visualStandardDigest !== order.visualStandardDigest) {
      issues.push({ code: "visual-standard-mismatch", assetId: order.assetId, message: `Asset '${order.assetId}' admission uses a stale visual-standard digest.` });
    }
    if (order.alphaPolicy !== "opaque" && !record.alphaAccepted) {
      issues.push({ code: "alpha-not-accepted", assetId: order.assetId, message: `Asset '${order.assetId}' requires alpha acceptance before compilation.` });
    }
    if (order.taskKind === "animation-sequence" && !record.animationAccepted) {
      issues.push({ code: "animation-not-accepted", assetId: order.assetId, message: `Animation '${order.assetId}' has not passed sequence acceptance.` });
    }
  }
  for (const record of manifest.records) {
    if (!requiredByAsset.has(record.assetId)) {
      issues.push({ code: "unexpected-asset-admission", assetId: record.assetId, message: `Asset '${record.assetId}' is admitted but is not part of the required creative batch.` });
    }
  }
  return issues.sort((left, right) =>
    String(left.assetId ?? "").localeCompare(String(right.assetId ?? "")) || left.code.localeCompare(right.code),
  );
};

export const creativeBatchReadinessForAdmission = (
  requiredOrders: readonly AdventureCreativeWorkOrder[],
  sessions: readonly AdventureCreativeProductionSession[],
): AdventureCreativeBatchReadiness => evaluateAdventureCreativeBatch(requiredOrders, sessions);
