import type { CompiledProject } from "@evavo/adventure-compiler";
import { canonicalStringify } from "@evavo/adventure-compiler";
import {
  createDefaultFailureLifecycleMenu,
  parseGameLifecycleManifest,
} from "@evavo/adventure-project-schema/lifecycle";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { attachRuntimeLifecycle } from "../src/with-lifecycle.js";

const hash = "0".repeat(64);
const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.lifecycle-compiler",
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
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [
    {
      assetId: "asset.office",
      kind: "image",
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/office.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image",
        width: 320,
        height: 200,
        palette: false,
        colourCount: 32,
      },
    },
  ],
  inventoryItems: [],
  actors: [],
  scenes: [
    {
      id: "scene.office",
      name: "Office",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.office",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [{ id: "entrance.office", position: { x: 20, y: 170 }, facing: "east" }],
      fallbackText: "Nothing happens.",
    },
  ],
  dialogues: [],
  sequences: [],
});
const compiled: CompiledProject = {
  bundle,
  canonicalJson: canonicalStringify(bundle),
  fingerprint: "fnv1a64:0000000000000000",
  warnings: [],
};

const lifecycle = parseGameLifecycleManifest({
  manifestVersion: 1,
  projectId: bundle.projectId,
  outcomes: [
    {
      id: "outcome.low",
      kind: "failure",
      priority: 1,
      when: { kind: "flag", flag: "low", equals: true },
      title: "Low",
      message: "Low priority",
      menu: createDefaultFailureLifecycleMenu(),
    },
    {
      id: "outcome.high",
      kind: "failure",
      priority: 10,
      when: { kind: "flag", flag: "high", equals: true },
      title: "High",
      message: "High priority",
      menu: createDefaultFailureLifecycleMenu(),
    },
  ],
});

describe("runtime lifecycle compilation", () => {
  it("attaches canonical lifecycle data without changing core runtime identity", () => {
    const result = attachRuntimeLifecycle(compiled, lifecycle);
    expect(result.bundle.projectId).toBe(bundle.projectId);
    expect(result.bundle.scenes).toEqual(bundle.scenes);
    expect(result.bundle.lifecycle?.outcomes.map((outcome) => outcome.id)).toEqual([
      "outcome.high",
      "outcome.low",
    ]);
    expect(result.fingerprint).not.toBe(compiled.fingerprint);
  });

  it("rejects lifecycle data from another project", () => {
    expect(() =>
      attachRuntimeLifecycle(compiled, {
        ...lifecycle,
        projectId: "project.other" as typeof lifecycle.projectId,
      }),
    ).toThrow(/does not match lifecycle project/u);
  });
});