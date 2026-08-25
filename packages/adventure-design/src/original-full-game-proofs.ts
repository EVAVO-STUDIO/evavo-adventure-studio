import {
  currentAdventureCapabilityCoverage,
  type AdventureCapabilityCoverage,
  type AdventureCapabilityId,
  type AdventureCapabilityStatus,
} from "./full-game-capabilities.js";
import {
  ADVENTURE_CREATIVE_HANDOFF_V3_PROTOCOL_FINGERPRINT,
} from "./creative-production-protocol-v3.js";
import {
  createNinthReliquaryProductionPlan,
  ninthReliquaryAssetSpecs,
  type IllustratedConspiracyProductionAuthority,
} from "./illustrated-conspiracy-production.js";

export interface AdventureOriginalFullGameProof {
  readonly id: string;
  readonly label: string;
  readonly profileId: string;
  readonly requiredCapabilities: readonly AdventureCapabilityId[];
  readonly signatureCapabilities: readonly AdventureCapabilityId[];
  readonly stressScenes: readonly string[];
  readonly requiredCreativeAssetIds: readonly string[];
  readonly creativeProtocolFingerprint: string;
}

export const ninthReliquaryFullGameProof: AdventureOriginalFullGameProof = {
  id: "original-proof.ninth-reliquary",
  label: "The Ninth Reliquary",
  profileId: "cinematic-handdrawn-conspiracy",
  requiredCapabilities: [
    "fixed-room",
    "scrolling-room",
    "multi-elevation-room",
    "walk-regions",
    "per-region-perspective",
    "multi-plane-occlusion",
    "stateful-navigation",
    "preferred-approach",
    "context-interface",
    "inventory",
    "item-on-object",
    "conditional-hotspots",
    "alternate-puzzle-solutions",
    "in-scene-dialogue",
    "portrait-dialogue",
    "branching-dialogue",
    "topic-dialogue",
    "dialogue-fact-unlocks",
    "research-investigation-loop",
    "global-progression-graph",
    "cutscene-sequences",
    "room-cutaways",
    "multi-protagonist-switching",
    "branching-route-topology",
    "travel-map",
    "deterministic-save-replay",
    "localisation",
    "full-game-evidence",
  ],
  signatureCapabilities: [
    "topic-dialogue",
    "research-investigation-loop",
    "room-cutaways",
    "multi-protagonist-switching",
    "branching-route-topology",
  ],
  stressScenes: [
    "Old-city square and cafe with painted cinematic environment, readable exploration, foreground occlusion and evidence-driven conversation.",
    "Conservation archive and hidden chapel with topic research, multi-elevation traversal, object close inspection and temporary cutaway return.",
    "Night train and mountain hospice route with protagonist switching, inventory/evidence exchange, travel topology and character-specific knowledge.",
    "Hand-animated confrontation that uses approved model/X-sheet timing, returns to exploration deterministically and survives save/replay.",
  ],
  requiredCreativeAssetIds: ninthReliquaryAssetSpecs.map((spec) => spec.assetId),
  creativeProtocolFingerprint: ADVENTURE_CREATIVE_HANDOFF_V3_PROTOCOL_FINGERPRINT,
};

export interface AdventureOriginalProofReadiness {
  readonly proofId: string;
  readonly label: string;
  readonly engineReady: boolean;
  readonly creativeReady: boolean;
  readonly fullReady: boolean;
  readonly requiredCapabilityCount: number;
  readonly proofedCapabilityCount: number;
  readonly implementedCapabilityCount: number;
  readonly partialCapabilityCount: number;
  readonly missingCapabilityCount: number;
  readonly capabilityGaps: readonly AdventureCapabilityCoverage[];
  readonly requiredCreativeAssetCount: number;
  readonly acceptedCreativeAssetCount: number;
  readonly missingCreativeAssetIds: readonly string[];
  readonly stressScenes: readonly string[];
}

const coverageById = new Map(currentAdventureCapabilityCoverage.map((entry) => [entry.id, entry] as const));

export const evaluateNinthReliquaryFullGameReadiness = (
  acceptedCreativeAssetIds: readonly string[] = [],
): AdventureOriginalProofReadiness => {
  const required = ninthReliquaryFullGameProof.requiredCapabilities.map(
    (id) => coverageById.get(id) ?? ({ id, status: "missing", evidence: "No capability coverage record." } as const),
  );
  const count = (status: AdventureCapabilityStatus): number =>
    required.filter((entry) => entry.status === status).length;
  const capabilityGaps = required.filter((entry) => entry.status !== "proofed");
  const accepted = new Set(acceptedCreativeAssetIds);
  const missingCreativeAssetIds = ninthReliquaryFullGameProof.requiredCreativeAssetIds.filter(
    (assetId) => !accepted.has(assetId),
  );
  return {
    proofId: ninthReliquaryFullGameProof.id,
    label: ninthReliquaryFullGameProof.label,
    engineReady: capabilityGaps.length === 0,
    creativeReady: missingCreativeAssetIds.length === 0,
    fullReady: capabilityGaps.length === 0 && missingCreativeAssetIds.length === 0,
    requiredCapabilityCount: required.length,
    proofedCapabilityCount: count("proofed"),
    implementedCapabilityCount: count("implemented"),
    partialCapabilityCount: count("partial"),
    missingCapabilityCount: count("missing"),
    capabilityGaps,
    requiredCreativeAssetCount: ninthReliquaryFullGameProof.requiredCreativeAssetIds.length,
    acceptedCreativeAssetCount: ninthReliquaryFullGameProof.requiredCreativeAssetIds.length - missingCreativeAssetIds.length,
    missingCreativeAssetIds,
    stressScenes: ninthReliquaryFullGameProof.stressScenes,
  };
};

export const validateNinthReliquaryProductionAuthorities = (
  authorityByAsset: Readonly<Record<string, IllustratedConspiracyProductionAuthority>>,
): readonly string[] => {
  const issues: string[] = [];
  try {
    const plan = createNinthReliquaryProductionPlan(authorityByAsset);
    if (plan.length !== ninthReliquaryFullGameProof.requiredCreativeAssetIds.length) {
      issues.push("Ninth Reliquary v3 work-order count does not cover the required creative asset set.");
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Ninth Reliquary production authority validation failed.");
  }
  return issues;
};
