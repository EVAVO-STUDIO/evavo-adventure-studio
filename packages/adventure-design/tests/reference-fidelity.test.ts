import { describe, expect, it } from "vitest";
import {
  adventureReferenceEngineDialectById,
  adventureReferenceEngineDialects,
  adventureReferenceTitlePackByTitleId,
  adventureReferenceTitlePackByVariantId,
  adventureReferenceTitlePacks,
  auditAdventureReferenceTitlePack,
  validateAdventureReferenceTitlePacks,
  type AdventureReferenceAuditInput,
  type AdventureReferenceCapabilityEvidence,
  type AdventureReferenceTitlePack,
} from "../src/reference-fidelity.js";

const completeAuditInput = (
  pack: AdventureReferenceTitlePack,
  variantId = pack.variants[0]?.id ?? "missing",
): AdventureReferenceAuditInput => {
  const evidence: AdventureReferenceCapabilityEvidence[] = pack.capabilities.flatMap(
    (requirement) =>
      Array.from({ length: requirement.evidence.minimumItems }, (_, index) => ({
        capabilityId: requirement.id,
        kind:
          requirement.evidence.acceptedKinds[
            index % requirement.evidence.acceptedKinds.length
          ] ?? "contract",
        reference: `evidence/${pack.titleId}/${requirement.id}/${index + 1}.json`,
      })),
  );
  return {
    variantId,
    implementedCapabilityIds: pack.capabilities.map((entry) => entry.id),
    evidence,
    observedProfileId: pack.profileId,
    observedProofShowcaseId: pack.originalProof.showcaseId,
  };
};

const capabilityIds = (titleId: AdventureReferenceTitlePack["titleId"]) =>
  new Set(
    adventureReferenceTitlePackByTitleId(titleId).capabilities.map((entry) => entry.id),
  );

describe("adventure reference fidelity packs", () => {
  it("ships eight title-specific packs over four explicit engine dialects", () => {
    expect(adventureReferenceEngineDialects.map((entry) => entry.id)).toEqual([
      "sierra-sci1-vga",
      "sierra-sci32-vga",
      "lucasarts-scumm5-vga",
      "dynamix-dgds-vga",
    ]);
    expect(adventureReferenceTitlePacks.map((entry) => entry.titleId)).toEqual([
      "kings-quest-v",
      "quest-for-glory-iv",
      "gabriel-knight-sins-of-the-fathers",
      "police-quest-i-vga-remake",
      "police-quest-iv",
      "indiana-jones-fate-of-atlantis",
      "heart-of-china",
      "rise-of-the-dragon",
    ]);
    expect(validateAdventureReferenceTitlePacks(adventureReferenceTitlePacks)).toEqual([]);
  });

  it("keeps every title grammar separate even when engine dialects are shared", () => {
    const kq5 = capabilityIds("kings-quest-v");
    const qfg4 = capabilityIds("quest-for-glory-iv");
    const gk1 = capabilityIds("gabriel-knight-sins-of-the-fathers");
    const pq1 = capabilityIds("police-quest-i-vga-remake");
    const pq4 = capabilityIds("police-quest-iv");
    const foa = capabilityIds("indiana-jones-fate-of-atlantis");
    const heart = capabilityIds("heart-of-china");
    const rise = capabilityIds("rise-of-the-dragon");

    expect(kq5.has("temporary-icon-bar")).toBe(true);
    expect(kq5.has("score-counter")).toBe(true);
    expect(kq5.has("death-restart-flow")).toBe(true);

    for (const id of [
      "rpg-attributes",
      "class-specific-solutions",
      "day-night-schedule",
      "combat-system",
      "character-import-export",
    ] as const) {
      expect(qfg4.has(id)).toBe(true);
    }
    expect(qfg4.has("topic-dialogue")).toBe(false);

    for (const id of [
      "chapter-day-progression",
      "topic-dialogue",
      "evidence-research",
      "portrait-conversation",
    ] as const) {
      expect(gk1.has(id)).toBe(true);
    }
    expect(gk1.has("combat-system")).toBe(false);

    for (const id of [
      "temporary-icon-bar",
      "narration-feedback",
      "score-counter",
      "death-restart-flow",
      "procedure-checks",
      "procedural-failure",
      "location-progression",
    ] as const) {
      expect(pq1.has(id)).toBe(true);
    }
    expect(pq1.has("evidence-chain")).toBe(false);
    expect(pq1.has("case-state")).toBe(false);
    expect(pq1.has("interrogation-flow")).toBe(false);

    for (const id of [
      "procedure-checks",
      "evidence-chain",
      "case-state",
      "interrogation-flow",
      "procedural-failure",
    ] as const) {
      expect(pq4.has(id)).toBe(true);
    }

    for (const id of [
      "persistent-verb-panel",
      "sentence-construction",
      "multi-route-structure",
      "travel-map",
      "route-dependent-world-state",
    ] as const) {
      expect(foa.has(id)).toBe(true);
    }

    for (const id of [
      "protagonist-switching",
      "route-time-costs",
      "editorial-travel-montage",
      "knowledge-separation",
    ] as const) {
      expect(heart.has(id)).toBe(true);
    }
    expect(heart.has("visible-game-clock")).toBe(false);

    for (const id of [
      "visible-game-clock",
      "scheduled-contact-windows",
      "time-costed-actions",
      "deadline-outcomes",
    ] as const) {
      expect(rise.has(id)).toBe(true);
    }
    expect(rise.has("protagonist-switching")).toBe(false);
  });

  it("binds every commercial reference to an original EVAVO proof boundary", () => {
    for (const pack of adventureReferenceTitlePacks) {
      expect(pack.originalProof.originalAssetsOnly).toBe(true);
      expect(pack.originalProof.title).not.toBe(pack.referenceTitle);
      expect(pack.originalProof.featuredSystems.length).toBeGreaterThanOrEqual(3);
      expect(pack.redistributionBoundary.prohibited).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Commercial art"),
          expect.stringContaining("Commercial music"),
          expect.stringContaining("Commercial dialogue"),
          expect.stringContaining("Commercial characters"),
          expect.stringContaining("Commercial room layouts"),
        ]),
      );
    }
    expect(adventureReferenceTitlePackByTitleId("police-quest-i-vga-remake").originalProof).toEqual(
      expect.objectContaining({
        title: "Night Shift",
        profileId: "early-procedural-icon-vga",
        status: "planned",
      }),
    );
    expect(adventureReferenceTitlePackByTitleId("quest-for-glory-iv").originalProof).toEqual(
      expect.objectContaining({ title: "The Hollow Vale", status: "planned" }),
    );
    expect(adventureReferenceTitlePackByTitleId("police-quest-iv").originalProof).toEqual(
      expect.objectContaining({
        title: "Open Case",
        profileId: "procedural-investigation-vga",
        status: "planned",
      }),
    );
  });

  it("accepts complete implementation and retained evidence only at full fidelity", () => {
    for (const pack of adventureReferenceTitlePacks) {
      const report = auditAdventureReferenceTitlePack(pack, completeAuditInput(pack));
      expect(report).toEqual(
        expect.objectContaining({
          status: "ready",
          score: 100,
          issues: [],
          packId: pack.id,
          titleId: pack.titleId,
        }),
      );
      expect(report.metrics.evidencedCapabilities).toBe(pack.capabilities.length);
    }
  });

  it("blocks missing critical capability, missing evidence and identity drift", () => {
    const pack = adventureReferenceTitlePackByTitleId("indiana-jones-fate-of-atlantis");
    const complete = completeAuditInput(pack);
    const missingCapability = auditAdventureReferenceTitlePack(pack, {
      ...complete,
      implementedCapabilityIds: complete.implementedCapabilityIds.filter(
        (entry) => entry !== "multi-route-structure",
      ),
      evidence: complete.evidence.filter(
        (entry) => entry.capabilityId !== "multi-route-structure",
      ),
    });
    expect(missingCapability.status).toBe("blocked");
    expect(missingCapability.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-critical-capability", severity: "error" }),
      ]),
    );

    const missingEvidence = auditAdventureReferenceTitlePack(pack, {
      ...complete,
      evidence: complete.evidence.filter((entry) => entry.capabilityId !== "travel-map"),
    });
    expect(missingEvidence.status).toBe("blocked");
    expect(missingEvidence.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-critical-evidence", severity: "error" }),
      ]),
    );

    const drifted = auditAdventureReferenceTitlePack(pack, {
      ...complete,
      observedProfileId: "storybook-icon-vga",
      observedProofShowcaseId: "showcase.glass-finch",
    });
    expect(drifted.status).toBe("blocked");
    const driftCodes = new Set(drifted.issues.map((entry) => entry.code));
    expect(driftCodes.has("profile-mismatch")).toBe(true);
    expect(driftCodes.has("proof-showcase-mismatch")).toBe(true);
  });

  it("resolves exact title variants and refuses unknown IDs", () => {
    expect(adventureReferenceTitlePackByVariantId("pq1-vga.dos.floppy.en").titleId).toBe(
      "police-quest-i-vga-remake",
    );
    expect(adventureReferenceTitlePackByVariantId("gk1.dos.cd.en").titleId).toBe(
      "gabriel-knight-sins-of-the-fathers",
    );
    expect(adventureReferenceEngineDialectById("sierra-sci32-vga").nativeSize).toEqual({
      width: 320,
      height: 200,
    });
    expect(adventureReferenceEngineDialectById("dynamix-dgds-vga").nativeSize).toEqual({
      width: 320,
      height: 200,
    });
    expect(() => adventureReferenceTitlePackByVariantId("missing.variant")).toThrow(
      "missing.variant",
    );
  });
});
