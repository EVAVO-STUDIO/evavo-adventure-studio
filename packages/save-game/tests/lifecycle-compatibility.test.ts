import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { runtimeBundleFingerprint } from "../src/canonical.js";

const bundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.lifecycle-save",
  title: "Lifecycle",
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
  sequences: [],
} as unknown as RuntimeBundle;

const lifecycle = {
  manifestVersion: 1,
  projectId: bundle.projectId,
  outcomes: [
    {
      id: "outcome.failure",
      kind: "failure",
      priority: 10,
      when: { kind: "flag", flag: "failed", equals: true },
      title: "Case Closed",
      message: "The case is over.",
      menu: {
        allowQuickRetry: true,
        allowLoad: true,
        allowRestart: true,
        allowTitle: true,
        labels: {
          quickRetry: "QUICK RETRY",
          loadGame: "LOAD GAME",
          restartGame: "RESTART GAME",
          returnToTitle: "RETURN TO TITLE",
          back: "BACK",
        },
      },
    },
  ],
} as NonNullable<RuntimeBundle["lifecycle"]>;

describe("lifecycle save compatibility", () => {
  it("treats lifecycle rules as gameplay-affecting bundle identity", () => {
    expect(runtimeBundleFingerprint({ ...bundle, lifecycle })).not.toBe(runtimeBundleFingerprint(bundle));
  });
});