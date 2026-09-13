import { describe, expect, it } from "vitest";
import {
  evaluateReferenceProofReadiness,
  referenceProofRuntimeContractByLaneId,
  validateReferenceProofRuntimeContracts,
} from "../src/reference-proof-readiness.js";

const complete = (laneId: string) => {
  const contract = referenceProofRuntimeContractByLaneId(laneId)!;
  return {
    laneId,
    packagedBundle: true,
    enabledFeatures: contract.requiredFeatures,
    completedMilestoneIds: contract.requiredMilestones.map((entry) => entry.id),
    nativeScreenshotCount: contract.minimumNativeScreenshots,
    successReplay: true,
    failureReplay: true,
    saveRestoreReplay: true,
    finalArtApproved: true,
    finalAudioApproved: true,
  } as const;
};

describe("reference proof readiness", () => {
  it("keeps a polished-but-unpackaged proof blocked", () => {
    const result = evaluateReferenceProofReadiness({
      laneId: "late-sierra-procedural",
      packagedBundle: false,
      enabledFeatures: [],
      completedMilestoneIds: [],
      nativeScreenshotCount: 0,
      successReplay: false,
      failureReplay: false,
      saveRestoreReplay: false,
      finalArtApproved: false,
      finalAudioApproved: false,
    });
    expect(result.ready).toBe(false);
    expect(result.requiredMilestones).toBe(6);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "bundle-missing",
        "feature-missing",
        "milestone-missing",
        "screenshots-insufficient",
        "success-replay-missing",
        "failure-replay-missing",
        "save-restore-replay-missing",
        "art-approval-missing",
        "audio-approval-missing",
      ]),
    );
  });

  it("requires evidence-led procedural gameplay for the PQ4 lane", () => {
    const result = evaluateReferenceProofReadiness({
      ...complete("late-sierra-procedural"),
      completedMilestoneIds: ["open-case.protected-entry"],
    });
    expect(result.ready).toBe(false);
    expect(result.completedMilestones).toBe(1);
    expect(result.issues.filter((issue) => issue.code === "milestone-missing")).toHaveLength(5);
    expect(result.issues.map((issue) => issue.message).join(" ")).toMatch(/Evidence-led interview/iu);
  });

  it("requires social recovery and alternate access for the LSL-style lane", () => {
    const contract = referenceProofRuntimeContractByLaneId("sierra-social-comedy-vga")!;
    expect(contract.requiredMilestones.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "after-hours.recoverable-introduction",
        "after-hours.inventory-conversation",
        "after-hours.alternate-access",
        "after-hours.embarrassment-retry",
      ]),
    );
    expect(evaluateReferenceProofReadiness(complete("sierra-social-comedy-vga")).ready).toBe(true);
  });

  it("requires multi-protagonist, investigation and specialized-mode evidence for modern-retro noir", () => {
    const contract = referenceProofRuntimeContractByLaneId("modern-retro-noir")!;
    expect(contract.requiredFeatures).toEqual(
      expect.arrayContaining(["investigation", "multi-protagonist", "specialized-modes", "room-scripts"]),
    );
    expect(contract.requiredMilestones.map((entry) => entry.id)).toContain(
      "cold-meridian.knowledge-separation",
    );
    expect(evaluateReferenceProofReadiness(complete("modern-retro-noir")).ready).toBe(true);
  });

  it("keeps runtime proof contracts complete and aligned with every registered lane", () => {
    expect(validateReferenceProofRuntimeContracts()).toEqual([]);
  });
});
