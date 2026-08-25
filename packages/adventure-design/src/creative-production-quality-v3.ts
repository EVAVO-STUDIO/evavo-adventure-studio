import type {
  AdventureCreativeHandoffIssueV3,
  AdventureCreativeProductionSessionV3,
  AdventureCreativeReviewV3,
  AdventureCreativeWorkOrderV3,
} from "./creative-production-handoff-v3.js";

export interface AdventureCreativeAlphaEvidenceV3 {
  readonly evidenceVersion: 1;
  readonly artifactDigest: string;
  readonly decodedWidth: number;
  readonly decodedHeight: number;
  readonly totalPixels: number;
  readonly fullyTransparentPixels: number;
  readonly fullyOpaquePixels: number;
  readonly partialAlphaPixels: number;
  readonly checkerboardLikePixels: number;
  readonly matteResiduePixels: number;
  readonly haloPixels: number;
  readonly transparentRgbContaminatedPixels: number;
  readonly transparentCanvasEdge: boolean;
  readonly hostilePlateEvidenceDigests: readonly string[];
}

export interface AdventureCreativeFrameEvidenceV3 {
  readonly frameId: string;
  readonly artifactDigest: string;
  readonly exposureTicks: number;
  readonly modelSheetConformant: boolean;
  readonly styleConformant: boolean;
  readonly paletteConformant: boolean;
  readonly anchorConformant: boolean;
  readonly silhouetteConformant: boolean;
  readonly alphaConformant: boolean;
  readonly neighbourPairDigests: Readonly<Record<string, string>>;
}

export interface AdventureCreativeSequenceEvidenceV3 {
  readonly evidenceVersion: 1;
  readonly artifactDigest: string;
  readonly frameOrder: readonly string[];
  readonly frames: readonly AdventureCreativeFrameEvidenceV3[];
  readonly totalExposureTicks: number;
  readonly xSheetDigest: string;
  readonly modelSheetDigest: string;
  readonly loopClosureDigest?: string;
  readonly sequencePreviewDigest: string;
}

export interface AdventureCreativeIssueClosureEvidenceV3 {
  readonly issueId: string;
  readonly openedRevision: number;
  readonly closedRevision: number;
  readonly repairedCandidateDigest: string;
  readonly closureEvidenceDigest: string;
  readonly targetedRepair: boolean;
  readonly preservedFrameIds: readonly string[];
}

export interface AdventureCreativeStrictQualityEvidenceV3 {
  readonly qualityVersion: 1;
  readonly workOrderId: string;
  readonly revision: number;
  readonly candidateArtifactDigest: string;
  readonly styleEvidenceDigest: string;
  readonly authorityDigests: {
    readonly sourceRevisionDigest: string;
    readonly styleDigest: string;
    readonly paletteDigest?: string;
    readonly modelSheetDigest?: string;
    readonly environmentLayoutDigest?: string;
    readonly xSheetDigest?: string;
  };
  readonly alpha?: AdventureCreativeAlphaEvidenceV3;
  readonly sequence?: AdventureCreativeSequenceEvidenceV3;
  readonly issueClosures: readonly AdventureCreativeIssueClosureEvidenceV3[];
}

const animationKinds = new Set(["animation-sequence", "cutscene-shot", "effects-sequence"]);

const issue = (code: string, message: string): AdventureCreativeHandoffIssueV3 => ({ code, message });

const exactArray = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const authorityIssues = (
  order: AdventureCreativeWorkOrderV3,
  evidence: AdventureCreativeStrictQualityEvidenceV3,
): AdventureCreativeHandoffIssueV3[] => {
  const issues: AdventureCreativeHandoffIssueV3[] = [];
  const actual = evidence.authorityDigests;
  const expected = order.authorities;
  const pairs: readonly [string, string | undefined, string | undefined][] = [
    ["source-revision", actual.sourceRevisionDigest, order.sourceRevisionDigest],
    ["style", actual.styleDigest, expected.styleDigest],
    ["palette", actual.paletteDigest, expected.paletteDigest],
    ["model-sheet", actual.modelSheetDigest, expected.modelSheetDigest],
    ["environment-layout", actual.environmentLayoutDigest, expected.environmentLayoutDigest],
    ["x-sheet", actual.xSheetDigest, expected.xSheetDigest],
  ];
  for (const [name, value, required] of pairs) {
    if (value !== required) {
      issues.push(issue("strict-authority-drift", `${name} authority changed during creative revision ${order.revision}.`));
    }
  }
  return issues;
};

const validateAlphaEvidence = (
  order: AdventureCreativeWorkOrderV3,
  evidence: AdventureCreativeAlphaEvidenceV3 | undefined,
): AdventureCreativeHandoffIssueV3[] => {
  if (order.alphaPolicy === "opaque") return [];
  if (!evidence) return [issue("strict-alpha-evidence-missing", "Transparent creative work requires decoded pixel-level alpha evidence.")];
  const issues: AdventureCreativeHandoffIssueV3[] = [];
  if (evidence.artifactDigest.trim().length === 0) issues.push(issue("strict-alpha-digest-missing", "Alpha evidence must identify the exact candidate artifact."));
  if (evidence.decodedWidth !== order.nativeSize.width || evidence.decodedHeight !== order.nativeSize.height) {
    issues.push(issue("strict-alpha-size-mismatch", "Decoded alpha evidence dimensions must exactly match the authored native canvas."));
  }
  if (evidence.totalPixels !== evidence.decodedWidth * evidence.decodedHeight) {
    issues.push(issue("strict-alpha-pixel-count", "Alpha evidence total pixel count does not match decoded dimensions."));
  }
  if (evidence.fullyTransparentPixels <= 0) issues.push(issue("strict-no-transparent-pixels", "Transparent asset contains no genuinely transparent pixels."));
  if (order.alphaPolicy === "binary" && evidence.partialAlphaPixels !== 0) {
    issues.push(issue("strict-soft-alpha", "Binary-alpha work contains partial alpha pixels."));
  }
  const contamination = [
    ["checkerboard", evidence.checkerboardLikePixels],
    ["matte residue", evidence.matteResiduePixels],
    ["halo", evidence.haloPixels],
    ["transparent RGB contamination", evidence.transparentRgbContaminatedPixels],
  ] as const;
  for (const [label, count] of contamination) {
    if (count !== 0) issues.push(issue("strict-alpha-contamination", `Transparent asset contains ${count} ${label} pixel(s).`));
  }
  if (order.transparencyPolicy.transparentCanvasEdgeRequired && !evidence.transparentCanvasEdge) {
    issues.push(issue("strict-alpha-edge", "Transparent asset does not retain a genuinely transparent canvas edge."));
  }
  if (order.transparencyPolicy.hostilePlateReviewRequired && evidence.hostilePlateEvidenceDigests.length < 3) {
    issues.push(issue("strict-hostile-plate-evidence", "Transparent asset requires at least three hostile-plate review digests."));
  }
  return issues;
};

const validateSequenceEvidence = (
  order: AdventureCreativeWorkOrderV3,
  evidence: AdventureCreativeSequenceEvidenceV3 | undefined,
): AdventureCreativeHandoffIssueV3[] => {
  if (!animationKinds.has(order.taskKind)) return [];
  if (!evidence) return [issue("strict-sequence-evidence-missing", "Animation requires exact frame-by-frame sequence evidence.")];
  const plan = order.framePlan ?? [];
  const expectedIds = plan.map((frame) => frame.frameId);
  const issues: AdventureCreativeHandoffIssueV3[] = [];
  if (!exactArray(evidence.frameOrder, expectedIds)) {
    issues.push(issue("strict-frame-order", "Sequence evidence frame order must exactly match the authored frame plan."));
  }
  if (evidence.frames.length !== plan.length || new Set(evidence.frames.map((frame) => frame.frameId)).size !== plan.length) {
    issues.push(issue("strict-frame-coverage", "Sequence evidence must contain every authored frame exactly once."));
  }
  const frameEvidence = new Map(evidence.frames.map((frame) => [frame.frameId, frame] as const));
  let exposureTotal = 0;
  for (const frame of plan) {
    exposureTotal += frame.exposureTicks;
    const observed = frameEvidence.get(frame.frameId);
    if (!observed) continue;
    if (observed.exposureTicks !== frame.exposureTicks) issues.push(issue("strict-exposure-timing", `Frame '${frame.frameId}' exposure does not match the X-sheet.`));
    if (!observed.modelSheetConformant) issues.push(issue("strict-model-drift", `Frame '${frame.frameId}' does not conform to the approved model sheet.`));
    if (!observed.styleConformant || !observed.paletteConformant) issues.push(issue("strict-style-drift", `Frame '${frame.frameId}' drifts from approved style/palette authority.`));
    if (!observed.anchorConformant) issues.push(issue("strict-anchor-drift", `Frame '${frame.frameId}' violates authored pivot/foot/hand/shadow anchors.`));
    if (!observed.silhouetteConformant) issues.push(issue("strict-silhouette-drift", `Frame '${frame.frameId}' fails silhouette/model continuity review.`));
    if (order.alphaPolicy !== "opaque" && !observed.alphaConformant) issues.push(issue("strict-frame-alpha", `Frame '${frame.frameId}' fails alpha/edge review.`));
    for (const neighbourId of frame.requiredNeighbourFrameIds) {
      if (!observed.neighbourPairDigests[neighbourId]?.trim()) {
        issues.push(issue("strict-neighbour-evidence", `Frame '${frame.frameId}' lacks continuity evidence against neighbour '${neighbourId}'.`));
      }
    }
  }
  if (evidence.totalExposureTicks !== exposureTotal) issues.push(issue("strict-total-exposure", "Sequence total exposure duration does not match the authored X-sheet."));
  if (order.authorities.xSheetDigest && evidence.xSheetDigest !== order.authorities.xSheetDigest) issues.push(issue("strict-xsheet-drift", "Sequence evidence targets a different X-sheet authority."));
  if (order.authorities.modelSheetDigest && evidence.modelSheetDigest !== order.authorities.modelSheetDigest) issues.push(issue("strict-model-authority-drift", "Sequence evidence targets a different model-sheet authority."));
  if (order.sequencePolicy?.loopClosureReviewRequired && !evidence.loopClosureDigest?.trim()) {
    issues.push(issue("strict-loop-closure", "Looping animation requires explicit last-to-first closure evidence."));
  }
  if (!evidence.sequencePreviewDigest.trim()) issues.push(issue("strict-sequence-preview", "Animation requires a whole-sequence playback/flipbook evidence digest."));
  return issues;
};

const validateIssueClosures = (
  order: AdventureCreativeWorkOrderV3,
  review: AdventureCreativeReviewV3,
  evidence: AdventureCreativeStrictQualityEvidenceV3,
): AdventureCreativeHandoffIssueV3[] => {
  const issues: AdventureCreativeHandoffIssueV3[] = [];
  const reviewed = new Map(review.issues.map((entry) => [entry.issueId, entry] as const));
  const closures = new Map(evidence.issueClosures.map((entry) => [entry.issueId, entry] as const));
  const closed = new Set(review.closedIssueIds);
  for (const closedId of closed) {
    if (!reviewed.has(closedId) && !order.requestedRepairs.some((repair) => repair.issueId === closedId)) {
      issues.push(issue("strict-unknown-closed-issue", `Review closes unknown issue '${closedId}'.`));
    }
    const closure = closures.get(closedId);
    if (!closure?.closureEvidenceDigest.trim()) issues.push(issue("strict-closure-evidence", `Closed issue '${closedId}' has no closure evidence.`));
    if (closure && closure.closedRevision !== order.revision) issues.push(issue("strict-closure-revision", `Closed issue '${closedId}' is not tied to the current revision.`));
    if (closure && closure.repairedCandidateDigest !== evidence.candidateArtifactDigest) issues.push(issue("strict-closure-candidate", `Closed issue '${closedId}' does not reference the reviewed candidate.`));
  }
  return issues;
};

export const validateAdventureCreativeStrictQualityV3 = (
  order: AdventureCreativeWorkOrderV3,
  review: AdventureCreativeReviewV3,
  evidence: AdventureCreativeStrictQualityEvidenceV3,
): readonly AdventureCreativeHandoffIssueV3[] => {
  const issues: AdventureCreativeHandoffIssueV3[] = [];
  if (evidence.qualityVersion !== 1 || evidence.workOrderId !== order.workOrderId || evidence.revision !== order.revision) {
    issues.push(issue("strict-evidence-authority", "Strict quality evidence must target the exact work-order revision."));
  }
  if (evidence.candidateArtifactDigest !== review.candidateArtifactDigest) {
    issues.push(issue("strict-candidate-mismatch", "Strict quality evidence must describe the exact reviewed candidate bytes."));
  }
  if (!evidence.styleEvidenceDigest.trim()) issues.push(issue("strict-style-evidence", "Strict quality review requires style/construction evidence."));
  issues.push(...authorityIssues(order, evidence));
  issues.push(...validateAlphaEvidence(order, evidence.alpha));
  issues.push(...validateSequenceEvidence(order, evidence.sequence));
  issues.push(...validateIssueClosures(order, review, evidence));
  const openSerious = review.issues.filter(
    (entry) => entry.severity !== "minor" && !review.closedIssueIds.includes(entry.issueId),
  );
  if (review.disposition === "accepted" && openSerious.length > 0) {
    issues.push(issue("strict-accepted-with-serious-issues", "Strict acceptance cannot retain unresolved blocking or major review issues."));
  }
  return issues;
};

export const assertAdventureCreativeStrictQualityV3 = (
  order: AdventureCreativeWorkOrderV3,
  review: AdventureCreativeReviewV3,
  evidence: AdventureCreativeStrictQualityEvidenceV3,
): AdventureCreativeStrictQualityEvidenceV3 => {
  const issues = validateAdventureCreativeStrictQualityV3(order, review, evidence);
  if (issues.length > 0) throw new Error(issues.map((entry) => entry.message).join(" "));
  return evidence;
};
