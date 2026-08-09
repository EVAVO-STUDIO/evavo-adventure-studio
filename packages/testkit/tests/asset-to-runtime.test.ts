import { compileImage, encodeRgbaPng, sha256Hex } from "@evavo/adventure-asset-pipeline";
import { compileAtlas } from "@evavo/adventure-asset-pipeline/atlas-compiler";
import {
  createAssetBuildManifest,
  createImageAssetRecord,
  createSpritesheetAssetRecord,
} from "@evavo/adventure-asset-pipeline/manifest-builders";
import { compileProject } from "@evavo/adventure-compiler";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { fixtureId } from "../src/index.js";

const rgba = (
  width: number,
  height: number,
  colour: readonly [number, number, number, number],
): { readonly width: number; readonly height: number; readonly data: Uint8Array } => {
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data.set(colour, index);
  }
  return { width, height, data };
};

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.integration",
  title: "Integration Fixture",
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
          position: { x: 24, y: 166 },
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
    {
      id: "asset.office",
      path: "authoring/art/office-master.png",
      kind: "image",
    },
    {
      id: "asset.detective",
      path: "authoring/art/detective-master.aseprite",
      kind: "spritesheet",
    },
  ],
  inventoryItems: [],
});

const authored = (assetId: string) => {
  const asset = project.assets.find((candidate) => candidate.id === assetId);
  if (!asset) {
    throw new Error(`Missing authored asset '${assetId}'.`);
  }
  return asset;
};

const buildManifest = async (reverse: boolean) => {
  const officeSource = await encodeRgbaPng(rgba(320, 200, [24, 26, 38, 255]));
  const office = createImageAssetRecord(
    authored("asset.office"),
    await compileImage(officeSource, {
      assetId: fixtureId<"asset">("asset.office"),
      trim: { mode: "none" },
      output: { mode: "indexed-png", colours: 16, dither: 0 },
    }),
    "assets/office.png",
  );

  const atlas = await compileAtlas(
    [
      {
        id: fixtureId<"sprite-frame">("frame.detective.idle"),
        image: rgba(6, 10, [52, 58, 76, 255]),
        originalSize: { width: 10, height: 14 },
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
  const detectiveSource = new TextEncoder().encode("detective-source");
  const detective = createSpritesheetAssetRecord(authored("asset.detective"), atlas, {
    sourceFiles: [
      {
        path: "authoring/art/detective-master.aseprite",
        sha256: await sha256Hex(detectiveSource),
        byteLength: detectiveSource.byteLength,
      },
    ],
    runtimeDirectory: "assets/detective",
  });

  return createAssetBuildManifest(project.id, reverse ? [detective, office] : [office, detective]);
};

describe("asset build to runtime bundle", () => {
  it("emits canonical runtime assets without authoring source paths", async () => {
    const manifest = await buildManifest(false);
    const compiled = compileProject(project, manifest);

    expect(compiled.bundle.assets.map((asset) => asset.assetId)).toEqual(["asset.detective", "asset.office"]);
    expect(compiled.bundle.assetManifestFingerprint).toBe(manifest.fingerprint);
    expect(compiled.canonicalJson).not.toContain("authoring/art");
    expect(compiled.canonicalJson).toContain("assets/office.png");
    expect(compiled.canonicalJson).toContain("assets/detective/detective-000.png");
  });

  it("keeps runtime bytes stable when build record order changes", async () => {
    const left = compileProject(project, await buildManifest(false));
    const right = compileProject(project, await buildManifest(true));

    expect(left.canonicalJson).toBe(right.canonicalJson);
    expect(left.fingerprint).toBe(right.fingerprint);
  });
});
