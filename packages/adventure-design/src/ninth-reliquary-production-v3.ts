import {
  acceptedCreativeProductionAssetIdsV3,
} from "./creative-production-plan-v3.js";
import {
  type AdventureCreativeStrictQualityEvidenceV3,
  validateAdventureCreativeStrictQualityV3,
} from "./creative-production-quality-v3.js";
import {
  createAdventureCreativePlanSessionV3,
  evaluateAdventureCreativePlanReadinessV3,
  type AdventureCreativePlanSessionV3,
} from "./creative-production-session-v3.js";
import type { IllustratedConspiracyProductionAuthority } from "./illustrated-conspiracy-production.js";
import { createExpandedNinthReliquaryProductionPlan } from "./ninth-reliquary-expanded-production.js";
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

export interface NinthReliquaryStrictCreativeReadiness {
  readonly requiredAssetIds: readonly string[];
  readonly strictlyAcceptedAssetIds: readonly string[];
  readonly blockedAssetIds: readonly string[];
  readonly issuesByAsset: Readonly<Record<string, readonly string[]>>;
  readonly ready: boolean;
}

export interface NinthReliquaryStrictProductionV3Readiness extends NinthReliquaryProductionV3Readiness {
  readonly strictCreative: NinthReliquaryStrictCreativeReadiness;
}

export const createNinthReliquaryCreativeProductionSessionV3 = (
  authorityByAsset: Readonly<Record<string, IllustratedConspiracyProductionAuthority>>,
): AdventureCreativePlanSessionV3 =>
  createAdventureCreativePlanSessionV3(createExpandedNinthReliquaryProductionPlan(authorityByAsset));

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

export const evaluateNinthReliquaryStrictProductionV3Readiness = (
  plan: AdventureCreativePlanSessionV3,
  evidenceByAsset: Readonly<Record<string, AdventureCreativeStrictQualityEvidenceV3 | undefined>>,
): NinthReliquaryStrictProductionV3Readiness => {
  const base = evaluateNinthReliquaryProductionV3Readiness(plan);
  const requiredAssetIds = Object.keys(plan.sessions).sort((left, right) => left.localeCompare(right));
  const strictlyAcceptedAssetIds: string[] = [];
  const issuesByAsset: Record<string, readonly string[]> = {};

  for (const assetId of requiredAssetIds) {
    const session = plan.sessions[assetId];
    const revision = session?.revisions.at(-1);
    const review = revision?.review;
    const evidence = evidenceByAsset[assetId];
    const issues: string[] = [];
    if (!session || session.status !== "accepted" || !session.acceptedDelivery || !revision || !review) {
      issues.push("Creative session has not reached an exact accepted delivery.");
    } else if (!evidence) {
      issues.push("Strict pixel/sequence/repair evidence is missing for the accepted delivery.");
    } else {
      issues.push(
        ...validateAdventureCreativeStrictQualityV3(revision.workOrder, review, evidence).map(
          (entry) => entry.message,
        ),
      );
      if (evidence.candidateArtifactDigest !== session.acceptedDelivery.approvedArtifactDigest) {
        issues.push("Strict quality evidence does not describe the exact admitted delivery bytes.");
      }
    }
    if (issues.length === 0) strictlyAcceptedAssetIds.push(assetId);
    else issuesByAsset[assetId] = issues;
  }

  const blockedAssetIds = requiredAssetIds.filter(
    (assetId) => !strictlyAcceptedAssetIds.includes(assetId),
  );
  const strictCreative: NinthReliquaryStrictCreativeReadiness = {
    requiredAssetIds,
    strictlyAcceptedAssetIds,
    blockedAssetIds,
    issuesByAsset,
    ready: blockedAssetIds.length === 0,
  };
  return {
    ...base,
    strictCreative,
    ready: base.ready && strictCreative.ready,
  };
};
