import type { AdventureProductionProfileId } from "./production-profile-types.js";
import { adventureReferenceEngineDialectById } from "./reference-fidelity-presets.js";
import type {
  AdventureReferenceCapabilityRequirement,
  AdventureReferencePackIssue,
  AdventureReferencePackIssueCode,
  AdventureReferenceTitlePack,
} from "./reference-fidelity-types.js";

const expectedProfileByTitle: Readonly<
  Record<AdventureReferenceTitlePack["titleId"], AdventureProductionProfileId>
> = {
  "kings-quest-v": "storybook-icon-vga",
  "quest-for-glory-iv": "gothic-investigation-vga",
  "gabriel-knight-sins-of-the-fathers": "gothic-investigation-vga",
  "police-quest-iv": "gothic-investigation-vga",
  "indiana-jones-fate-of-atlantis": "pulp-archaeology-vga",
};

const packIssue = (
  issues: AdventureReferencePackIssue[],
  code: AdventureReferencePackIssueCode,
  path: string,
  message: string,
  severity: AdventureReferencePackIssue["severity"] = "error",
): void => {
  issues.push({ severity, code, path, message });
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

const boundaryCoverage = (pack: AdventureReferenceTitlePack): readonly string[] => {
  const text = pack.redistributionBoundary.prohibited.join(" ").toLocaleLowerCase("en-US");
  return [
    "commercial art",
    "commercial music",
    "commercial dialogue",
    "commercial characters",
    "commercial room",
  ].filter((term) => !text.includes(term));
};

export const validateAdventureReferenceTitlePack = (
  pack: AdventureReferenceTitlePack,
): readonly AdventureReferencePackIssue[] => {
  const issues: AdventureReferencePackIssue[] = [];
  if (pack.packVersion !== 1 || !validIdentifier(pack.id)) {
    packIssue(issues, "duplicate-id", "id", "The pack identity or version is invalid.");
  }

  let dialect = null;
  try {
    dialect = adventureReferenceEngineDialectById(pack.engineDialectId);
  } catch {
    packIssue(
      issues,
      "unknown-engine-dialect",
      "engineDialectId",
      `Engine dialect '${pack.engineDialectId}' is not registered.`,
    );
  }

  const expectedProfile = expectedProfileByTitle[pack.titleId];
  if (pack.profileId !== expectedProfile || pack.originalProof.profileId !== pack.profileId) {
    packIssue(
      issues,
      "invalid-profile-binding",
      "profileId",
      `Reference title '${pack.titleId}' must bind to '${expectedProfile}' and one ` +
        "matching original proof profile.",
    );
  }

  const variantIds = pack.variants.map((entry) => entry.id);
  for (const duplicate of duplicateValues(variantIds)) {
    packIssue(issues, "duplicate-id", "variants", `Variant ID '${duplicate}' is duplicated.`);
  }
  if (pack.variants.length < 2) {
    packIssue(
      issues,
      "invalid-variant",
      "variants",
      "Every title pack must keep at least floppy and CD variants explicit.",
    );
  }
  for (const [index, variant] of pack.variants.entries()) {
    if (
      !validIdentifier(variant.id) ||
      variant.titleId !== pack.titleId ||
      variant.engineDialectId !== pack.engineDialectId ||
      variant.platform !== "dos" ||
      variant.language !== "en" ||
      variant.label.trim().length < 3 ||
      variant.notes.length < 1
    ) {
      packIssue(
        issues,
        "invalid-variant",
        `variants[${index}]`,
        `Variant '${variant.id}' is incomplete or conflicts with the pack identity.`,
      );
    }
  }
  if (new Set(pack.variants.map((entry) => entry.media)).size !== 2) {
    packIssue(
      issues,
      "invalid-variant",
      "variants",
      "The title pack must expose one floppy and one CD release variant.",
    );
  }

  const capabilityIds = pack.capabilities.map((entry) => entry.id);
  for (const duplicate of duplicateValues(capabilityIds)) {
    packIssue(issues, "duplicate-id", "capabilities", `Capability ID '${duplicate}' is duplicated.`);
  }
  pack.capabilities.forEach((requirement, index) => validateCapability(requirement, index, issues));
  if (dialect) {
    const observed = new Set(capabilityIds);
    for (const requiredId of dialect.baselineCapabilityIds) {
      if (!observed.has(requiredId)) {
        packIssue(
          issues,
          "missing-baseline-capability",
          "capabilities",
          `Engine baseline capability '${requiredId}' is missing.`,
        );
      }
    }
  }

  const scenarioIds = pack.scenarios.map((entry) => entry.id);
  for (const duplicate of duplicateValues(scenarioIds)) {
    packIssue(issues, "duplicate-id", "scenarios", `Scenario ID '${duplicate}' is duplicated.`);
  }
  if (pack.scenarios.length < 4) {
    packIssue(
      issues,
      "insufficient-scenarios",
      "scenarios",
      "Each title pack must prove boot, puzzle, save and terminal lifecycle behaviour.",
    );
  }
  const capabilitySet = new Set(capabilityIds);
  for (const [index, scenario] of pack.scenarios.entries()) {
    if (
      !validIdentifier(scenario.id) ||
      scenario.label.trim().length < 3 ||
      scenario.description.trim().length < 20 ||
      scenario.steps.length < 3 ||
      scenario.expectedOutcome.trim().length < 20 ||
      scenario.requiredCapabilityIds.length < 1 ||
      duplicateValues(scenario.requiredCapabilityIds).length > 0
    ) {
      packIssue(
        issues,
        "invalid-scenario",
        `scenarios[${index}]`,
        `Scenario '${scenario.id}' is incomplete or internally inconsistent.`,
      );
    }
    for (const capabilityId of scenario.requiredCapabilityIds) {
      if (!capabilitySet.has(capabilityId)) {
        packIssue(
          issues,
          "unknown-scenario-capability",
          `scenarios[${index}].requiredCapabilityIds`,
          `Scenario '${scenario.id}' references unknown capability '${capabilityId}'.`,
        );
      }
    }
  }

  const proof = pack.originalProof;
  if (
    !validIdentifier(proof.showcaseId) ||
    proof.title.trim().length < 3 ||
    proof.originalAssetsOnly !== true ||
    proof.featuredSystems.length < 3 ||
    proof.note.trim().length < 20
  ) {
    packIssue(
      issues,
      "invalid-original-proof",
      "originalProof",
      "The original proof must retain a complete, explicit original-content boundary.",
    );
  }

  const missingBoundaryTerms = boundaryCoverage(pack);
  if (
    pack.redistributionBoundary.permitted.length < 3 ||
    pack.redistributionBoundary.prohibited.length < 5 ||
    missingBoundaryTerms.length > 0
  ) {
    packIssue(
      issues,
      "incomplete-redistribution-boundary",
      "redistributionBoundary",
      `The pack does not explicitly prohibit: ${
        missingBoundaryTerms.join(", ") || "all required commercial content classes"
      }.`,
    );
  }

  return issues;
};

export const validateAdventureReferenceTitlePacks = (
  packs: readonly AdventureReferenceTitlePack[],
): readonly AdventureReferencePackIssue[] => {
  const issues = packs.flatMap((pack) => validateAdventureReferenceTitlePack(pack));
  for (const field of ["id", "titleId"] as const) {
    for (const duplicate of duplicateValues(packs.map((pack) => pack[field]))) {
      packIssue(
        issues,
        "duplicate-id",
        field,
        `Reference pack ${field} '${duplicate}' is duplicated across the catalogue.`,
      );
    }
  }
  const variants = packs.flatMap((pack) => pack.variants.map((variant) => variant.id));
  for (const duplicate of duplicateValues(variants)) {
    packIssue(
      issues,
      "duplicate-id",
      "variants",
      `Reference variant '${duplicate}' is duplicated across the catalogue.`,
    );
  }
  return issues;
};
