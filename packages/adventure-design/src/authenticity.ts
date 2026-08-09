import { evaluateAdventureDesignDimensions } from "./authenticity-design.js";
import { evaluateAdventureFoundationDimensions } from "./authenticity-foundation.js";
import {
  type AdventureAuthenticityDimension,
  type AdventureAuthenticityGrade,
  type AdventureAuthenticityReport,
  type AdventureAuthenticityStatus,
  finalizeAuthenticityDimension,
} from "./authenticity-types.js";
import type { AdventureDesignDocument } from "./types.js";

export * from "./authenticity-types.js";
export * from "./scene-production.js";

const orderedIds: readonly AdventureAuthenticityDimension[] = [
  "native-canvas",
  "palette-values",
  "scene-composition",
  "actor-performance",
  "interface-identity",
  "audio-identity",
  "world-cohesion",
  "puzzle-causality",
  "cinematic-continuity",
  "production-discipline",
];

export const evaluateAdventureAuthenticity = (
  document: AdventureDesignDocument,
): AdventureAuthenticityReport => {
  const mutable = [
    ...evaluateAdventureFoundationDimensions(document),
    ...evaluateAdventureDesignDimensions(document),
  ];
  const byId = new Map(mutable.map((dimension) => [dimension.id, dimension] as const));
  const dimensions = orderedIds.map((id) => {
    const dimension = byId.get(id);
    if (!dimension) throw new Error(`Authenticity dimension '${id}' was not evaluated.`);
    return finalizeAuthenticityDimension(dimension);
  });
  const score = dimensions.reduce((total, dimension) => total + dimension.score, 0);
  const findings = dimensions.flatMap((dimension) => dimension.findings);
  const status: AdventureAuthenticityStatus = dimensions.some((dimension) => dimension.status === "blocked")
    ? "blocked"
    : dimensions.some((dimension) => dimension.status === "attention")
      ? "attention"
      : "ready";
  const grade: AdventureAuthenticityGrade =
    score >= 90 && status === "ready"
      ? "production-ready"
      : score >= 80
        ? "strong"
        : score >= 65
          ? "developing"
          : "foundation";

  return {
    reportVersion: 1,
    score,
    maximumScore: 100,
    grade,
    status,
    dimensions,
    findings,
  };
};
