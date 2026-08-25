import { describe, expect, it } from "vitest";
import {
  createAdventureCreativeAdmissionManifest,
  validateAdventureCreativeAdmissionManifest,
} from "../src/creative-production-admission.js";
import {
  createAdventureCreativeProductionSession,
  reviewAdventureCreativeSession,
  submitAdventureCreativeCandidate,
} from "../src/creative-production-session.js";
import type {
  AdventureCreativeCandidateEvidence,
  AdventureCreativeWorkOrder,
} from "../src/creative-production-handoff.js";

const projectId = "project.creative-admission" as never;
const orders: readonly AdventureCreativeWorkOrder[] = [
  {
    contractVersion: 1,
    workOrderId: "creative.room.background",
    projectId,
    assetId: "asset.room.background" as never,
    destinationStudio: "art-studio",
    taskKind: "background",
    briefRevision: 1,
    sourceRevisionDigest: "source",
    visualStandardDigest: "standard",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "opaque",
    checkerboardForbidden: true,
    canvasEdgeMustBeTransparent: false,
    preserveNativeCanvas: true,
    requiredReferenceDigests: [],
    artDirection: ["Room background"],
    rejectionRules: [],
  },
  {
    contractVersion: 1,
    workOrderId: "creative.room.foreground",
    projectId,
    assetId: "asset.room.foreground" as never,
    destinationStudio: "art-studio",
    taskKind: "foreground-plate",
    briefRevision: 1,
    sourceRevisionDigest: "source",
    visualStandardDigest: "standard",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "required",
    checkerboardForbidden: true,
    canvasEdgeMustBeTransparent: true,
    preserveNativeCanvas: true,
    requiredReferenceDigests: ["background-approved"],
    artDirection: ["Foreground occlusion"],
    rejectionRules: ["No fake transparency"],
  },
];

const candidate = (order: AdventureCreativeWorkOrder): AdventureCreativeCandidateEvidence => ({
  contractVersion: 1,
  workOrderId: order.workOrderId,
  candidateRevision: 1,
  sourceDigest: `source:${order.assetId}`,
  candidateDigest: `candidate:${order.assetId}`,
  width: order.nativeSize.width,
  height: order.nativeSize.height,
  mediaType: "image/png",
  styleStandardDigest: order.visualStandardDigest,
  reviewScaleVerified: true,
  ...(order.alphaPolicy === "opaque"
    ? {}
    : {
        alpha: {
          decodedAlphaPresent: true,
          fullyTransparentCanvasEdge: true,
          checkerboardDetected: false,
          matteResidueDetected: false,
          haloOrFringeDetected: false,
          alphaMaskReviewed: true,
          hostilePlateProofs: ["black", "white", "grey", "green", "magenta"] as const,
        },
      }),
});

const acceptedSession = (order: AdventureCreativeWorkOrder) =>
  reviewAdventureCreativeSession(
    submitAdventureCreativeCandidate(createAdventureCreativeProductionSession(order), candidate(order)),
  );

describe("creative admission manifest", () => {
  it("refuses compilation admission until every required creative work order is accepted", () => {
    expect(() =>
      createAdventureCreativeAdmissionManifest(projectId, orders, [acceptedSession(orders[0]!)]),
    ).toThrow(/remain blocked/u);
  });

  it("creates stable accepted records for the exact required assets", () => {
    const manifest = createAdventureCreativeAdmissionManifest(
      projectId,
      orders,
      orders.map(acceptedSession),
    );
    expect(manifest.records.map((record) => record.assetId)).toEqual([
      "asset.room.background",
      "asset.room.foreground",
    ]);
    expect(validateAdventureCreativeAdmissionManifest(projectId, orders, manifest)).toEqual([]);
    expect(manifest.records.find((record) => record.assetId === "asset.room.foreground")).toMatchObject({
      alphaAccepted: true,
      destinationStudio: "art-studio",
    });
  });

  it("detects stale visual-standard and missing-alpha acceptance records", () => {
    const manifest = createAdventureCreativeAdmissionManifest(projectId, orders, orders.map(acceptedSession));
    const bad = {
      ...manifest,
      records: manifest.records.map((record) =>
        record.assetId === "asset.room.foreground"
          ? { ...record, visualStandardDigest: "stale", alphaAccepted: false }
          : record,
      ),
    };
    expect(validateAdventureCreativeAdmissionManifest(projectId, orders, bad).map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["visual-standard-mismatch", "alpha-not-accepted"]),
    );
  });
});
