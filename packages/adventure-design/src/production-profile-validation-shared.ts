import type {
  AdventureProductionProfileIssue,
  AdventureProductionProfileSeverity,
} from "./production-profile-types.js";

export const severityOrder: Readonly<Record<AdventureProductionProfileSeverity, number>> = {
  error: 0,
  warning: 1,
  note: 2,
};

export const issue = (
  severity: AdventureProductionProfileSeverity,
  code: AdventureProductionProfileIssue["code"],
  path: string,
  message: string,
  recommendation: string,
): AdventureProductionProfileIssue => ({
  severity,
  code,
  path,
  message,
  recommendation,
});

export const duplicates = <T extends string>(values: readonly T[]): readonly T[] => {
  const seen = new Set<T>();
  const repeated = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort((left, right) => left.localeCompare(right));
};

export const hexColour = /^#[0-9a-f]{6}$/i;

export const validateStringList = (
  values: readonly string[],
  path: string,
  minimum: number,
  findings: AdventureProductionProfileIssue[],
): void => {
  if (values.length < minimum) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        path,
        `${path} requires at least ${minimum} authored entries.`,
        "Add specific production guidance rather than relying on a genre label.",
      ),
    );
  }
  values.forEach((value, index) => {
    if (value.trim().length === 0) {
      findings.push(
        issue(
          "error",
          "invalid-profile",
          `${path}[${index}]`,
          "Production guidance cannot be empty.",
          "Write a concrete, testable production rule.",
        ),
      );
    }
  });
};
