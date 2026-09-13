import type { Id } from "@evavo/adventure-project-schema";
import type {
  ArtAtlasPageVisualEvidence,
  ArtVisualEvidenceManifest,
  ArtVisualEvidenceRecord,
  ImageAlphaMode,
} from "./evidence.js";

export type PeriodVgaAssetRole = "background" | "sprite" | "interface" | "overlay" | "other";

export interface PeriodVgaNativeReview {
  readonly assetId: Id<"asset">;
  readonly role: PeriodVgaAssetRole;
  readonly reviewedAtOneToOne: boolean;
  readonly reviewedAtIntegerScale: boolean;
  readonly periodPlausibilityApproved: boolean;
  readonly clusterDisciplineApproved: boolean;
  readonly outlineDisciplineApproved: boolean;
  readonly ditherDisciplineApproved: boolean;
  readonly modernEffectsAbsent: boolean;
  readonly syntheticMicrotextureAbsent: boolean;
  readonly notes: string;
}

export type PeriodVgaAuditIssueCode =
  | "missing-native-review"
  | "non-indexed-output"
  | "colour-budget-exceeded"
  | "soft-alpha"
  | "background-alpha"
  | "native-review-missing"
  | "integer-review-missing"
  | "period-plausibility-failed"
  | "cluster-discipline-failed"
  | "outline-discipline-failed"
  | "dither-discipline-failed"
  | "modern-effects-present"
  | "synthetic-microtexture-present"
  | "review-notes-missing";

export interface PeriodVgaAuditIssue {
  readonly severity: "error" | "warning";
  readonly code: PeriodVgaAuditIssueCode;
  readonly assetId: Id<"asset">;
  readonly path: string;
  readonly message: string;
}

export interface PeriodVgaAuditReport {
  readonly reportVersion: 1;
  readonly projectId: Id<"project">;
  readonly status: "ready" | "attention" | "blocked";
  readonly score: number;
  readonly maximumScore: 100;
  readonly reviewedAssets: number;
  readonly evidenceAssets: number;
  readonly issues: readonly PeriodVgaAuditIssue[];
}

const addIssue = (
  issues: PeriodVgaAuditIssue[],
  severity: PeriodVgaAuditIssue["severity"],
  code: PeriodVgaAuditIssueCode,
  assetId: Id<"asset">,
  path: string,
  message: string,
): void => {
  issues.push({ severity, code, assetId, path, message });
};

const pixelEvidenceFor = (
  record: ArtVisualEvidenceRecord,
): readonly {
  readonly label: string;
  readonly palette: boolean;
  readonly colourCount: number;
  readonly alphaMode: ImageAlphaMode;
}[] =>
  record.kind === "image"
    ? [
        {
          label: String(record.assetId),
          palette: record.palette,
          colourCount: record.colourCount,
          alphaMode: record.alphaMode,
        },
      ]
    : record.pages.map((page: ArtAtlasPageVisualEvidence) => ({
        label: `${record.assetId}/${page.outputRole}`,
        palette: page.palette,
        colourCount: page.colourCount,
        alphaMode: page.alphaMode,
      }));

const validatePixels = (
  record: ArtVisualEvidenceRecord,
  review: PeriodVgaNativeReview | undefined,
  issues: PeriodVgaAuditIssue[],
): void => {
  for (const evidence of pixelEvidenceFor(record)) {
    if (!evidence.palette) {
      addIssue(
        issues,
        "error",
        "non-indexed-output",
        record.assetId,
        evidence.label,
        "Period VGA proof requires an indexed output rather than an RGBA final frame.",
      );
    }
    if (evidence.colourCount > 256) {
      addIssue(
        issues,
        "error",
        "colour-budget-exceeded",
        record.assetId,
        evidence.label,
        `Output uses ${evidence.colourCount} colours; a VGA proof may use at most 256.`,
      );
    }
    if (evidence.alphaMode === "full") {
      addIssue(
        issues,
        "error",
        "soft-alpha",
        record.assetId,
        evidence.label,
        "Soft alpha is not accepted for period VGA proof; use opaque or binary/transparency-index edges.",
      );
    }
    if (review?.role === "background" && evidence.alphaMode !== "opaque") {
      addIssue(
        issues,
        "error",
        "background-alpha",
        record.assetId,
        evidence.label,
        "Background proof must be fully opaque at final native resolution.",
      );
    }
  }
};

const validateReview = (
  record: ArtVisualEvidenceRecord,
  review: PeriodVgaNativeReview | undefined,
  issues: PeriodVgaAuditIssue[],
): void => {
  if (!review) {
    addIssue(
      issues,
      "error",
      "missing-native-review",
      record.assetId,
      `reviews.${record.assetId}`,
      "No retained native-art review exists for this compiled visual asset.",
    );
    return;
  }

  const checks: readonly [
    keyof Pick<
      PeriodVgaNativeReview,
      | "reviewedAtOneToOne"
      | "reviewedAtIntegerScale"
      | "periodPlausibilityApproved"
      | "clusterDisciplineApproved"
      | "outlineDisciplineApproved"
      | "ditherDisciplineApproved"
      | "modernEffectsAbsent"
      | "syntheticMicrotextureAbsent"
    >,
    PeriodVgaAuditIssueCode,
    string,
  ][] = [
    ["reviewedAtOneToOne", "native-review-missing", "Raw 1× native pixels were not reviewed."],
    ["reviewedAtIntegerScale", "integer-review-missing", "Nearest-neighbour integer presentation was not reviewed."],
    ["periodPlausibilityApproved", "period-plausibility-failed", "Frame does not plausibly read as professional 1990–1994 VGA production."],
    ["clusterDisciplineApproved", "cluster-discipline-failed", "Pixel clusters or edge density read as noisy modern microdetail instead of authored VGA forms."],
    ["outlineDisciplineApproved", "outline-discipline-failed", "Universal or mechanically uniform outlines flatten material and depth separation."],
    ["ditherDisciplineApproved", "dither-discipline-failed", "Dithering is indiscriminate, decorative or disconnected from material/value transitions."],
    ["modernEffectsAbsent", "modern-effects-present", "Modern bloom, blur, chromatic aberration, soft glow, fractional filtering or baked CRT treatment is present."],
    ["syntheticMicrotextureAbsent", "synthetic-microtexture-present", "Synthetic/AI-like microtexture or isolated-pixel noise remains in the final native asset."],
  ];

  for (const [field, code, message] of checks) {
    if (!review[field]) {
      addIssue(issues, "error", code, record.assetId, `reviews.${record.assetId}.${field}`, message);
    }
  }

  if (review.notes.trim().length < 24) {
    addIssue(
      issues,
      "warning",
      "review-notes-missing",
      record.assetId,
      `reviews.${record.assetId}.notes`,
      "Retain a short art-director note describing what was checked at native scale.",
    );
  }
};

export const auditPeriodVgaProduction = (
  evidence: ArtVisualEvidenceManifest,
  reviews: readonly PeriodVgaNativeReview[],
): PeriodVgaAuditReport => {
  const reviewByAsset = new Map(reviews.map((review) => [review.assetId as string, review] as const));
  const issues: PeriodVgaAuditIssue[] = [];

  for (const record of evidence.assets) {
    const review = reviewByAsset.get(record.assetId);
    validatePixels(record, review, issues);
    validateReview(record, review, issues);
  }

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.length - errorCount;
  const score = Math.max(0, 100 - errorCount * 10 - warningCount * 2);
  const status: PeriodVgaAuditReport["status"] =
    errorCount > 0 ? "blocked" : warningCount > 0 ? "attention" : "ready";

  return {
    reportVersion: 1,
    projectId: evidence.projectId,
    status,
    score,
    maximumScore: 100,
    reviewedAssets: evidence.assets.filter((record) => reviewByAsset.has(record.assetId)).length,
    evidenceAssets: evidence.assets.length,
    issues: issues.sort(
      (left, right) =>
        left.assetId.localeCompare(right.assetId) ||
        left.path.localeCompare(right.path) ||
        left.code.localeCompare(right.code),
    ),
  };
};
