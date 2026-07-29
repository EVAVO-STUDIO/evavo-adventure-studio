import { describe, expect, it } from "vitest";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  assetBuildManifestSchema,
  validateAssetBuildManifest,
  type AssetBuildManifest,
} from "../src/index.js";

const hash = "0".repeat(64);

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.asset-contract",
  title: "Asset Contract",
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
          position: { x: 20, y: 160 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  actors: [],
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
  compilerVersion: "0.1.0",
  fingerprint: hash,
  assets: [
    {
      assetId: "asset.office",
      kind: "image",
      sourceFiles: [
        { path: "art/office.png", sha256: hash, byteLength: 1024 },
      ],
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/office.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 800,
        },
      ],
      metadata: {
        kind: "image",
        width: 320,
        height: 200,
        palette: false,
        colourCount: 128,
      },
    },
    {
      assetId: "asset.detective",
      kind: "spritesheet",
      sourceFiles: [
        {
          path: "art/detective.aseprite",
          sha256: hash,
          byteLength: 2048,
        },
      ],
      outputFiles: [
        {
          role: "atlas-manifest",
          runtimePath: "assets/detective.atlas.json",
          mediaType: "application/json",
          sha256: hash,
          byteLength: 400,
        },
        {
          role: "page-000",
          runtimePath: "assets/detective-000.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1200,
        },
      ],
      metadata: {
        kind: "spritesheet",
        pages: [{ outputRole: "page-000", width: 512, height: 512 }],
        frames: [
          {
            frameId: "frame.detective.idle",
            pageOutputRole: "page-000",
            sourceRect: { x: 2, y: 2, width: 32, height: 64 },
            originalSize: { width: 40, height: 72 },
            trimOffset: { x: 4, y: 6 },
            padding: 2,
          },
        ],
      },
    },
  ],
});

describe("compiled asset manifest", () => {
  it("accepts complete project-scoped runtime assets", () => {
    expect(validateAssetBuildManifest(project, manifest)).toEqual([]);
  });

  it("rejects parent traversal and Windows separators in runtime paths", () => {
    const primary = manifest.assets[0]!.outputFiles[0]!;

    expect(() =>
      assetBuildManifestSchema.parse({
        ...manifest,
        assets: [
          {
            ...manifest.assets[0],
            outputFiles: [{ ...primary, runtimePath: "../office.png" }],
          },
          manifest.assets[1],
        ],
      }),
    ).toThrow();
    expect(() =>
      assetBuildManifestSchema.parse({
        ...manifest,
        assets: [
          {
            ...manifest.assets[0],
            outputFiles: [{ ...primary, runtimePath: "assets\\office.png" }],
          },
          manifest.assets[1],
        ],
      }),
    ).toThrow();
  });

  it("reports missing project assets, duplicate paths, and unknown atlas page roles", () => {
    const broken: AssetBuildManifest = {
      ...manifest,
      assets: [
        {
          ...manifest.assets[1]!,
          outputFiles: manifest.assets[1]!.outputFiles.map((output) =>
            output.role === "page-000"
              ? { ...output, runtimePath: "assets/shared.png" }
              : output,
          ),
          metadata: {
            ...manifest.assets[1]!.metadata,
            kind: "spritesheet",
            frames: manifest.assets[1]!.metadata.kind === "spritesheet"
              ? manifest.assets[1]!.metadata.frames.map((frame) => ({
                  ...frame,
                  pageOutputRole: "page-missing",
                }))
              : [],
          },
        },
        {
          ...manifest.assets[1]!,
          assetId: "asset.unexpected",
          outputFiles: manifest.assets[1]!.outputFiles.map((output) => ({
            ...output,
            runtimePath:
              output.role === "page-000"
                ? "assets/shared.png"
                : "assets/unexpected.atlas.json",
          })),
        },
      ],
    };

    const codes = validateAssetBuildManifest(project, broken).map(
      (issue) => issue.code,
    );
    expect(codes).toEqual(
      expect.arrayContaining([
        "missing-asset",
        "unexpected-asset",
        "duplicate-runtime-path",
        "unknown-page-role",
      ]),
    );
  });
});
