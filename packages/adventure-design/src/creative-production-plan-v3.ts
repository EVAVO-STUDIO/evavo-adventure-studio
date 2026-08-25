import {
  type AdventureCreativePlanSessionV3,
  type AdventureCreativeProductionSessionV3,
  evaluateAdventureCreativePlanReadinessV3,
} from "./creative-production-session-v3.js";

export const creativeProductionPlanAssetSessionV3 = (
  plan: AdventureCreativePlanSessionV3,
  assetId: string,
): AdventureCreativeProductionSessionV3 => {
  const session = plan.sessions[assetId];
  if (!session) throw new Error(`Creative production v3 plan has no asset '${assetId}'.`);
  return session;
};

export const replaceCreativeProductionPlanAssetSessionV3 = (
  plan: AdventureCreativePlanSessionV3,
  session: AdventureCreativeProductionSessionV3,
): AdventureCreativePlanSessionV3 => {
  if (session.projectId !== plan.projectId) {
    throw new Error("Creative production v3 plan cannot accept a session from another project.");
  }
  if (!plan.sessions[session.assetId]) {
    throw new Error(`Creative production v3 plan has no asset '${session.assetId}'.`);
  }
  return {
    ...plan,
    sessions: {
      ...plan.sessions,
      [session.assetId]: session,
    },
  };
};

export const acceptedCreativeProductionAssetIdsV3 = (
  plan: AdventureCreativePlanSessionV3,
): readonly string[] =>
  Object.values(plan.sessions)
    .filter((session) => session.status === "accepted" && session.acceptedDelivery)
    .map((session) => session.assetId)
    .sort((left, right) => left.localeCompare(right));

export const assertCreativeProductionPlanAcceptedV3 = (
  plan: AdventureCreativePlanSessionV3,
): AdventureCreativePlanSessionV3 => {
  const readiness = evaluateAdventureCreativePlanReadinessV3(plan);
  if (!readiness.ready) {
    throw new Error(
      `Creative production v3 plan is not accepted; missing assets: ${readiness.missingAssetIds.join(", ")}.`,
    );
  }
  return plan;
};
