import {
  nextAdventureCreativeRepairOrderV3,
  type AdventureCreativeReviewIssueV3,
  type AdventureCreativeReviewV3,
  type AdventureCreativeWorkOrderV3,
} from "./creative-production-handoff-v3.js";
import {
  validateAdventureCreativeStrictQualityV3,
  type AdventureCreativeFrameEvidenceV3,
  type AdventureCreativeStrictQualityEvidenceV3,
} from "./creative-production-quality-v3.js";

export interface AdventureCreativeAutomatedReviewV3 {
  readonly review: AdventureCreativeReviewV3;
  readonly repairOrder: AdventureCreativeWorkOrderV3 | null;
  readonly issueCount: number;
  readonly blockingIssueCount: number;
  readonly majorIssueCount: number;
}

const issueId = (
  order: AdventureCreativeWorkOrderV3,
  code: string,
  frameId?: string,
): string =>
  `quality.${order.revision}.${code}.${frameId ?? "asset"}`.replace(/[^A-Za-z0-9._-]+/gu, "-");

const repairText = (code: string, frameId?: string): string => {
  const target = frameId ? `frame '${frameId}'` : "the affected asset region";
  switch (code) {
    case "alpha-contamination":
      return `Repair real transparency on ${target}: remove checkerboard/matte/halo/hidden-RGB contamination while preserving approved opaque pixels and registration.`;
    case "alpha-edge":
      return `Restore genuinely transparent canvas edge pixels on ${target} without moving or repainting approved content.`;
    case "frame-alpha":
      return `Repair decoded alpha/edge cleanup on ${target} only; preserve pose, line, colour and timing.`;
    case "model-drift":
      return `Repair model-sheet construction on ${target} only; preserve approved pose, timing, anchors and unaffected drawings.`;
    case "style-drift":
      return `Repair style/palette drift on ${target} against immutable authorities; preserve composition, pose and timing.`;
    case "anchor-drift":
      return `Restore authored pivot/foot/hand/shadow anchors on ${target} without redesigning the drawing.`;
    case "silhouette-drift":
      return `Repair silhouette/proportion continuity on ${target}; preserve approved identity, exposure and neighbouring frames.`;
    case "exposure-timing":
      return `Restore the authored X-sheet exposure for ${target}; do not redraw approved pixels to solve a timing-only defect.`;
    case "neighbour-continuity":
      return `Repair continuity between ${target} and its required neighbour drawing(s), preserving all unaffected frames.`;
    case "loop-closure":
      return "Repair only the last-to-first loop seam while preserving the accepted internal sequence timing and drawings.";
    case "authority-drift":
      return "Rebind the candidate to the immutable source/style/palette/model/layout/X-sheet authorities; do not reinterpret the approved design.";
    default:
      return `Repair ${target} only and preserve every unaffected approved frame/region.`;
  }
};

const reviewIssue = (
  order: AdventureCreativeWorkOrderV3,
  code: string,
  severity: AdventureCreativeReviewIssueV3["severity"],
  message: string,
  frameIds: readonly string[] = [],
  evidenceDigests: readonly string[] = [],
): AdventureCreativeReviewIssueV3 => ({
  issueId: issueId(order, code, frameIds[0]),
  code:
    code === "model-drift"
      ? "identity-drift"
      : code === "style-drift"
        ? "style-drift"
        : code === "anchor-drift"
          ? "anchor-drift"
          : code === "silhouette-drift"
            ? "silhouette-drift"
            : code === "exposure-timing"
              ? "exposure-timing-mismatch"
              : code === "neighbour-continuity"
                ? "neighbour-continuity-mismatch"
                : code === "loop-closure"
                  ? "loop-closure-mismatch"
                  : code === "alpha-contamination"
                    ? "transparent-rgb-contamination"
                    : code === "alpha-edge" || code === "frame-alpha"
                      ? "missing-real-alpha"
                      : code === "authority-drift"
                        ? "reference-authority-mismatch"
                        : "source-byte-mismatch",
  severity,
  message,
  frameIds,
  evidenceDigests,
  suggestedRepair: repairText(code, frameIds[0]),
});

const frameIssues = (
  order: AdventureCreativeWorkOrderV3,
  frame: AdventureCreativeFrameEvidenceV3,
  expectedExposure: number,
  expectedNeighbours: readonly string[],
): AdventureCreativeReviewIssueV3[] => {
  const issues: AdventureCreativeReviewIssueV3[] = [];
  const evidence = frame.artifactDigest ? [frame.artifactDigest] : [];
  if (frame.exposureTicks !== expectedExposure) {
    issues.push(
      reviewIssue(
        order,
        "exposure-timing",
        "blocking",
        `Frame '${frame.frameId}' exposure is ${frame.exposureTicks} tick(s), expected ${expectedExposure}.`,
        [frame.frameId],
        evidence,
      ),
    );
  }
  if (!frame.modelSheetConformant) {
    issues.push(reviewIssue(order, "model-drift", "major", `Frame '${frame.frameId}' drifts from approved character construction.`, [frame.frameId], evidence));
  }
  if (!frame.styleConformant || !frame.paletteConformant) {
    issues.push(reviewIssue(order, "style-drift", "major", `Frame '${frame.frameId}' drifts from the approved style/palette authority.`, [frame.frameId], evidence));
  }
  if (!frame.anchorConformant) {
    issues.push(reviewIssue(order, "anchor-drift", "major", `Frame '${frame.frameId}' violates authored anchor geometry.`, [frame.frameId], evidence));
  }
  if (!frame.silhouetteConformant) {
    issues.push(reviewIssue(order, "silhouette-drift", "major", `Frame '${frame.frameId}' breaks silhouette/proportion continuity.`, [frame.frameId], evidence));
  }
  if (order.alphaPolicy !== "opaque" && !frame.alphaConformant) {
    issues.push(reviewIssue(order, "frame-alpha", "blocking", `Frame '${frame.frameId}' fails transparent edge/alpha review.`, [frame.frameId], evidence));
  }
  const missingNeighbours = expectedNeighbours.filter(
    (neighbour) => !frame.neighbourPairDigests[neighbour]?.trim(),
  );
  if (missingNeighbours.length > 0) {
    issues.push(
      reviewIssue(
        order,
        "neighbour-continuity",
        "major",
        `Frame '${frame.frameId}' lacks approved continuity evidence against ${missingNeighbours.join(", ")}.`,
        [frame.frameId],
        missingNeighbours.map((neighbour) => `missing:${neighbour}`),
      ),
    );
  }
  return issues;
};

const authorityDrifted = (
  order: AdventureCreativeWorkOrderV3,
  evidence: AdventureCreativeStrictQualityEvidenceV3,
): boolean => {
  const actual = evidence.authorityDigests;
  const expected = order.authorities;
  return (
    actual.sourceRevisionDigest !== order.sourceRevisionDigest ||
    actual.styleDigest !== expected.styleDigest ||
    actual.paletteDigest !== expected.paletteDigest ||
    actual.modelSheetDigest !== expected.modelSheetDigest ||
    actual.environmentLayoutDigest !== expected.environmentLayoutDigest ||
    actual.xSheetDigest !== expected.xSheetDigest
  );
};

export const createAdventureCreativeAutomatedReviewV3 = (
  order: AdventureCreativeWorkOrderV3,
  evidence: AdventureCreativeStrictQualityEvidenceV3,
  reviewerEvidenceDigest: string,
): AdventureCreativeAutomatedReviewV3 => {
  if (!reviewerEvidenceDigest.trim()) throw new Error("Automated creative review requires reviewer evidence digest.");
  if (evidence.workOrderId !== order.workOrderId || evidence.revision !== order.revision) {
    throw new Error("Automated creative review evidence targets the wrong work-order revision.");
  }
  const issues: AdventureCreativeReviewIssueV3[] = [];
  if (authorityDrifted(order, evidence)) {
    issues.push(
      reviewIssue(
        order,
        "authority-drift",
        "blocking",
        "Candidate evidence is bound to stale or changed source/style/palette/model/layout/X-sheet authority.",
      ),
    );
  }

  if (order.alphaPolicy !== "opaque") {
    const alpha = evidence.alpha;
    if (!alpha) {
      issues.push(reviewIssue(order, "alpha-contamination", "blocking", "Transparent candidate has no decoded alpha evidence."));
    } else {
      const contamination =
        alpha.checkerboardLikePixels +
        alpha.matteResiduePixels +
        alpha.haloPixels +
        alpha.transparentRgbContaminatedPixels;
      if (contamination > 0 || alpha.fullyTransparentPixels <= 0 || (order.alphaPolicy === "binary" && alpha.partialAlphaPixels > 0)) {
        issues.push(
          reviewIssue(
            order,
            "alpha-contamination",
            "blocking",
            `Transparent candidate fails decoded alpha truth (${contamination} contamination pixel(s), ${alpha.partialAlphaPixels} partial-alpha pixel(s)).`,
            [],
            [alpha.artifactDigest],
          ),
        );
      }
      if (order.transparencyPolicy.transparentCanvasEdgeRequired && !alpha.transparentCanvasEdge) {
        issues.push(reviewIssue(order, "alpha-edge", "blocking", "Transparent candidate lacks a genuinely transparent canvas edge.", [], [alpha.artifactDigest]));
      }
    }
  }

  const plan = order.framePlan ?? [];
  const sequence = evidence.sequence;
  if (plan.length > 0) {
    if (!sequence || sequence.frameOrder.length !== plan.length || !plan.every((frame, index) => sequence.frameOrder[index] === frame.frameId)) {
      issues.push(reviewIssue(order, "frame-coverage", "blocking", "Candidate frame coverage/order does not exactly match the authored sequence plan."));
    }
    const byId = new Map(sequence?.frames.map((frame) => [frame.frameId, frame] as const) ?? []);
    for (const planned of plan) {
      const observed = byId.get(planned.frameId);
      if (!observed) {
        issues.push(reviewIssue(order, "frame-coverage", "blocking", `Authored frame '${planned.frameId}' is missing from candidate evidence.`, [planned.frameId]));
        continue;
      }
      issues.push(...frameIssues(order, observed, planned.exposureTicks, planned.requiredNeighbourFrameIds));
    }
    if (order.sequencePolicy?.loopClosureReviewRequired && !sequence?.loopClosureDigest?.trim()) {
      const seamFrames = plan.length > 1 ? [plan[plan.length - 1]!.frameId, plan[0]!.frameId] : [];
      issues.push(reviewIssue(order, "loop-closure", "major", "Looping sequence lacks explicit last-to-first closure evidence.", seamFrames));
    }
  }

  let disposition: AdventureCreativeReviewV3["disposition"] =
    issues.some((entry) => entry.severity === "blocking" || entry.severity === "major")
      ? "repair-required"
      : "accepted";
  let review: AdventureCreativeReviewV3 = {
    reviewVersion: 3,
    workOrderId: order.workOrderId,
    revision: order.revision,
    candidateArtifactDigest: evidence.candidateArtifactDigest,
    disposition,
    issues,
    closedIssueIds: [],
    ...(evidence.alpha ? { alphaEvidenceDigest: evidence.alpha.artifactDigest } : {}),
    ...(evidence.sequence ? { sequenceEvidenceDigest: evidence.sequence.sequencePreviewDigest } : {}),
    styleEvidenceDigest: evidence.styleEvidenceDigest,
    reviewerEvidenceDigest,
  };

  const strictIssues = validateAdventureCreativeStrictQualityV3(order, review, evidence);
  const knownMessages = new Set(issues.map((entry) => entry.message));
  for (const strict of strictIssues) {
    if (knownMessages.has(strict.message)) continue;
    issues.push(
      reviewIssue(
        order,
        `strict-${strict.code}`,
        "blocking",
        strict.message,
        [],
        [evidence.candidateArtifactDigest],
      ),
    );
    knownMessages.add(strict.message);
  }
  if (issues.some((entry) => entry.severity === "blocking" || entry.severity === "major")) {
    disposition = "repair-required";
    review = { ...review, disposition, issues };
  }

  const repairOrder = disposition === "repair-required"
    ? nextAdventureCreativeRepairOrderV3(order, review)
    : null;
  return {
    review,
    repairOrder,
    issueCount: issues.length,
    blockingIssueCount: issues.filter((entry) => entry.severity === "blocking").length,
    majorIssueCount: issues.filter((entry) => entry.severity === "major").length,
  };
};
