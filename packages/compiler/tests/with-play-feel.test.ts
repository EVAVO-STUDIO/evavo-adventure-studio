import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { type CompiledProject, canonicalStringify } from "../src/index.js";
import { attachRuntimePlayFeelProfile } from "../src/with-play-feel.js";

const hash = "0".repeat(64);

const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.compiler-profile",
  title: "Compiler Profile",
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
  startSceneId: "scene.room",
  startEntranceId: "entrance.room",
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [
    {
      assetId: "asset.room",
      kind: "image",
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/room.png",
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
        colourCount: 32,
      },
    },
  ],
  inventoryItems: [],
  actors: [],
  scenes: [
    {
      id: "scene.room",
      name: "Room",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.room",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.room",
          position: { x: 20, y: 170 },
          facing: "east",
        },
      ],
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

describe("runtime play-feel compilation", () => {
  it("attaches a validated profile without mutating the source compilation", () => {
    const profiled = attachRuntimePlayFeelProfile(compiled, "storybook-deliberate");

    expect(compiled.bundle.playFeelProfileId).toBeUndefined();
    expect(profiled.bundle.playFeelProfileId).toBe("storybook-deliberate");
    expect(profiled.canonicalJson).toContain('"playFeelProfileId":"storybook-deliberate"');
    expect(profiled.fingerprint).toMatch(/^fnv1a64:[0-9a-f]{16}$/u);
    expect(profiled.fingerprint).not.toBe(compiled.fingerprint);
    expect(profiled.warnings).toBe(compiled.warnings);
  });

  it("is deterministic and changes identity when the selected family changes", () => {
    const first = attachRuntimePlayFeelProfile(compiled, "gothic-measured");
    const second = attachRuntimePlayFeelProfile(compiled, "gothic-measured");
    const cinematic = attachRuntimePlayFeelProfile(compiled, "cinematic-directed");

    expect(second).toEqual(first);
    expect(cinematic.canonicalJson).not.toBe(first.canonicalJson);
    expect(cinematic.fingerprint).not.toBe(first.fingerprint);
  });

  it("rejects a profile whose logical rate differs from the compiled bundle", () => {
    const mismatched: CompiledProject = {
      ...compiled,
      bundle: {
        ...compiled.bundle,
        presentation: {
          ...compiled.bundle.presentation,
          logicalTicksPerSecond: 30,
        },
      },
    };

    expect(() => attachRuntimePlayFeelProfile(mismatched, "storybook-deliberate")).toThrow(
      /logical ticks per second/u,
    );
  });

  it("rejects an ungoverned profile identifier at the compiler boundary", () => {
    expect(() =>
      attachRuntimePlayFeelProfile(compiled, "fast-modern-smoothing" as "classic-balanced"),
    ).toThrow();
  });
});
