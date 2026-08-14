import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { runtimeBundleFingerprint } from "../src/canonical.js";

const bundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.lifecycle-presentation-save",
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

describe("lifecycle presentation save compatibility", () => {
  it("ignores outcome copy and recovery-label wording", () => {
    const translated = {
      ...lifecycle,
      outcomes: lifecycle.outcomes.map((outcome) => ({
        ...outcome,
        title: "AFFAIRE CLASSÉE",
        message: "L'affaire est terminée.",
        menu: {
          ...outcome.menu,
          labels: {
            quickRetry: "RÉESSAYER",
            loadGame: "CHARGER",
            restartGame: "RECOMMENCER",
            returnToTitle: "MENU PRINCIPAL",
            back: "RETOUR",
          },
        },
      })),
    };

    expect(runtimeBundleFingerprint({ ...bundle, lifecycle: translated })).toBe(
      runtimeBundleFingerprint({ ...bundle, lifecycle }),
    );
  });

  it("keeps terminal conditions and recovery policy gameplay-significant", () => {
    const changedCondition = {
      ...lifecycle,
      outcomes: lifecycle.outcomes.map((outcome) => ({
        ...outcome,
        when: { kind: "flag", flag: "failed", equals: false } as const,
      })),
    };
    const changedRecovery = {
      ...lifecycle,
      outcomes: lifecycle.outcomes.map((outcome) => ({
        ...outcome,
        menu: { ...outcome.menu, allowQuickRetry: false },
      })),
    };

    const baseline = runtimeBundleFingerprint({ ...bundle, lifecycle });
    expect(
      runtimeBundleFingerprint({ ...bundle, lifecycle: changedCondition }),
    ).not.toBe(baseline);
    expect(
      runtimeBundleFingerprint({ ...bundle, lifecycle: changedRecovery }),
    ).not.toBe(baseline);
    expect(runtimeBundleFingerprint(bundle)).not.toBe(baseline);
  });
});
