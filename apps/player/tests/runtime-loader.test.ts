import { describe, expect, it } from "vitest";
import {
  createRuntimeStartFrame,
  loadRuntimeBundle,
  type RuntimeBundleFetch,
} from "../src/runtime-loader.js";

const hash = "0".repeat(64);

const bundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.player-fixture",
  title: "Player Fixture",
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
  assetCompilerVersion: "0.1.0-test",
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
          position: { x: 12, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  dialogues: [],
  sequences: [],
};

const response = (
  input: unknown,
  overrides: Partial<{
    readonly ok: boolean;
    readonly status: number;
    readonly statusText: string;
  }> = {},
): RuntimeBundleFetch => async () => ({
  ok: overrides.ok ?? true,
  status: overrides.status ?? 200,
  statusText: overrides.statusText ?? "OK",
  json: async () => input,
});

describe("packaged runtime loading", () => {
  it("parses a valid source-free bundle", async () => {
    const loaded = await loadRuntimeBundle(
      "https://example.test/release/game.bundle.json",
      response(bundle),
    );

    expect(loaded.projectId).toBe("project.player-fixture");
    expect(loaded.assets[0]?.outputFiles[0]?.runtimePath).toBe(
      "assets/office.png",
    );
  });

  it("reports HTTP failures with the bundle URL and status", async () => {
    await expect(
      loadRuntimeBundle(
        "https://example.test/missing/game.bundle.json",
        response({}, { ok: false, status: 404, statusText: "Not Found" }),
      ),
    ).rejects.toMatchObject({
      name: "RuntimeBundleFetchError",
      status: 404,
      bundleUrl: "https://example.test/missing/game.bundle.json",
    });
  });

  it("rejects malformed or semantically broken bundle JSON", async () => {
    const broken = { ...bundle, startSceneId: "scene.missing" };

    await expect(
      loadRuntimeBundle(
        "https://example.test/release/game.bundle.json",
        response(broken),
      ),
    ).rejects.toThrow();
  });

  it("wraps network failures without losing their message", async () => {
    const failingFetch: RuntimeBundleFetch = async () => {
      throw new Error("network offline");
    };

    await expect(
      loadRuntimeBundle(
        "https://example.test/release/game.bundle.json",
        failingFetch,
      ),
    ).rejects.toThrow("network offline");
  });

  it("resolves the start-room background as a native sprite node", async () => {
    const loaded = await loadRuntimeBundle(
      "https://example.test/release/game.bundle.json",
      response(bundle),
    );
    const frame = createRuntimeStartFrame(loaded, 12);

    expect(frame.canvas).toEqual({
      width: 320,
      height: 200,
      clearColor: [0, 0, 0, 255],
    });
    expect(frame.nodes).toEqual([
      expect.objectContaining({
        kind: "sprite",
        assetId: "asset.office",
        sourceRect: { x: 0, y: 0, width: 320, height: 200 },
        sampling: "nearest",
      }),
    ]);
  });
});
