export type AdventureAuthenticityDimension =
  | "native-canvas"
  | "palette-values"
  | "scene-composition"
  | "actor-performance"
  | "interface-identity"
  | "audio-identity"
  | "world-cohesion"
  | "puzzle-causality"
  | "cinematic-continuity"
  | "production-discipline";

export type AdventureAuthenticitySeverity = "error" | "warning" | "note";
export type AdventureAuthenticityStatus = "ready" | "attention" | "blocked";
export type AdventureAuthenticityGrade =
  | "production-ready"
  | "strong"
  | "developing"
  | "foundation";

export interface AdventureAuthenticityFinding {
  readonly id: string;
  readonly dimension: AdventureAuthenticityDimension;
  readonly severity: AdventureAuthenticitySeverity;
  readonly path: string;
  readonly message: string;
  readonly recommendation: string;
}

export interface AdventureAuthenticityDimensionResult {
  readonly id: AdventureAuthenticityDimension;
  readonly label: string;
  readonly score: number;
  readonly maximumScore: 10;
  readonly status: AdventureAuthenticityStatus;
  readonly findings: readonly AdventureAuthenticityFinding[];
}

export interface AdventureAuthenticityReport {
  readonly reportVersion: 1;
  readonly score: number;
  readonly maximumScore: 100;
  readonly grade: AdventureAuthenticityGrade;
  readonly status: AdventureAuthenticityStatus;
  readonly dimensions: readonly AdventureAuthenticityDimensionResult[];
  readonly findings: readonly AdventureAuthenticityFinding[];
}

export interface MutableAuthenticityDimension {
  readonly id: AdventureAuthenticityDimension;
  readonly label: string;
  score: number;
  readonly findings: AdventureAuthenticityFinding[];
}

const labels: Readonly<Record<AdventureAuthenticityDimension, string>> = {
  "native-canvas": "Native canvas",
  "palette-values": "Palette and values",
  "scene-composition": "Scene composition",
  "actor-performance": "Actor performance",
  "interface-identity": "Interface identity",
  "audio-identity": "Music and ambience",
  "world-cohesion": "World cohesion",
  "puzzle-causality": "Puzzle causality",
  "cinematic-continuity": "Cinematic continuity",
  "production-discipline": "Production discipline",
};

export const createAuthenticityDimension = (
  id: AdventureAuthenticityDimension,
): MutableAuthenticityDimension => ({
  id,
  label: labels[id],
  score: 0,
  findings: [],
});

export const addAuthenticityCheck = (
  dimension: MutableAuthenticityDimension,
  passed: boolean,
  points: number,
  finding: Omit<AdventureAuthenticityFinding, "dimension">,
): void => {
  if (passed) {
    dimension.score += points;
    return;
  }
  dimension.findings.push({ ...finding, dimension: dimension.id });
};

const statusFor = (
  score: number,
  findings: readonly AdventureAuthenticityFinding[],
): AdventureAuthenticityStatus => {
  if (findings.some((finding) => finding.severity === "error") || score < 5) {
    return "blocked";
  }
  if (findings.some((finding) => finding.severity === "warning") || score < 8) {
    return "attention";
  }
  return "ready";
};

export const finalizeAuthenticityDimension = (
  dimension: MutableAuthenticityDimension,
): AdventureAuthenticityDimensionResult => {
  const score = Math.min(10, dimension.score);
  const severityOrder = { error: 0, warning: 1, note: 2 } as const;
  return {
    id: dimension.id,
    label: dimension.label,
    score,
    maximumScore: 10,
    status: statusFor(score, dimension.findings),
    findings: [...dimension.findings].sort(
      (left, right) =>
        severityOrder[left.severity] - severityOrder[right.severity] ||
        left.path.localeCompare(right.path) ||
        left.id.localeCompare(right.id),
    ),
  };
};
