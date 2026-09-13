import { adventureReferenceTitlePackByVariantId } from "./reference-fidelity-presets.js";
import { duplicateValues, validateAdventureReferenceTitlePack } from "./reference-fidelity-pack-validation.js";
import type {
  AdventureReferenceAuditInput,
  AdventureReferenceAuditIssue,
  AdventureReferenceAuditIssueCode,
  AdventureReferenceAuditReport,
  AdventureReferenceCapabilityEvidence,
  AdventureReferenceCapabilityId,
  AdventureReferenceCapabilityRequirement,
  AdventureReferenceTitlePack,
} from "./reference-fidelity-types.js";

const auditIssue = (
  issues: AdventureReferenceAuditIssue[],
  code: AdventureReferenceAuditIssueCode,
  path: string,
  message: string,
  severity: AdventureReferenceAuditIssue["severity"],
): void => {
  issues.push({ severity, code, path, message });
};

const evidenceKey = (value: AdventureReferenceCapabilityEvidence): string =>
  `${value.capabilityId}\u0000${value.kind}\u0000${value.reference}`;

const evidenceFor = (
  requirement: AdventureReferenceCapabilityRequirement,
  values: readonly AdventureReferenceCapabilityEvidence[],
): readonly AdventureReferenceCapabilityEvidence[] =>
  values.filter(
    (value) =>
      value.capabilityId === requirement.id &&
      requirement.evidence.acceptedKinds.includes(value.kind),
  );

export const auditAdventureReferenceTitlePack = (
  pack: AdventureReferenceTitlePack,
  input: AdventureReferenceAuditInput,
): AdventureReferenceAuditReport => {
  const issues: AdventureReferenceAuditIssue[] = [];
  const packIssues = validateAdventureReferenceTitlePack(pack);
  for (const [index, issue] of packIssues.entries()) {
    auditIssue(
      issues,
      "invalid-pack",
      `packIssues[${index}]`,
      `${issue.code}: ${issue.message}`,
      "error",
    );
  }

  const variant = pack.variants.find((candidate) => candidate.id === input.variantId);
  if (!variant) {
    auditIssue(
      issues,
      "unknown-variant",
      "variantId",
      `Variant '${input.variantId}' is not part of '${pack.id}'.`,
      "error",
    );
  }

  const implementedDuplicates = duplicateValues(input.implementedCapabilityIds);
  for (const duplicate of implementedDuplicates) {
    auditIssue(
      issues,
      "duplicate-implemented-capability",
      "implementedCapabilityIds",
      `Implemented capability '${duplicate}' is duplicated.`,
      "error",
    );
  }

  const requirementById = new Map(pack.capabilities.map((entry) => [entry.id, entry]));
  for (const capabilityId of input.implementedCapabilityIds) {
    if (!requirementById.has(capabilityId)) {
      auditIssue(
        issues,
        "unknown-implemented-capability",
        "implementedCapabilityIds",
        `Implemented capability '${capabilityId}' is not required by '${pack.id}'.`,
        "error",
      );
    }
  }

  const evidenceKeys = input.evidence.map(evidenceKey);
  for (const duplicate of duplicateValues(evidenceKeys)) {
    auditIssue(
      issues,
      "duplicate-evidence",
      "evidence",
      `Evidence item '${duplicate.replaceAll("\u0000", ":")}' is duplicated.`,
      "error",
    );
  }
  for (const [index, item] of input.evidence.entries()) {
    const requirement = requirementById.get(item.capabilityId);
    if (!requirement) {
      auditIssue(
        issues,
        "unknown-evidence-capability",
        `evidence[${index}]`,
        `Evidence references unknown capability '${item.capabilityId}'.`,
        "error",
      );
      continue;
    }
    if (!requirement.evidence.acceptedKinds.includes(item.kind)) {
      auditIssue(
        issues,
        "unsupported-evidence-kind",
        `evidence[${index}]`,
        `Evidence kind '${item.kind}' is not accepted for '${item.capabilityId}'.`,
        "error",
      );
    }
    if (item.reference.trim().length < 3 || item.reference.trim() !== item.reference) {
      auditIssue(
        issues,
        "unsupported-evidence-kind",
        `evidence[${index}].reference`,
        "Evidence references must be stable, non-empty and trimmed.",
        "error",
      );
    }
  }

  if (input.observedProfileId !== pack.profileId) {
    auditIssue(
      issues,
      "profile-mismatch",
      "observedProfileId",
      `Observed profile '${input.observedProfileId}' does not match '${pack.profileId}'.`,
      "error",
    );
  }
  if (input.observedProofShowcaseId !== pack.originalProof.showcaseId) {
    auditIssue(
      issues,
      "proof-showcase-mismatch",
      "observedProofShowcaseId",
      `Observed proof '${input.observedProofShowcaseId}' does not match '${pack.originalProof.showcaseId}'.`,
      "error",
    );
  }

  const implemented = new Set<AdventureReferenceCapabilityId>(input.implementedCapabilityIds);
  let totalWeight = 0;
  let earnedWeight = 0;
  let evidencedCapabilities = 0;
  for (const requirement of pack.capabilities) {
    const weight = requirement.critical ? 3 : 1;
    totalWeight += weight * 10;
    if (!implemented.has(requirement.id)) {
      auditIssue(
        issues,
        requirement.critical ? "missing-critical-capability" : "missing-capability",
        `capabilities.${requirement.id}`,
        `Capability '${requirement.label}' is not implemented for '${input.variantId}'.`,
        requirement.critical ? "error" : "warning",
      );
      continue;
    }
    earnedWeight += weight * 6;
    const acceptedEvidence = evidenceFor(requirement, input.evidence);
    const distinctEvidence = new Set(acceptedEvidence.map((entry) => entry.reference));
    if (distinctEvidence.size < requirement.evidence.minimumItems) {
      auditIssue(
        issues,
        requirement.critical ? "missing-critical-evidence" : "missing-evidence",
        `evidence.${requirement.id}`,
        `Capability '${requirement.label}' requires ${
          requirement.evidence.minimumItems
        } retained evidence item(s); observed ${distinctEvidence.size}.`,
        requirement.critical ? "error" : "warning",
      );
      continue;
    }
    evidencedCapabilities += 1;
    earnedWeight += weight * 4;
  }

  const score = totalWeight === 0 ? 0 : Math.round((earnedWeight / totalWeight) * 100);
  const status = issues.some((issue) => issue.severity === "error")
    ? "blocked"
    : issues.length > 0 || score < 100
      ? "attention"
      : "ready";

  return {
    reportVersion: 1,
    packId: pack.id,
    titleId: pack.titleId,
    variantId: input.variantId,
    status,
    score,
    metrics: {
      requiredCapabilities: pack.capabilities.length,
      implementedCapabilities: pack.capabilities.filter((entry) => implemented.has(entry.id)).length,
      criticalCapabilities: pack.capabilities.filter((entry) => entry.critical).length,
      evidencedCapabilities,
      evidenceItems: input.evidence.length,
    },
    issues,
  };
};

export const auditAdventureReferenceVariant = (
  input: AdventureReferenceAuditInput,
): AdventureReferenceAuditReport =>
  auditAdventureReferenceTitlePack(adventureReferenceTitlePackByVariantId(input.variantId), input);
