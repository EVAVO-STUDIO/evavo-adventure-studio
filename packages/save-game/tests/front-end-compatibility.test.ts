import { idSchema } from "@evavo/adventure-project-schema";
import { createDefaultClassicFrontEndManifest } from "@evavo/adventure-project-schema/front-end";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  runtimeBundleExactFingerprint,
  runtimeBundleFingerprint,
} from "../src/canonical.js";

const projectId = idSchema("project").parse("project.front-end-save");
const sourceBundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId,
  title: "The Red Ledger",
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

const frontEnd = createDefaultClassicFrontEndManifest(projectId);

describe("front-end-neutral save fingerprints", () => {
  it("ignores authored front-end presentation while retaining exact artifact identity", () => {
    const first = { ...sourceBundle, frontEnd } as RuntimeBundle;
    const second = {
      ...sourceBundle,
      frontEnd: {
        ...frontEnd,
        publisher: {
          ...frontEnd.publisher,
          name: "NIGHT ARCHIVE GAMES",
        },
        credits: {
          lines: ["A NIGHT ARCHIVE PRODUCTION", "POWERED BY EVAVO ADVENTURE STUDIO"],
        },
      },
    } as RuntimeBundle;

    expect(runtimeBundleFingerprint(first)).toBe(runtimeBundleFingerprint(sourceBundle));
    expect(runtimeBundleFingerprint(second)).toBe(runtimeBundleFingerprint(sourceBundle));
    expect(runtimeBundleExactFingerprint(first)).not.toBe(runtimeBundleExactFingerprint(second));
  });
});