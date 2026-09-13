import { describe, expect, it } from "vitest";
import {
  createRuntimeStartFrame,
  loadRuntimeBundle,
  runtimeBundleRequestFromUrl,
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

const frontEnd = {
  manifestVersion: 1,
  projectId: "project.player-fixture",
  publisher: {
    name: "EVAVO",
    presents: "ADVENTURE STUDIO PRESENTS",
    splashDurationTicks: 96,
    splashSkipAfterTicks: 18,
  },
  title: { kicker: "A PLAYER FIXTURE" },
  menu: {
    labels: {
      newGame: "NEW GAME",
      continueGame: "CONTINUE",
      loadGame: "LOAD GAME",
      options: "OPTIONS",
      credits: "CREDITS",
      quit: "QUIT",
      quickSave: "QUICK SAVE",
      back: "BACK",
      fullscreen: "TOGGLE FULLSCREEN",
    },
    showContinue: true,
    showLoad: true,
    showOptions: true,
    showCredits: true,
    showQuit: true,
  },
  options: { allowFullscreen: true },
  credits: { lines: ["BUILT WITH EVAVO ADVENTURE STUDIO"] },
};

const lifecycle = {
  manifestVersion: 1,
  projectId: "project.player-fixture",
  outcomes: [
    {
      id: "outcome.player-fixture.complete",
      kind: "success",
      priority: 100,
      when: { kind: "flag", flag: "fixture.complete", equals: true },
      title: "CASE COMPLETE",
      message: "The fixture reached its governed ending.",
      menu: {
        allowQuickRetry: false,
        allowLoad: true,
        allowRestart: true,
        allowTitle: true,
        labels: {
          quickRetry: "QUICK RETRY",
          loadGame: "LOAD GAME",
          restartGame: "RESTART GAME",
          returnToTitle: "RETURN TO TITLE",
          back: "BACK",
        },
      },
    },
  ],
};

const response =
  (
    input: unknown,
    overrides: Partial<{
      readonly ok: boolean;
      readonly status: number;
      readonly statusText: string;
    }> = {},
  ): RuntimeBundleFetch =>
  async () => ({
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    statusText: overrides.statusText ?? "OK",
    json: async () => input,
  });

const responseMap = (
  values: Readonly<Record<string, unknown>>,
  requests: string[] = [],
): RuntimeBundleFetch =>
  async (input) => {
    requests.push(input);
    if (!Object.hasOwn(values, input)) {
      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({}),
      };
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => values[input],
    };
  };

describe("packaged runtime loading", () => {
  it("parses a valid source-free bundle", async () => {
    const loaded = await loadRuntimeBundle(
      "https://example.test/release/game.bundle.json",
      response(bundle),
    );

    expect(loaded.projectId).toBe("project.player-fixture");
    expect(loaded.assets[0]?.outputFiles[0]?.runtimePath).toBe("assets/office.png");
  });

  it("resolves presentation sidecars from client-only bundle URL metadata", () => {
    expect(
      runtimeBundleRequestFromUrl(
        "https://example.test/release/game.bundle.json#" +
          "frontEnd=manifests%2Ffront-end.json&lifecycle=manifests%2Fending.json",
      ),
    ).toEqual({
      bundleUrl: "https://example.test/release/game.bundle.json",
      frontEndUrl: "https://example.test/release/manifests/front-end.json",
      lifecycleUrl: "https://example.test/release/manifests/ending.json",
    });
  });

  it("attaches and parses governed presentation sidecars before returning the bundle", async () => {
    const requests: string[] = [];
    const loaded = await loadRuntimeBundle(
      "https://example.test/release/game.bundle.json#frontEnd=front-end.json&lifecycle=lifecycle.json",
      responseMap(
        {
          "https://example.test/release/game.bundle.json": bundle,
          "https://example.test/release/front-end.json": frontEnd,
          "https://example.test/release/lifecycle.json": lifecycle,
        },
        requests,
      ),
    );

    expect(requests).toEqual([
      "https://example.test/release/game.bundle.json",
      "https://example.test/release/front-end.json",
      "https://example.test/release/lifecycle.json",
    ]);
    expect(loaded.frontEnd).toEqual(frontEnd);
    expect(loaded.lifecycle).toEqual(lifecycle);
  });

  it("rejects a sidecar when the runtime bundle already owns front-end data", async () => {
    await expect(
      loadRuntimeBundle(
        "https://example.test/release/game.bundle.json#frontEnd=front-end.json",
        responseMap({
          "https://example.test/release/game.bundle.json": { ...bundle, frontEnd },
          "https://example.test/release/front-end.json": frontEnd,
        }),
      ),
    ).rejects.toThrow("already defines frontEnd data");
  });

  it("rejects a sidecar when the runtime bundle already owns lifecycle data", async () => {
    await expect(
      loadRuntimeBundle(
        "https://example.test/release/game.bundle.json#lifecycle=lifecycle.json",
        responseMap({
          "https://example.test/release/game.bundle.json": { ...bundle, lifecycle },
          "https://example.test/release/lifecycle.json": lifecycle,
        }),
      ),
    ).rejects.toThrow("already defines lifecycle data");
  });

  it("reports front-end sidecar HTTP failures against the sidecar URL", async () => {
    await expect(
      loadRuntimeBundle(
        "https://example.test/release/game.bundle.json#frontEnd=missing.json",
        responseMap({ "https://example.test/release/game.bundle.json": bundle }),
      ),
    ).rejects.toMatchObject({
      name: "RuntimeBundleFetchError",
      status: 404,
      bundleUrl: "https://example.test/release/missing.json",
    });
  });

  it("reports lifecycle sidecar HTTP failures against the sidecar URL", async () => {
    await expect(
      loadRuntimeBundle(
        "https://example.test/release/game.bundle.json#lifecycle=missing.json",
        responseMap({ "https://example.test/release/game.bundle.json": bundle }),
      ),
    ).rejects.toMatchObject({
      name: "RuntimeBundleFetchError",
      status: 404,
      bundleUrl: "https://example.test/release/missing.json",
    });
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
      loadRuntimeBundle("https://example.test/release/game.bundle.json", response(broken)),
    ).rejects.toThrow();
  });

  it("wraps network failures without losing their message", async () => {
    const failingFetch: RuntimeBundleFetch = async () => {
      throw new Error("network offline");
    };

    await expect(
      loadRuntimeBundle("https://example.test/release/game.bundle.json", failingFetch),
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
