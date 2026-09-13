import { validateAssetBuildManifest } from "@evavo/adventure-asset-contract";
import { type Id, parseAdventureProject } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { compileAtlas } from "../src/atlas-compiler.js";
import { compileImage, encodeRgbaPng, sha256Hex } from "../src/index.js";
import {
  createAssetBuildManifest,
  createImageAssetRecord,
  createSpritesheetAssetRecord,
} from "../src/manifest-builders.js";
import type { RgbaImage } from "../src/rgba.js";

const id = <T extends string>(value: string) => value as Id<T>;

const solid = (
  width: number,
  height: number,
  colour: readonly [number, number, number, number],
): RgbaImage => {
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data.set(colour, index);
  }
  return { width, height, data };
};

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.asset-build",
  title: "Asset Build",
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
    { id: "asset.office", path: "source/office.png", kind: "image" },
    {
      id: "asset.detective",
      path: "source/detective.aseprite",
      kind: "spritesheet",
    },
  ],
  inventoryItems: [],
});

const authoredAsset = (assetId: string) => {
  const asset = project.assets.find((candidate) => candidate.id === assetId);
  if (!asset) {
    throw new Error(`Missing authored asset fixture '${assetId}'.`);
  }
  return asset;
};

const buildRecords = async () => {
  const officeSource = await encodeRgbaPng(solid(4, 4, [28, 30, 42, 255]));
  const officeCompiled = await compileImage(officeSource, {
    assetId: id<"asset">("asset.office"),
    trim: { mode: "none" },
    output: { mode: "indexed-png", colours: 16, dither: 0 },
  });
  const officeRecord = createImageAssetRecord(
    authoredAsset("asset.office"),
    officeCompiled,
    "assets/office.png",
  );

  const atlas = await compileAtlas(
    [
      {
        id: id<"sprite-frame">("frame.detective.idle"),
        image: solid(8, 12, [50, 55, 70, 255]),
        originalSize: { width: 12, height: 16 },
        trimOffset: { x: 2, y: 3 },
      },
    ],
    {
      pageWidth: 32,
      pageHeight: 32,
      padding: 1,
      pageNamePrefix: "detective",
      output: { mode: "rgba-png" },
    },
  );
  const sourceBytes = new TextEncoder().encode("aseprite-source-fixture");
  const detectiveRecord = createSpritesheetAssetRecord(authoredAsset("asset.detective"), atlas, {
    sourceFiles: [
      {
        path: "source/detective.aseprite",
        sha256: await sha256Hex(sourceBytes),
        byteLength: sourceBytes.byteLength,
      },
    ],
    runtimeDirectory: "assets/detective",
  });

  return { officeRecord, detectiveRecord };
};

describe("compiled asset manifest builders", () => {
  it("builds a complete manifest from image and atlas artifacts", async () => {
    const { officeRecord, detectiveRecord } = await buildRecords();
    const manifest = await createAssetBuildManifest(project.id, [detectiveRecord, officeRecord]);

    expect(validateAssetBuildManifest(project, manifest)).toEqual([]);
    expect(manifest.assets.map((asset) => asset.assetId)).toEqual(["asset.detective", "asset.office"]);
    expect(manifest.fingerprint).toHaveLength(64);

    const detective = manifest.assets[0]!;
    expect(detective.outputFiles.map((output) => output.role)).toEqual(["atlas-manifest", "page-000"]);
    expect(detective.outputFiles.map((output) => output.runtimePath)).toEqual([
      "assets/detective/asset.detective.atlas.json",
      "assets/detective/detective-000.png",
    ]);
  });

  it("fingerprints the same build identically regardless of record order", async () => {
    const { officeRecord, detectiveRecord } = await buildRecords();
    const left = await createAssetBuildManifest(project.id, [officeRecord, detectiveRecord]);
    const right = await createAssetBuildManifest(project.id, [detectiveRecord, officeRecord]);

    expect(left).toEqual(right);
  });
});
