import type { RuntimeAssetRecord } from "@evavo/adventure-asset-contract";
import type { Id } from "@evavo/adventure-project-schema";
import type { Texture } from "pixi.js";
import { describe, expect, it } from "vitest";
import {
  PixiAssetTextureStore,
  PixiRuntimeAssetOutputError,
  planRuntimeTextureLoads,
} from "../src/texture-store.js";

const id = <T extends string>(value: string) => value as Id<T>;
const hash = "0".repeat(64);

const imageAsset: Extract<RuntimeAssetRecord, { readonly kind: "image" }> = {
  assetId: id<"asset">("asset.office"),
  kind: "image",
  outputFiles: [
    {
      role: "primary",
      runtimePath: "assets/office.png",
      mediaType: "image/png",
      sha256: hash,
      byteLength: 10,
    },
  ],
  metadata: {
    kind: "image",
    width: 320,
    height: 200,
    palette: false,
    colourCount: 64,
  },
};

const spritesheetAsset: Extract<RuntimeAssetRecord, { readonly kind: "spritesheet" }> = {
  assetId: id<"asset">("asset.detective"),
  kind: "spritesheet",
  outputFiles: [
    {
      role: "atlas-manifest",
      runtimePath: "assets/detective.atlas.json",
      mediaType: "application/json",
      sha256: hash,
      byteLength: 20,
    },
    {
      role: "page-001",
      runtimePath: "assets/detective-001.png",
      mediaType: "image/png",
      sha256: hash,
      byteLength: 30,
    },
    {
      role: "page-000",
      runtimePath: "assets/detective-000.png",
      mediaType: "image/png",
      sha256: hash,
      byteLength: 30,
    },
  ],
  metadata: {
    kind: "spritesheet",
    pages: [
      { outputRole: "page-001", width: 256, height: 256 },
      { outputRole: "page-000", width: 256, height: 256 },
    ],
    frames: [
      {
        frameId: id<"sprite-frame">("frame.walk.2"),
        pageOutputRole: "page-001",
        sourceRect: { x: 2, y: 2, width: 20, height: 40 },
        originalSize: { width: 24, height: 44 },
        trimOffset: { x: 2, y: 4 },
        padding: 2,
      },
      {
        frameId: id<"sprite-frame">("frame.walk.1"),
        pageOutputRole: "page-000",
        sourceRect: { x: 2, y: 2, width: 20, height: 40 },
        originalSize: { width: 24, height: 44 },
        trimOffset: { x: 2, y: 4 },
        padding: 2,
      },
    ],
  },
};

describe("runtime texture planning", () => {
  it("uses the primary output for standalone images", () => {
    expect(planRuntimeTextureLoads(imageAsset)).toEqual({
      requests: [
        {
          assetId: "asset.office",
          role: "primary",
          runtimePath: "assets/office.png",
        },
      ],
      frameRoleById: new Map(),
    });
  });

  it("loads atlas pages in stable role order and maps frames to pages", () => {
    const plan = planRuntimeTextureLoads(spritesheetAsset);

    expect(plan.requests.map((request) => request.role)).toEqual(["page-000", "page-001"]);
    expect(plan.frameRoleById).toEqual(
      new Map([
        ["frame.walk.2", "page-001"],
        ["frame.walk.1", "page-000"],
      ]),
    );
  });

  it("fails rather than guessing a missing atlas page", () => {
    const broken: typeof spritesheetAsset = {
      ...spritesheetAsset,
      outputFiles: spritesheetAsset.outputFiles.filter((output) => output.role !== "page-001"),
    };

    expect(() => planRuntimeTextureLoads(broken)).toThrow(PixiRuntimeAssetOutputError);
  });

  it("resolves registered frame textures before image fallbacks", () => {
    const store = new PixiAssetTextureStore();
    const primary = {} as Texture;
    const frame = {} as Texture;
    store.registerTexture(imageAsset.assetId, primary);
    store.registerFrameTexture(imageAsset.assetId, id<"sprite-frame">("frame.office.detail"), frame);

    expect(store.getTexture(imageAsset.assetId)).toBe(primary);
    expect(store.getTexture(imageAsset.assetId, id<"sprite-frame">("frame.office.detail"))).toBe(frame);
    expect(store.getTexture(imageAsset.assetId, id<"sprite-frame">("frame.office.other"))).toBe(primary);
  });
});
