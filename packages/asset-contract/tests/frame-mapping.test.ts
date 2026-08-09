import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { validateCompiledFrameMappings } from "../src/frame-mapping.js";
import { assetBuildManifestSchema } from "../src/index.js";

const hash = "0".repeat(64);

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.frame-mapping",
  title: "Frame Mapping",
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
          position: { x: 10, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  actors: [
    {
      id: "actor.detective",
      name: "Detective",
      frames: [
        {
          id: "frame.detective.idle",
          assetId: "asset.detective",
          sourceRect: { x: 2, y: 2, width: 20, height: 40 },
          sourceSize: { width: 24, height: 44 },
          trimOffset: { x: 2, y: 4 },
          pivot: { x: 12, y: 44 },
          footPoint: { x: 12, y: 44 },
          durationTicks: 8,
          mirrorEligible: true,
        },
      ],
      animations: [
        {
          id: "animation.detective.idle",
          state: "idle",
          facing: "south",
          frameIds: ["frame.detective.idle"],
          loop: true,
          interruptible: true,
        },
      ],
    },
  ],
  dialogues: [],
  sequences: [],
  assets: [
    { id: "asset.office", path: "art/office.png", kind: "image" },
    {
      id: "asset.detective",
      path: "art/detective.aseprite",
      kind: "spritesheet",
    },
  ],
  inventoryItems: [],
});

const manifest = assetBuildManifestSchema.parse({
  manifestVersion: 1,
  projectId: project.id,
  compilerVersion: "0.1.0-test",
  fingerprint: hash,
  assets: [
    {
      assetId: "asset.office",
      kind: "image",
      sourceFiles: [{ path: "art/office.png", sha256: hash, byteLength: 1 }],
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
        colourCount: 2,
      },
    },
    {
      assetId: "asset.detective",
      kind: "spritesheet",
      sourceFiles: [
        {
          path: "art/detective.aseprite",
          sha256: hash,
          byteLength: 1,
        },
      ],
      outputFiles: [
        {
          role: "atlas-manifest",
          runtimePath: "assets/detective.atlas.json",
          mediaType: "application/json",
          sha256: hash,
          byteLength: 1,
        },
        {
          role: "page-000",
          runtimePath: "assets/detective-000.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "spritesheet",
        pages: [{ outputRole: "page-000", width: 128, height: 128 }],
        frames: [
          {
            frameId: "frame.detective.idle",
            pageOutputRole: "page-000",
            sourceRect: { x: 2, y: 2, width: 20, height: 40 },
            originalSize: { width: 24, height: 44 },
            trimOffset: { x: 2, y: 4 },
            padding: 2,
          },
        ],
      },
    },
  ],
});

describe("compiled sprite frame mappings", () => {
  it("accepts exact atlas geometry parity", () => {
    expect(validateCompiledFrameMappings(project, manifest)).toEqual([]);
  });

  it("reports missing compiled frames", () => {
    const spritesheet = manifest.assets.find((asset) => asset.kind === "spritesheet");
    if (!spritesheet || spritesheet.kind !== "spritesheet") {
      throw new Error("Spritesheet fixture is missing.");
    }
    const broken = {
      ...manifest,
      assets: manifest.assets.map((asset) =>
        asset.kind === "spritesheet"
          ? {
              ...asset,
              metadata: { ...asset.metadata, frames: [] },
            }
          : asset,
      ),
    };

    expect(validateCompiledFrameMappings(project, broken)).toEqual([
      expect.objectContaining({ code: "missing-compiled-frame" }),
    ]);
  });

  it("reports trim or source-rectangle drift after asset changes", () => {
    const broken = {
      ...manifest,
      assets: manifest.assets.map((asset) =>
        asset.kind === "spritesheet"
          ? {
              ...asset,
              metadata: {
                ...asset.metadata,
                frames: asset.metadata.frames.map((frame) => ({
                  ...frame,
                  trimOffset: { x: frame.trimOffset.x + 1, y: frame.trimOffset.y },
                })),
              },
            }
          : asset,
      ),
    };

    expect(validateCompiledFrameMappings(project, broken)).toEqual([
      expect.objectContaining({ code: "compiled-frame-geometry-mismatch" }),
    ]);
  });
});
