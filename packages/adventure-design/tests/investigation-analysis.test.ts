import { describe, expect, it } from "vitest";
import { analyzeInvestigationManifest } from "../src/investigation-analysis.js";
import { redLedgerInvestigationProof } from "../src/red-ledger-investigation-proof.js";

describe("investigation reachability analysis", () => {
  it("proves the original Red Ledger required investigation chain can advance", () => {
    const report = analyzeInvestigationManifest(redLedgerInvestigationProof);
    expect(report.ready).toBe(true);
    expect(report.reachedChapterIds).toEqual([
      "chapter.red-ledger.day-1",
      "chapter.red-ledger.day-2",
    ]);
    expect(report.reachedFactIds).toEqual(
      expect.arrayContaining([
        "fact.red-ledger.shipping-mark",
        "fact.red-ledger.alias",
        "fact.red-ledger.witness-contradiction",
      ]),
    );
    expect(report.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("reports a chapter deadlock when a required fact can only be learned in a later chapter", () => {
    const broken = {
      ...redLedgerInvestigationProof,
      facts: [
        ...redLedgerInvestigationProof.facts,
        {
          id: "fact.red-ledger.late-only" as const,
          label: "Late-only fact",
          description: "A fact whose only source is unavailable until Day Two.",
        },
      ],
      researchSources: [
        ...redLedgerInvestigationProof.researchSources,
        {
          id: "source.red-ledger.late-only" as const,
          label: "Day Two only source",
          availableChapterIds: ["chapter.red-ledger.day-2" as const],
          revealFactIds: ["fact.red-ledger.late-only" as const],
          oneShot: true,
        },
      ],
      chapters: redLedgerInvestigationProof.chapters.map((chapter) =>
        chapter.id === "chapter.red-ledger.day-1"
          ? {
              ...chapter,
              objectives: [
                ...chapter.objectives,
                {
                  id: "objective.red-ledger.impossible" as const,
                  label: "Impossible Day One lead",
                  required: true,
                  requirements: [
                    { kind: "fact" as const, factId: "fact.red-ledger.late-only" as const },
                  ],
                },
              ],
            }
          : chapter,
      ),
    };
    const report = analyzeInvestigationManifest(broken);
    expect(report.ready).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "chapter-deadlock",
          severity: "error",
          message: expect.stringContaining("objective.red-ledger.impossible"),
        }),
      ]),
    );
    expect(report.reachedChapterIds).toEqual(["chapter.red-ledger.day-1"]);
  });
});
