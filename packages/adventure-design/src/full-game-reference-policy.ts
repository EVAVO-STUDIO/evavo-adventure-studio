import {
  adventureReferenceGameCapabilities,
  currentAdventureCapabilityCoverage,
  type AdventureCapabilityCoverage,
  type AdventureCapabilityId,
  type AdventureFullGameReadiness,
  type AdventureReferenceGameCapabilityProfile,
  type AdventureReferenceGameId,
} from "./full-game-capabilities.js";

const normalizeReference = (
  profile: AdventureReferenceGameCapabilityProfile,
): AdventureReferenceGameCapabilityProfile => {
  if (profile.id !== "quest-for-glory-vga") return profile;
  const required = profile.required.filter((capability) => capability !== "parser-intent");
  if (!required.includes("verb-icon-interface")) required.push("verb-icon-interface");
  return {
    ...profile,
    required,
    signature: profile.signature.filter((capability) => capability !== "parser-intent"),
  };
};

export const adventureFullGameReferenceProfiles: readonly AdventureReferenceGameCapabilityProfile[] =
  adventureReferenceGameCapabilities.map(normalizeReference);

const coverageById = new Map(
  currentAdventureCapabilityCoverage.map((entry) => [entry.id, entry] as const),
);

export const evaluateAdventureFullGameReference = (
  referenceGameId: AdventureReferenceGameId,
): AdventureFullGameReadiness => {
  const profile = adventureFullGameReferenceProfiles.find((candidate) => candidate.id === referenceGameId);
  if (!profile) throw new Error(`Unknown adventure reference game '${referenceGameId}'.`);
  const required: AdventureCapabilityCoverage[] = profile.required.map(
    (id: AdventureCapabilityId) =>
      coverageById.get(id) ?? {
        id,
        status: "missing" as const,
        evidence: "Capability has no coverage record.",
      },
  );
  const count = (status: AdventureCapabilityCoverage["status"]): number =>
    required.filter((entry) => entry.status === status).length;
  const gaps = required.filter((entry) => entry.status !== "proofed");
  return {
    referenceGameId,
    label: profile.label,
    requiredCount: required.length,
    proofedCount: count("proofed"),
    implementedCount: count("implemented"),
    partialCount: count("partial"),
    missingCount: count("missing"),
    ready: gaps.length === 0,
    gaps,
    stressScenes: profile.stressScenes,
  };
};

export const validateAdventureFullGameReferencePolicy = (): readonly string[] => {
  const issues: string[] = [];
  const qfg = adventureFullGameReferenceProfiles.find((profile) => profile.id === "quest-for-glory-vga");
  if (!qfg) issues.push("Quest for Glory VGA reference profile is missing.");
  else {
    if (qfg.required.includes("parser-intent")) {
      issues.push("Quest for Glory VGA must not require the parser-era interaction dialect.");
    }
    if (!qfg.required.includes("verb-icon-interface")) {
      issues.push("Quest for Glory VGA must require the SCI icon interaction dialect.");
    }
  }
  return issues;
};
