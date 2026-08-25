import {
  acceptedCreativeProductionAssetIdsV3,
} from "./creative-production-plan-v3.js";
import {
  createAdventureCreativePlanSessionV3,
  evaluateAdventureCreativePlanReadinessV3,
  type AdventureCreativePlanSessionV3,
} from "./creative-production-session-v3.js";
import {
  createNinthReliquaryProductionPlan,
  type IllustratedConspiracyProductionAuthority,
} from "./illustrated-conspiracy-production.js";
import {
  evaluateNinthReliquaryFullGameReadiness,
  type AdventureOriginalProofReadiness,
} from "./original-full-game-proofs.js";

export interface NinthReliquaryProductionV3Readiness {
  readonly projectId: string;
  readonly creative: ReturnType<typeof evaluateAdventureCreativePlanReadinessV3>;
  readonly fullGame: AdventureOriginalProofReadiness;
  readonly ready: boolean;
}

export const createNinthReliquaryCreativeProductionSessionV3 = (
  authorityByAsset: Readonly<Record<string, IllustratedConspiracyProductionAuthority>>,
): AdventureCreativePlanSessionV3 =>
  createAdventureCreativePlanSessionV3(createNinthReliquaryProductionPlan(authorityByAsset));

export const evaluateNinthReliquaryProductionV3Readiness = (
  plan: AdventureCreativePlanSessionV3,
): NinthReliquaryProductionV3Readiness => {
  if (plan.projectId !== "project.ninth-reliquary") {
    throw new Error(`Expected Ninth Reliquary production project, received '${plan.projectId}'.`);
  }
  const creative = evaluateAdventureCreativePlanReadinessV3(plan);
  const acceptedAssetIds = acceptedCreativeProductionAssetIdsV3(plan);
  const fullGame = evaluateNinthReliquaryFullGameReadiness(acceptedAssetIds);
  return {
    projectId: plan.projectId,
    creative,
    fullGame,
    ready: creative.ready && fullGame.fullReady,
  };
};
