import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { canonicalStringify, type CompiledProject } from "../src/index.js";
import {
  attachRuntimeOpening,
  GameOpeningCompilationError,
} from "../src/with-opening.js";

const hash = "0".repeat(64);

const sequence = {
  id: "sequence.opening",
  name: "Opening",
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
};

const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.compiler-opening",
  title: "Compiler Opening",
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
        palette: true,
        colourCount: 16,
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
      entrances: [
        {
          id: "entrance.office",
          position: { x: 20, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  dialogues: [],
  sequences: [sequence],
});

const compiled: CompiledProject = {
  bundle,
  canonicalJson: canonicalStringify(bundle),
  fingerprint: "fnv1a64:0000000000000000",
  warnings: [],
};

describe("opening compilation", () => {
  it("attaches a deterministic opening manifest without mutating the input", () => {
    const manifest = {
      manifestVersion: 1 as const,
      projectId: bundle.projectId,
      newGameSequenceId: sequence.id as typeof bundle.sequences[number]["id"],
    };
    const first = attachRuntimeOpening(compiled, manifest);
    const second = attachRuntimeOpening(compiled, manifest);

    expect(compiled.bundle.opening).toBeUndefined();
    expect(first.bundle.opening).toEqual(manifest);
    expect(second).toEqual(first);
    expect(first.fingerprint).toMatch(/^fnv1a64:[0-9a-f]{16}$/u);
    expect(first.fingerprint).not.toBe(compiled.fingerprint);
  });

  it("rejects an opening that does not resolve to a suitable sequence", () => {
    expect(() =>
      attachRuntimeOpening(compiled, {
        manifestVersion: 1,
        projectId: bundle.projectId,
        newGameSequenceId: "sequence.missing" as typeof sequence.id,
      }),
    ).toThrow(GameOpeningCompilationError);
  });
});
