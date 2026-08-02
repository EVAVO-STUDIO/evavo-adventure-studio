import {
  adventureSceneStagingSeverityOrder,
  type AdventureSceneStagingArea,
  type AdventureSceneStagingFinding,
  type AdventureSceneStagingSeverity,
} from "./scene-staging-types.js";

export interface AdventureSceneStagingFindingInput {
  readonly id: string;
  readonly area: AdventureSceneStagingArea;
  readonly severity: AdventureSceneStagingSeverity;
  readonly impact: number;
  readonly path: string;
  readonly message: string;
  readonly recommendation: string;
}

export const addSceneStagingFinding = (
  findings: AdventureSceneStagingFinding[],
  input: AdventureSceneStagingFindingInput,
): void => {
  findings.push({ ...input, impact: Math.max(0, Math.round(input.impact)) });
};

export const uniqueSortedSceneStagingFindings = (
  findings: readonly AdventureSceneStagingFinding[],
): readonly AdventureSceneStagingFinding[] => {
  const unique = new Map<string, AdventureSceneStagingFinding>();
  for (const finding of findings) {
    unique.set(
      [finding.id, finding.area, finding.path, finding.message].join("|"),
      finding,
    );
  }
  return [...unique.values()].sort(
    (left, right) =>
      adventureSceneStagingSeverityOrder[left.severity] -
        adventureSceneStagingSeverityOrder[right.severity] ||
      left.area.localeCompare(right.area) ||
      left.path.localeCompare(right.path) ||
      left.id.localeCompare(right.id),
  );
};
