import { describe, expect, it } from "vitest";
import {
  evaluateNinthReliquaryFullGameReadiness,
  ninthReliquaryFullGameProof,
  validateNinthReliquaryProductionAuthorities,
} from "../src/original-full-game-proofs.js";
import { ninthReliquaryAssetSpecs } from "../src/illustrated-conspiracy-production.js";
import { ADVENTURE_CREATIVE_HANDOFF_V3_PROTOCOL_FINGERPRINT } from "../src/creative-production-protocol-v3.js";

const authorities = Object.fromEntries(
  ninthReliquaryAssetSpecs.map((spec) => [
    spec.assetId,
    {
      sourceRevisionDigest: `sha256:source:${spec.assetId}`,
      styleDigest: "sha256:style",
      paletteDigest: "sha256:palette",
      environmentLayoutDigest: "sha256:layout",
      modelSheetDigest: "sha256:model",
      xSheetDigest: "sha256:xsheet",
      referenceDigests: ["sha256:ref"],
    },
  ]),
);

describe("original full-game proof readiness", () => {
  it("keeps The Ninth Reliquary bound to the cross-studio v3 protocol", () => {
    expect(ninthReliquaryFullGameProof.creativeProtocolFingerprint).toBe(
      ADVENTURE_CREATIVE_HANDOFF_V3_PROTOCOL_FINGERPRINT,
    );
    expect(ninthReliquaryFullGameProof.requiredCreativeAssetIds).toHaveLength(
      ninthReliquaryAssetSpecs.length,
    );
  });

  it("does not call the proof ready when creative deliveries are still missing", () => {
    const readiness = evaluateNinthReliquaryFullGameReadiness([]);
    expect(readiness.creativeReady).toBe(false);
    expect(readiness.fullReady).toBe(false);
    expect(readiness.missingCreativeAssetIds).toHaveLength(
      ninthReliquaryFullGameProof.requiredCreativeAssetIds.length,
    );
  });

  it("separates engine gaps from creative-delivery gaps", () => {
    const readiness = evaluateNinthReliquaryFullGameReadiness(
      ninthReliquaryFullGameProof.requiredCreativeAssetIds,
    );
    expect(readiness.creativeReady).toBe(true);
    expect(readiness.fullReady).toBe(readiness.engineReady);
    expect(readiness.capabilityGaps.map((gap) => gap.id)).toEqual(
      expect.arrayContaining(["multi-elevation-room", "travel-map", "full-game-evidence"]),
    );
  });

  it("validates that every planned creative asset has immutable production authority", () => {
    expect(validateNinthReliquaryProductionAuthorities(authorities)).toEqual([]);
    const incomplete = { ...authorities };
    delete incomplete["asset.ninth-reliquary.mara.inspect"];
    expect(validateNinthReliquaryProductionAuthorities(incomplete)[0]).toMatch(/Missing production authority/u);
  });
});
