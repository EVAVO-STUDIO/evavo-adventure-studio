import type { AdventureProductionProfileId } from "./production-profile-types.js";
import { adventureReferenceEngineDialectById } from "./reference-fidelity-presets.js";
import type {
  AdventureReferenceCapabilityRequirement,
  AdventureReferenceEngineDialect,
  AdventureReferencePackIssue,
  AdventureReferencePackIssueCode,
  AdventureReferenceTitlePack,
} from "./reference-fidelity-types.js";

const expectedProfileByTitle: Readonly<
  Record<AdventureReferenceTitlePack["titleId"], AdventureProductionProfileId>
> = {
  "kings-quest-v": "storybook-icon-vga",
  "quest-for-glory-iv": "gothic-rpg-vga",
  "gabriel-knight-sins-of-the-fathers": "gothic-investigation-vga",
  "police-quest-iv": "procedural-investigation-vga",
  "indiana-jones-fate-of-atlantis": "pulp-archaeology-vga",
};

const issueCode = (value: string): AdventureReferencePackIssueCode =>
  value as AdventureReferencePackIssueCode;

const packIssue = (
  issues: AdventureReferencePackIssue[],
  code: string,
  path: string,
  message: string,
  severity: AdventureReferencePackIssue["severity"] = "error",
): void => {
  issues.push({ severity, code: issueCode(code), path, message });
};

export const duplicateValues = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
};

const validIdentifier = (value: string): boolean =>
  /^[a-z0-9][a-z0-9._/-]{1,159}$/u.test(value);

const validateCapability = (
  requirement: AdventureReferenceCapabilityRequirement,
  index: number,
  issues: AdventureReferencePackIssue[],
): void => {
  const path = `capabilities[${index}]`;
  if (
    !validIdentifier(requirement.id) ||
    requirement.label.trim().length < 3 ||
    requirement.description.trim().length < 20
  ) {
    packIssue(
      issues,
      "invalid-capability",
      path,
      `Capability '${requirement.id}' has an invalid identity or incomplete description.`,
    );
  }
  if (
    !Number.isSafeInteger(requirement.evidence.minimumItems) ||
    requirement.evidence.minimumItems < 1 ||
    requirement.evidence.minimumItems > 12 ||
    requirement.evidence.acceptedKinds.length < 1 ||
    duplicateValues(requirement.evidence.acceptedKinds).length > 0 ||
    requirement.evidence.note.trim().length < 10
  ) {
    packIssue(
      issues,
      "invalid-evidence-requirement",
      `${path}.evidence`,
      `Capability '${requirement.id}' has an invalid evidence contract.`,
    );
  }
};

const dialectCapabilityIds = (
  dialect: AdventureReferenceEngineDialect,
): readonly string[] => {
  const value = dialect as unknown as Record<string, unknown>;
  for (const key of ["baselineCapabilityIds", "requiredCapabilityIds", "capabilityIds"]) {
    const candidate = value[key];
    if (
      Array.isArray(candidate) &&
      candidate.every((entry) => typeof entry === "string")
    ) {
      return candidate;
    }
  }
  const capabilities = value.capabilities;
  if (Array.isArray(capabilities)) {
    return capabilities.flatMap((entry) => {
      if (typeof entry === "string") return [entry];
      if (
        entry !== null &&
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        typeof (entry as Record<string, unknown>).id === "string"
      ) {
        return [(entry as Record<string, string>).id];
      }
      return [];
    });
  }
  return [];
};

const boundaryCoverage = (pack: AdventureReferenceTitlePack): readonly string[] => {
  const text = pack.redistributionBoundary.prohibited.join(" ").toLocaleLowerCase("en-US");
  return [
    ["art", "artwork", "image", "asset"].some((term) => text.includes(term)) ? "art" : "",
    ["dialogue", "script", "text"].some((term) => text.includes(term)) ? "writing" : "",
    ["music", "audio", "speech", "voice"].some((term) => text.includes(term)) ? "audio" : "",
    ["character", "logo", "map", "room"].some((term) => text.includes(term))
      ? "identity"
      : "",
  ].filter(Boolean);
};

export const validateAdventureReferenceTitlePack = (
  pack: AdventureReferenceTitlePack,
): readonly AdventureReferencePackIssue[] => {
  const issues: AdventureReferencePackIssue[] = [];
  const expectedProfile = expectedProfileByTitle[pack.titleId];

  if (
    !validIdentifier(pack.id) ||
    pack.referenceTitle.trim().length < 3 ||
    pack.label.trim().length < 3 ||
    pack.summary.trim().length < 20
  ) {
    packIssue(
      issues,
      "invalid-pack",
      "id",
      "Reference pack identity or summary is incomplete.",
    );
  }

  if (pack.profileId !== expectedProfile) {
    packIssue(
      issues,
      "profile-mismatch",
      "profileId",
      `Reference title '${pack.titleId}' requires profile '${expectedProfile}', not '${pack.profileId}'.`,
    );
  }

  let dialect: AdventureReferenceEngineDialect | null = null;
  try {
    dialect = adventureReferenceEngineDialectById(pack.engineDialectId);
  } catch {
    packIssue(
      issues,
      "unknown-engine-dialect",
      "engineDialectId",
      `Engine dialect '${pack.engineDialectId}' does not exist.`,
    );
  }

  if (pack.variants.length < 1) {
    packIssue(
      issues,
      "missing-variant",
      "variants",
      "At least one release variant is required.",
    );
  }
  for (const duplicate of duplicateValues(pack.variants.map((variant) => variant.id))) {
    packIssue(issues, "duplicate-id", "variants", `Release variant '${duplicate}' is duplicated.`);
  }
  pack.variants.forEach((variant, index) => {
    const path = `variants[${index}]`;
    if (!validIdentifier(variant.id) || variant.label.trim().length < 3) {
      packIssue(issues, "invalid-variant", path, `Release variant '${variant.id}' is invalid.`);
    }
    if (variant.titleId !== pack.titleId) {
      packIssue(
        issues,
        "variant-title-mismatch",
        `${path}.titleId`,
        `Release variant '${variant.id}' belongs to '${variant.titleId}', not '${pack.titleId}'.`,
      );
    }
    if (variant.engineDialectId !== pack.engineDialectId) {
      packIssue(
        issues,
        "variant-engine-mismatch",
        `${path}.engineDialectId`,
        `Release variant '${variant.id}' uses a different engine dialect.`,
      );
    }
    if (
      variant.releaseNotes.length < 1 ||
      variant.releaseNotes.some((note) => note.trim().length < 10)
    ) {
      packIssue(
        issues,
        "invalid-variant",
        `${path}.releaseNotes`,
        `Release variant '${variant.id}' requires explicit release-specific notes.`,
      );
    }
  });

  if (pack.capabilities.length < 1) {
    packIssue(
      issues,
      "missing-capability",
      "capabilities",
      "At least one capability is required.",
    );
  }
  for (const duplicate of duplicateValues(pack.capabilities.map((entry) => entry.id))) {
    packIssue(issues, "duplicate-id", "capabilities", `Capability '${duplicate}' is duplicated.`);
  }
  pack.capabilities.forEach((entry, index) => validateCapability(entry, index, issues));
  const capabilityIds = new Set(pack.capabilities.map((entry) => entry.id));

  if (dialect) {
    for (const capabilityId of dialectCapabilityIds(dialect)) {
      if (!capabilityIds.has(capabilityId)) {
        packIssue(
          issues,
          "missing-engine-capability",
          "capabilities",
          `Engine baseline capability '${capabilityId}' is missing from '${pack.id}'.`,
        );
      }
    }
  }

  if (pack.scenarios.length < 1) {
    packIssue(
      issues,
      "missing-scenario",
      "scenarios",
      "At least one executable scenario is required.",
    );
  }
  for (const duplicate of duplicateValues(pack.scenarios.map((entry) => entry.id))) {
    packIssue(issues, "duplicate-id", "scenarios", `Scenario '${duplicate}' is duplicated.`);
  }
  const scenarioCapabilities = new Set<string>();
  pack.scenarios.forEach((scenario, index) => {
    const path = `scenarios[${index}]`;
    if (
      !validIdentifier(scenario.id) ||
      scenario.label.trim().length < 3 ||
      scenario.purpose.trim().length < 20 ||
      scenario.steps.length < 2 ||
      scenario.expectedResult.trim().length < 20
    ) {
      packIssue(issues, "invalid-scenario", path, `Scenario '${scenario.id}' is incomplete.`);
    }
    for (const capabilityId of scenario.capabilityIds) {
      scenarioCapabilities.add(capabilityId);
      if (!capabilityIds.has(capabilityId)) {
        packIssue(
          issues,
          "unknown-scenario-capability",
          `${path}.capabilityIds`,
          `Scenario '${scenario.id}' references unknown capability '${capabilityId}'.`,
        );
      }
    }
  });
  for (const requirement of pack.capabilities) {
    if (requirement.critical && !scenarioCapabilities.has(requirement.id)) {
      packIssue(
        issues,
        "missing-critical-scenario",
        "scenarios",
        `Critical capability '${requirement.id}' has no executable scenario coverage.`,
      );
    }
  }

  if (
    pack.originalProof.title.trim().length < 3 ||
    pack.originalProof.profileId !== pack.profileId ||
    pack.originalProof.originalAssetsOnly !== true ||
    pack.originalProof.featuredSystems.length < 3 ||
    pack.originalProof.note.trim().length < 20
  ) {
    packIssue(
      issues,
      "original-proof-mismatch",
      "originalProof",
      `Original proof '${pack.originalProof.title}' does not match the reference pack contract.`,
    );
  }

  if (
    pack.redistributionBoundary.allowed.length < 2 ||
    pack.redistributionBoundary.prohibited.length < 4 ||
    pack.redistributionBoundary.privateReferencePolicy.trim().length < 20 ||
    boundaryCoverage(pack).length < 4
  ) {
    packIssue(
      issues,
      "incomplete-redistribution-boundary",
      "redistributionBoundary",
      "The commercial-content and private-reference boundaries are incomplete.",
    );
  }

  return issues.sort(
    (left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code),
  );
};
