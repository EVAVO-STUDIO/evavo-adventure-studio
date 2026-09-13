import { describe, expect, it } from "vitest";
import { adventureReferenceProofLanes } from "../src/reference-proof-lanes.js";
import {
  referenceProofDevelopmentStatusByLaneId,
  validateReferenceProofDevelopmentStatuses,
} from "../src/reference-proof-development.js";

describe("reference proof development status", () => {
  it("marks production contracts and gameplay kernels ready without overstating packaged completion", () => {
    for (const lane of adventureReferenceProofLanes) {
      const development = referenceProofDevelopmentStatusByLaneId(lane.id);
      expect(development?.stages[0]).toMatchObject({ stage: "production-contract", status: "ready" });
      expect(development?.stages[1]).toMatchObject({ stage: "gameplay-kernel", status: "ready" });
      expect(development?.stages.find((entry) => entry.stage === "packaged-playable")?.status).toBe("blocked");
      expect(development?.stages.find((entry) => entry.stage === "retained-evidence")?.status).toBe("blocked");
    }
  });

  it("shows Open Case ahead at the semantic-source stage without claiming a finished project bundle", () => {
    const development = referenceProofDevelopmentStatusByLaneId("late-sierra-procedural");
    expect(development?.stages.find((entry) => entry.stage === "semantic-runtime-source")).toMatchObject({
      status: "partial",
    });
    expect(
      development?.stages.find((entry) => entry.stage === "semantic-runtime-source")?.note,
    ).toMatch(/investigation graph/iu);
  });

  it("recognises that Cold Meridian can reuse the generic composed feature stack but still needs authored bindings", () => {
    const development = referenceProofDevelopmentStatusByLaneId("modern-retro-noir");
    expect(
      development?.stages.find((entry) => entry.stage === "semantic-runtime-source")?.note,
    ).toMatch(/multi-protagonist.*investigation.*room-script.*specialized-mode/iu);
  });

  it("keeps every registered proof lane aligned to the complete development-stage sequence", () => {
    expect(
      validateReferenceProofDevelopmentStatuses(adventureReferenceProofLanes.map((lane) => lane.id)),
    ).toEqual([]);
  });
});
