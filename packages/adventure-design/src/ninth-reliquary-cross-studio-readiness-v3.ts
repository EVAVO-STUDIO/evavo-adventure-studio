import { validateAdventureCreativeDeliveryAdmissionV3 } from "./creative-production-admission-v3.js";
import {
  ADVENTURE_CREATIVE_CONFORMANCE_V3_FINGERPRINT,
  adventureCreativeConformanceAnimationOrderV3,
  adventureCreativeConformanceFingerprintV3,
  adventureCreativeConformanceStaticOrderV3,
} from "./creative-production-conformance-v3.js";
import type {
  AdventureCreativeAcceptedDeliveryV3,
  AdventureCreativeReviewV3,
} from "./creative-production-handoff-v3.js";
import type { AdventureCreativeStrictQualityEvidenceV3 } from "./creative-production-quality-v3.js";

export interface NinthReliquaryCrossStudioDeliveryEvidenceV3 {
  readonly review: AdventureCreativeReviewV3;
  readonly quality: AdventureCreativeStrictQualityEvidenceV3;
  readonly delivery: AdventureCreativeAcceptedDeliveryV3;
}

export interface NinthReliquaryCrossStudioReadinessInputV3 {
  readonly artStudioConformanceFingerprint: string;
  readonly celAnimationStudioConformanceFingerprint: string;
  readonly staticForeground: NinthReliquaryCrossStudioDeliveryEvidenceV3;
  readonly maraWalk: NinthReliquaryCrossStudioDeliveryEvidenceV3;
}

export interface NinthReliquaryCrossStudioReadinessIssueV3 {
  readonly area: "protocol" | "art-studio" | "cel-animation-studio";
  readonly code: string;
  readonly message: string;
}

export interface NinthReliquaryCrossStudioReadinessV3 {
  readonly readinessVersion: 1;
  readonly profileId: "cinematic-handdrawn-conspiracy";
  readonly showcaseId: "showcase.ninth-reliquary";
  readonly conformanceFingerprint: string;
  readonly artStudioReady: boolean;
  readonly celAnimationStudioReady: boolean;
  readonly ready: boolean;
  readonly issues: readonly NinthReliquaryCrossStudioReadinessIssueV3[];
}

const fingerprintIssues = (
  area: "art-studio" | "cel-animation-studio",
  actual: string,
): readonly NinthReliquaryCrossStudioReadinessIssueV3[] =>
  actual === ADVENTURE_CREATIVE_CONFORMANCE_V3_FINGERPRINT
    ? []
    : [
        {
          area: "protocol",
          code: `${area}-conformance-mismatch`,
          message: `${area} reports conformance fingerprint '${actual}', expected '${ADVENTURE_CREATIVE_CONFORMANCE_V3_FINGERPRINT}'.`,
        },
      ];

export const evaluateNinthReliquaryCrossStudioReadinessV3 = (
  input: NinthReliquaryCrossStudioReadinessInputV3,
): NinthReliquaryCrossStudioReadinessV3 => {
  const issues: NinthReliquaryCrossStudioReadinessIssueV3[] = [];
  const localFingerprint = adventureCreativeConformanceFingerprintV3();
  if (localFingerprint !== ADVENTURE_CREATIVE_CONFORMANCE_V3_FINGERPRINT) {
    issues.push({
      area: "protocol",
      code: "adventure-studio-conformance-mismatch",
      message: `Adventure Studio conformance fingerprint '${localFingerprint}' differs from its governed constant '${ADVENTURE_CREATIVE_CONFORMANCE_V3_FINGERPRINT}'.`,
    });
  }
  issues.push(
    ...fingerprintIssues("art-studio", input.artStudioConformanceFingerprint),
    ...fingerprintIssues("cel-animation-studio", input.celAnimationStudioConformanceFingerprint),
  );

  for (const issue of validateAdventureCreativeDeliveryAdmissionV3(
    adventureCreativeConformanceStaticOrderV3,
    input.staticForeground.review,
    input.staticForeground.quality,
    input.staticForeground.delivery,
  )) {
    issues.push({ area: "art-studio", code: issue.code, message: issue.message });
  }
  for (const issue of validateAdventureCreativeDeliveryAdmissionV3(
    adventureCreativeConformanceAnimationOrderV3,
    input.maraWalk.review,
    input.maraWalk.quality,
    input.maraWalk.delivery,
  )) {
    issues.push({ area: "cel-animation-studio", code: issue.code, message: issue.message });
  }

  const ordered = issues.sort(
    (left, right) => left.area.localeCompare(right.area) || left.code.localeCompare(right.code) || left.message.localeCompare(right.message),
  );
  const artStudioReady = !ordered.some((issue) => issue.area === "art-studio" || issue.code === "art-studio-conformance-mismatch");
  const celAnimationStudioReady = !ordered.some(
    (issue) => issue.area === "cel-animation-studio" || issue.code === "cel-animation-studio-conformance-mismatch",
  );
  return {
    readinessVersion: 1,
    profileId: "cinematic-handdrawn-conspiracy",
    showcaseId: "showcase.ninth-reliquary",
    conformanceFingerprint: ADVENTURE_CREATIVE_CONFORMANCE_V3_FINGERPRINT,
    artStudioReady,
    celAnimationStudioReady,
    ready: ordered.length === 0 && artStudioReady && celAnimationStudioReady,
    issues: ordered,
  };
};
