import { describe, expect, it } from "vitest";
import {
  evaluateNinthReliquaryFullGameReadiness,
  ninthReliquaryRequiredCapabilities,
  ninthReliquaryStressChapters,
} from "../src/ninth-reliquary-full-game-proof.js";

const runtimeReady = {
  investigationGraph: true,
  roomScriptsAndCutawayReturn: true,
  multiProtagonistSession: true,
  routeTopology: true,
  specializedModeReturn: true,
  deterministicSaveReplay: true,
} as const;

const allDeliver = {
  squareLayout: "deliver",
  squareBackground: "deliver",
  squareForeground: "deliver",
  maraModelSheet: "deliver",
  maraWalkEast: "deliver",
  maraInspect: "deliver",
  chapelCutaway: "deliver",
} as const;

describe("Ninth Reliquary full-game proof", () => {
  it("covers three materially different stress chapters rather than one showcase room", () => {
    expect(ninthReliquaryStressChapters.map((chapter) => chapter.id)).toEqual([
      "old-city-square",
      "archive-hidden-chapel",
      "night-train-mountain-hospice",
    ]);
    expect(ninthReliquaryRequiredCapabilities).toEqual(
      expect.arrayContaining([
        "research-investigation-loop",
        "multi-elevation-room",
        "room-cutaways",
        "multi-protagonist-switching",
        "branching-route-topology",
        "travel-map",
        "vehicle-scene",
        "action-minigame",
        "deterministic-save-replay",
      ]),
    );
  });

  it("remains authored-ready when creative reviews or retained evidence are incomplete", () => {
    const readiness = evaluateNinthReliquaryFullGameReadiness({
      runtime: runtimeReady,
      creativeDecisions: {
        squareLayout: "deliver",
        squareBackground: "targeted-repair",
      },
      retainedEvidence: {
        nativeScreenshots: 0,
        completePlaythroughReplay: false,
        cutawayReturnReplay: false,
        protagonistSwitchReplay: false,
        creativeDeliveryReceipts: 1,
      },
    });
    expect(readiness).toMatchObject({
      stage: "authored-ready",
      authoredReady: true,
      creativeReady: false,
      fullProofReady: false,
      creativeDeliveryCount: 1,
    });
    expect(readiness.blockers.join(" ")).toMatch(/squareBackground/u);
  });

  it("promotes to creative-ready only when every Art/Cel proof asset reaches deliver", () => {
    const readiness = evaluateNinthReliquaryFullGameReadiness({
      runtime: runtimeReady,
      creativeDecisions: allDeliver,
      retainedEvidence: {
        nativeScreenshots: 3,
        completePlaythroughReplay: false,
        cutawayReturnReplay: false,
        protagonistSwitchReplay: false,
        creativeDeliveryReceipts: 7,
      },
    });
    expect(readiness).toMatchObject({
      stage: "creative-ready",
      authoredReady: true,
      creativeReady: true,
      fullProofReady: false,
      creativeDeliveryCount: 7,
    });
  });

  it("requires retained native and replay evidence before calling the lane fully proofed", () => {
    const readiness = evaluateNinthReliquaryFullGameReadiness({
      runtime: runtimeReady,
      creativeDecisions: allDeliver,
      retainedEvidence: {
        nativeScreenshots: 8,
        completePlaythroughReplay: true,
        cutawayReturnReplay: true,
        protagonistSwitchReplay: true,
        creativeDeliveryReceipts: 7,
      },
    });
    expect(readiness).toMatchObject({
      stage: "full-proof-ready",
      authoredReady: true,
      creativeReady: true,
      fullProofReady: true,
    });
    expect(readiness.blockers).toEqual([]);
  });

  it("will not hide an unimplemented runtime subsystem behind accepted artwork", () => {
    const readiness = evaluateNinthReliquaryFullGameReadiness({
      runtime: { ...runtimeReady, multiProtagonistSession: false },
      creativeDecisions: allDeliver,
      retainedEvidence: {
        nativeScreenshots: 8,
        completePlaythroughReplay: true,
        cutawayReturnReplay: true,
        protagonistSwitchReplay: true,
        creativeDeliveryReceipts: 7,
      },
    });
    expect(readiness.fullProofReady).toBe(false);
    expect(readiness.blockers).toContain("Runtime proof missing: multiProtagonistSession.");
  });
});
