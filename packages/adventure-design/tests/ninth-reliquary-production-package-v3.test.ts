import { describe, expect, it } from "vitest";
import {
  createNinthReliquaryFinalizedProductionPackageV3,
  ninthReliquaryProductionBlueprintV3,
} from "../src/ninth-reliquary-production-package-v3.js";

const authorities = {
  projectId: "project.ninth-reliquary",
  sourceRevisionDigest: "sha256:source",
  visualStandardDigest: "sha256:visual-standard",
  styleBankDigest: "sha256:style-bank",
  paletteDigest: "sha256:palette",
  environmentLayoutDigest: "sha256:layout",
  protagonistModelSheetDigest: "sha256:model-sheet",
  protagonistWalkXSheetDigest: "sha256:x-sheet",
  environmentalReferenceDigests: ["sha256:env-b", "sha256:env-a"],
  characterReferenceDigests: ["sha256:char-b", "sha256:char-a"],
} as const;

describe("Ninth Reliquary production package v3", () => {
  it("upgrades the canonical hand-drawn conspiracy lane to seven strict v3 creative jobs", () => {
    const blueprint = ninthReliquaryProductionBlueprintV3();
    expect(blueprint).toMatchObject({
      blueprintVersion: 3,
      projectKey: "ninth-reliquary",
      productionProfileId: "cinematic-handdrawn-conspiracy",
    });
    expect(blueprint.workOrderPlan).toHaveLength(7);
    expect(blueprint.workOrderPlan.map((entry) => entry.taskKind)).toEqual([
      "background-layout",
      "background-paint",
      "foreground-plate",
      "character-model-sheet",
      "animation-sequence",
      "animation-sequence",
      "cutscene-shot",
    ]);
  });

  it("fans the same authoritative package into three Art and four Cel production requests", () => {
    const finalized = createNinthReliquaryFinalizedProductionPackageV3(authorities);
    expect(finalized.packageVersion).toBe(3);
    expect(finalized.profile.id).toBe("cinematic-handdrawn-conspiracy");
    expect(finalized.gameplayProof.scenes).toHaveLength(12);
    expect(finalized.workOrders).toHaveLength(7);
    expect(finalized.artStudioRequests).toHaveLength(3);
    expect(finalized.celAnimationStudioRequests).toHaveLength(4);
    expect(finalized.artStudioRequests.every((entry) => entry.destination === "art-studio")).toBe(true);
    expect(finalized.celAnimationStudioRequests.every((entry) => entry.destination === "cel-animation-studio")).toBe(true);
  });

  it("makes transparent and animated evidence requirements explicit per job", () => {
    const finalized = createNinthReliquaryFinalizedProductionPackageV3(authorities);
    const byAsset = new Map(finalized.evidenceRequirements.map((entry) => [entry.assetId, entry] as const));
    expect(byAsset.get("asset.ninth-reliquary.square.foreground-awning")).toMatchObject({
      alphaEvidenceRequired: true,
      hostilePlateReviewRequired: true,
      sequenceEvidenceRequired: false,
    });
    expect(byAsset.get("asset.ninth-reliquary.mara.walk-east")).toMatchObject({
      alphaEvidenceRequired: true,
      hostilePlateReviewRequired: true,
      sequenceEvidenceRequired: true,
      modelSheetAuthorityRequired: true,
      xSheetAuthorityRequired: true,
      exactNativeSize: { width: 960, height: 192 },
      deliveryReceiptRequired: true,
    });
    expect(byAsset.get("asset.ninth-reliquary.chapel-cutaway")).toMatchObject({
      alphaEvidenceRequired: false,
      sequenceEvidenceRequired: true,
      modelSheetAuthorityRequired: true,
      xSheetAuthorityRequired: true,
    });
  });

  it("keeps reference authority deterministic across environment and character work", () => {
    const finalized = createNinthReliquaryFinalizedProductionPackageV3(authorities);
    for (const order of finalized.workOrders) {
      expect(order.authorities.referenceDigests).toEqual([
        "sha256:char-a",
        "sha256:char-b",
        "sha256:env-a",
        "sha256:env-b",
        "sha256:visual-standard",
      ]);
    }
  });
});
