import { describe, expect, it } from "vitest";
import type { ArtVisualEvidenceManifest } from "../src/evidence.js";
import { auditPeriodVgaProduction, type PeriodVgaNativeReview } from "../src/period-vga-audit.js";

const evidence: ArtVisualEvidenceManifest = {
  manifestVersion: 1,
  projectId: "project.period-vga-audit",
  compilerVersion: "test",
  assets: [
    {
      assetId: "asset.background.station",
      kind: "image",
      palette: true,
      colourCount: 147,
      alphaMode: "opaque",
    },
    {
      assetId: "asset.actor.officer",
      kind: "spritesheet",
      pages: [
        {
          outputRole: "page-000",
          palette: true,
          colourCount: 96,
          alphaMode: "binary",
        },
      ],
    },
  ],
};

const approvedReview = (
  assetId: PeriodVgaNativeReview["assetId"],
  role: PeriodVgaNativeReview["role"],
): PeriodVgaNativeReview => ({
  assetId,
  role,
  reviewedAtOneToOne: true,
  reviewedAtIntegerScale: true,
  periodPlausibilityApproved: true,
  clusterDisciplineApproved: true,
  outlineDisciplineApproved: true,
  ditherDisciplineApproved: true,
  modernEffectsAbsent: true,
  syntheticMicrotextureAbsent: true,
  notes: "Reviewed raw native pixels and nearest-neighbour presentation against the profile art doctrine.",
});

describe("period VGA production audit", () => {
  it("accepts indexed native art only when both pixel evidence and retained art review agree", () => {
    const report = auditPeriodVgaProduction(evidence, [
      approvedReview("asset.background.station", "background"),
      approvedReview("asset.actor.officer", "sprite"),
    ]);

    expect(report).toMatchObject({
      status: "ready",
      score: 100,
      evidenceAssets: 2,
      reviewedAssets: 2,
      issues: [],
    });
  });

  it("blocks technically retro output that still fails period-production review", () => {
    const badEvidence: ArtVisualEvidenceManifest = {
      ...evidence,
      assets: [
        {
          assetId: "asset.background.station",
          kind: "image",
          palette: false,
          colourCount: 512,
          alphaMode: "full",
        },
      ],
    };
    const review: PeriodVgaNativeReview = {
      ...approvedReview("asset.background.station", "background"),
      periodPlausibilityApproved: false,
      clusterDisciplineApproved: false,
      outlineDisciplineApproved: false,
      ditherDisciplineApproved: false,
      modernEffectsAbsent: false,
      syntheticMicrotextureAbsent: false,
    };

    const report = auditPeriodVgaProduction(badEvidence, [review]);
    const codes = new Set(report.issues.map((issue) => issue.code));

    expect(report.status).toBe("blocked");
    for (const code of [
      "non-indexed-output",
      "colour-budget-exceeded",
      "soft-alpha",
      "background-alpha",
      "period-plausibility-failed",
      "cluster-discipline-failed",
      "outline-discipline-failed",
      "dither-discipline-failed",
      "modern-effects-present",
      "synthetic-microtexture-present",
    ] as const) {
      expect(codes.has(code)).toBe(true);
    }
  });

  it("fails closed when no native art-director review is retained", () => {
    const report = auditPeriodVgaProduction(evidence, []);
    expect(report.status).toBe("blocked");
    expect(report.issues.filter((issue) => issue.code === "missing-native-review")).toHaveLength(2);
  });
});
