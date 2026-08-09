import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import {
  type AssetBuildManifest,
  assetBuildManifestSchema,
  type CompiledAssetRecord,
  validateAssetBuildManifest,
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
      sourceFiles: [{ path: "art/office.png", sha256: hash, byteLength: 1024 }],
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

const imageAsset = (): Extract<CompiledAssetRecord, { readonly kind: "image" }> => {
  const asset = manifest.assets.find((candidate) => candidate.kind === "image");
  if (!asset || asset.kind !== "image") {
    throw new Error("Image fixture is missing.");
  }
  return asset;
};

const spritesheetAsset = (): Extract<CompiledAssetRecord, { readonly kind: "spritesheet" }> => {
  const asset = manifest.assets.find((candidate) => candidate.kind === "spritesheet");
  if (!asset || asset.kind !== "spritesheet") {
    throw new Error("Spritesheet fixture is missing.");
  }
  return asset;
};

describe("compiled asset manifest", () => {
  it("accepts complete project-scoped runtime assets", () => {
    expect(validateAssetBuildManifest(project, manifest)).toEqual([]);
  });

  it("rejects parent traversal and Windows separators in runtime paths", () => {
    const image = imageAsset();
    const primary = image.outputFiles[0]!;

    expect(() =>
      assetBuildManifestSchema.parse({
        ...manifest,
        assets: [
          {
            ...image,
            outputFiles: [{ ...primary, runtimePath: "../office.png" }],
          },
          spritesheetAsset(),
        ],
      }),
    ).toThrow();
    expect(() =>
      assetBuildManifestSchema.parse({
        ...manifest,
        assets: [
          {
            ...image,
            outputFiles: [{ ...primary, runtimePath: "assets\\office.png" }],
          },
          spritesheetAsset(),
        ],
      }),
    ).toThrow();
  });

  it("reports missing assets, duplicate paths and unknown atlas pages", () => {
    const spritesheet = spritesheetAsset();
    const brokenSpritesheet: typeof spritesheet = {
      ...spritesheet,
      outputFiles: spritesheet.outputFiles.map((output) =>
        output.role === "page-000" ? { ...output, runtimePath: "assets/shared.png" } : output,
      ),
      metadata: {
        ...spritesheet.metadata,
        frames: spritesheet.metadata.frames.map((frame) => ({
          ...frame,
          pageOutputRole: "page-missing",
        })),
      },
    };
    const unexpected: typeof spritesheet = {
      ...spritesheet,
      assetId: "asset.unexpected" as typeof spritesheet.assetId,
      outputFiles: spritesheet.outputFiles.map((output) => ({
        ...output,
        runtimePath: output.role === "page-000" ? "assets/shared.png" : "assets/unexpected.atlas.json",
      })),
    };
    const broken: AssetBuildManifest = {
      ...manifest,
      assets: [brokenSpritesheet, unexpected],
    };

    const codes = validateAssetBuildManifest(project, broken).map((issue) => issue.code);
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
