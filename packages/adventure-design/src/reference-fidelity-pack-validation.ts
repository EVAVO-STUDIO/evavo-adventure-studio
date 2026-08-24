import type { AdventureProductionProfileId } from "./production-profile-types.js";
import { adventureReferenceEngineDialectById } from "./reference-fidelity-presets.js";
import type {
  AdventureReferenceCapabilityId,
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
  "leisure-suit-larry-vga": "social-comedy-icon-vga",
  "police-quest-i-vga-remake": "early-procedural-icon-vga",
  "police-quest-iv": "procedural-investigation-vga",
  "day-of-the-tentacle": "verb-panel-cartoon-vga",
  "indiana-jones-fate-of-atlantis": "pulp-archaeology-vga",
  "heart-of-china": "cinematic-pulp-vga",
  "rise-of-the-dragon": "cinematic-pulp-vga",
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
): readonly AdventureReferenceCapabilityId[] => {
  const value = dialect as unknown as Record<string, unknown>;
  for (const key of ["baselineCapabilityIds", "requiredCapabilityIds", "capabilityIds"]) {
    const candidate = value[key];
    if (
      Array.isArray(candidate) &&
      candidate.every((entry) => typeof entry === "string")
    ) {
      return candidate as AdventureReferenceCapabilityId[];
    }
  }
  const capabilities = value.capabilities;
  if (Array.isArray(capabilities)) {
    return capabilities.flatMap<AdventureReferenceCapabilityId>((entry) => {
      if (typeof entry === "string") return [entry as AdventureReferenceCapabilityId];
      if (
        entry !== null &&
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        typeof (entry as Record<string, unknown>).id === "string"
      ) {
        return [(entry as Record<string, string>).id as AdventureReferenceCapabilityId];
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
  pack.variants.forEach((variantValue, index) => {
    if (variantValue.titleId !== pack.titleId) {
      packIssue(
        issues,
        "variant-title-mismatch",
        `variants[${index}].titleId`,
        `Variant '${variantValue.id}' belongs to '${variantValue.titleId}', expected '${pack.titleId}'.`,
      );
    }
    if (variantValue.engineDialectId !== pack.engineDialectId) {
      packIssue(
        issues,
        "variant-dialect-mismatch",
        `variants[${index}].engineDialectId`,
        `Variant '${variantValue.id}' dialect '${variantValue.engineDialectId}' does not match pack dialect '${pack.engineDialectId}'.`,
      );
    }
  });

  if (pack.capabilities.length < 1) {
    packIssue(issues, "invalid-capability", "capabilities", "At least one capability is required.");
  }
  pack.capabilities.forEach((requirement, index) => validateCapability(requirement, index, issues));
  for (const duplicate of duplicateValues(pack.capabilities.map((requirement) => requirement.id))) {
    packIssue(
      issues,
      "duplicate-capability",
      "capabilities",
      `Capability '${duplicate}' is duplicated.`,
    );
  }

  if (dialect) {
    const capabilityIds = new Set(pack.capabilities.map((requirement) => requirement.id));
    for (const baselineId of dialectCapabilityIds(dialect)) {
      if (!capabilityIds.has(baselineId)) {
        packIssue(
          issues,
          "missing-baseline-capability",
          "capabilities",
          `Reference pack '${pack.id}' is missing engine baseline capability '${baselineId}'.`,
        );
      }
    }
  }

  if (pack.scenarios.length < 1) {
    packIssue(issues, "invalid-scenario", "scenarios", "At least one reference scenario is required.");
  }
  for (const duplicate of duplicateValues(pack.scenarios.map((scenarioValue) => scenarioValue.id))) {
    packIssue(issues, "duplicate-id", "scenarios", `Scenario '${duplicate}' is duplicated.`);
  }
  const capabilityIds = new Set(pack.capabilities.map((requirement) => requirement.id));
  pack.scenarios.forEach((scenarioValue, index) => {
    if (
      !validIdentifier(scenarioValue.id) ||
      scenarioValue.label.trim().length < 3 ||
      scenarioValue.description.trim().length < 20 ||
      scenarioValue.steps.length < 2 ||
      scenarioValue.expectedOutcome.trim().length < 20
    ) {
      packIssue(
        issues,
        "invalid-scenario",
        `scenarios[${index}]`,
        `Scenario '${scenarioValue.id}' has incomplete identity or execution detail.`,
      );
    }
    for (const requiredId of scenarioValue.requiredCapabilityIds) {
      if (!capabilityIds.has(requiredId)) {
        packIssue(
          issues,
          "unknown-scenario-capability",
          `scenarios[${index}].requiredCapabilityIds`,
          `Scenario '${scenarioValue.id}' references unknown capability '${requiredId}'.`,
        );
      }
    }
  });

  if (
    !validIdentifier(pack.originalProof.showcaseId) ||
    pack.originalProof.title.trim().length < 3
  ) {
    packIssue(
      issues,
      "missing-original-proof",
      "originalProof",
      "Original proof identity is incomplete.",
    );
  }
  if (pack.originalProof.profileId !== pack.profileId) {
    packIssue(
      issues,
      "proof-profile-mismatch",
      "originalProof.profileId",
      `Original proof profile '${pack.originalProof.profileId}' does not match '${pack.profileId}'.`,
    );
  }

  if (
    pack.redistributionBoundary.permitted.length < 2 ||
    pack.redistributionBoundary.prohibited.length < 4 ||
    boundaryCoverage(pack).length < 4
  ) {
    packIssue(
      issues,
      "redistribution-boundary-incomplete",
      "redistributionBoundary",
      "Redistribution boundary must explicitly cover art, writing, audio and commercial identity/content.",
    );
  }

  return issues.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
};
