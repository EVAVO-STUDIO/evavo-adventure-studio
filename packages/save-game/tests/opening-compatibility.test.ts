import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { runtimeBundleFingerprint } from "../src/canonical.js";

const sequence = (id: string) => ({
  id,
  name: id,
  mode: "cutscene" as const,
  durationTicks: 60,
  loop: false,
  blocking: true,
  savePolicy: "disabled" as const,
  skip: {
    allowed: true,
    safeAfterTick: 12,
    completionActions: [],
  },
  tracks: [],
  cueCount: 0,
});

const bundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.opening-save",
  title: "Opening Save",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: false,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.office",
  startEntranceId: "entrance.office",
  assetManifestFingerprint: "0".repeat(64),
  assetCompilerVersion: "test",
  assets: [],
  inventoryItems: [],
  actors: [],
  scenes: [],
  dialogues: [],
  sequences: [sequence("sequence.opening-a"), sequence("sequence.opening-b")],
} as unknown as RuntimeBundle;

describe("opening save compatibility", () => {
  it("treats the selected new-game opening as gameplay-significant identity", () => {
    const openingA = {
      ...bundle,
      opening: {
        manifestVersion: 1 as const,
        projectId: bundle.projectId,
        newGameSequenceId: "sequence.opening-a" as RuntimeBundle["sequences"][number]["id"],
      },
    };
    const openingB = {
      ...bundle,
      opening: {
        ...openingA.opening,
        newGameSequenceId: "sequence.opening-b" as RuntimeBundle["sequences"][number]["id"],
      },
    };

    expect(runtimeBundleFingerprint(openingA)).not.toBe(runtimeBundleFingerprint(bundle));
    expect(runtimeBundleFingerprint(openingB)).not.toBe(runtimeBundleFingerprint(openingA));
  });
});
