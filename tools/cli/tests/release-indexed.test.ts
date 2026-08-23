import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { CompiledProject } from "@evavo/adventure-compiler";
import { describe, expect, it } from "vitest";
import { CliDataError } from "../src/diagnostics.js";
import type { IndexedRuntimeArtifact } from "../src/indexed-inputs.js";
import { buildRelease } from "../src/release.js";

const compiled = {
  bundle: { projectId: "project.release-indexed" },
  canonicalJson: '{"bundleVersion":1,"projectId":"project.release-indexed"}',
  fingerprint: "fnv1a64:1234567890abcdef",
  warnings: [],
} as unknown as CompiledProject;

const assetManifest = {
  fingerprint: "a".repeat(64),
  compilerVersion: "0.1.0-test",
} as AssetBuildManifest;

const indexed = (data: readonly number[], runtimePath = "indexed/actor.idx"): IndexedRuntimeArtifact => ({
  assetId: "asset.actor" as never,
  runtimePath,
  data: new Uint8Array(data),
});

describe("indexed release artifacts", () => {
  it("includes verified index maps in the release manifest and file set", () => {
    const release = buildRelease(compiled, assetManifest, [], [indexed([0, 1, 1, 0])]);
    const manifest = JSON.parse(new TextDecoder().decode(release.manifestData)) as {
      readonly files: readonly {
        readonly assetId: string;
        readonly role: string;
        readonly path: string;
        readonly mediaType: string;
        readonly byteLength: number;
        readonly sha256: string;
      }[];
    };
    expect(manifest.files).toEqual([
      expect.objectContaining({
        assetId: "asset.actor",
        role: "index-map",
        path: "indexed/actor.idx",
        mediaType: "application/octet-stream",
        byteLength: 4,
      }),
    ]);
    expect(release.files.map((file) => file.relativePath)).toContain("indexed/actor.idx");
  });

  it("changes the release fingerprint when indexed pixel bytes change", () => {
    const first = buildRelease(compiled, assetManifest, [], [indexed([0, 1, 1, 0])]);
    const second = buildRelease(compiled, assetManifest, [], [indexed([0, 1, 0, 0])]);
    expect(second.fingerprint).not.toBe(first.fingerprint);
  });

  it("rejects indexed files that collide with reserved release paths", () => {
    expect(() =>
      buildRelease(compiled, assetManifest, [], [indexed([0], "game.bundle.json")]),
    ).toThrow(CliDataError);
  });

  it("rejects indexed paths that collide with ordinary runtime assets", () => {
    expect(() =>
      buildRelease(
        compiled,
        assetManifest,
        [
          {
            assetId: "asset.background",
            output: {
              role: "primary",
              runtimePath: "indexed/actor.idx",
              mediaType: "image/png",
              sha256: "b".repeat(64),
              byteLength: 1,
            },
            data: new Uint8Array([1]),
          },
        ],
        [indexed([0])],
      ),
    ).toThrow(CliDataError);
  });
});
