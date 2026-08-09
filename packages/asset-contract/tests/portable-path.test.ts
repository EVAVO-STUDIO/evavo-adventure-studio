import { describe, expect, it } from "vitest";
import { assetBuildManifestSchema } from "../src/index.js";
import {
  portablePathKey,
  portableRelativePathError,
  validatePortableRuntimePaths,
} from "../src/portable-path.js";

const hash = "0".repeat(64);

const record = (assetId: string, runtimePath: string) => ({
  assetId,
  kind: "image" as const,
  sourceFiles: [
    {
      path: `source/${assetId}.png`,
      sha256: hash,
      byteLength: 1,
    },
  ],
  outputFiles: [
    {
      role: "primary",
      runtimePath,
      mediaType: "image/png",
      sha256: hash,
      byteLength: 1,
    },
  ],
  metadata: {
    kind: "image" as const,
    width: 1,
    height: 1,
    palette: false,
    colourCount: 1,
  },
});

describe("portable runtime paths", () => {
  it("accepts stable forward-slash asset paths", () => {
    expect(portableRelativePathError("assets/office/window-light.png")).toBeNull();
    expect(portablePathKey("Assets/Office.PNG")).toBe("assets/office.png");
  });

  it("rejects traversal, Windows separators and reserved device names", () => {
    expect(portableRelativePathError("../office.png")).not.toBeNull();
    expect(portableRelativePathError("assets\\office.png")).not.toBeNull();
    expect(portableRelativePathError("assets/CON.png")).not.toBeNull();
    expect(portableRelativePathError("assets/trailing. ")).not.toBeNull();
    expect(portableRelativePathError("assets/bad:name.png")).not.toBeNull();
  });

  it("detects case-insensitive collisions before a Windows package build", () => {
    const manifest = assetBuildManifestSchema.parse({
      manifestVersion: 1,
      projectId: "project.paths",
      compilerVersion: "0.1.0-test",
      fingerprint: hash,
      assets: [record("asset.upper", "assets/Office.png"), record("asset.lower", "assets/office.png")],
    });

    expect(validatePortableRuntimePaths(manifest)).toEqual([
      expect.objectContaining({ code: "portable-runtime-path-collision" }),
    ]);
  });
});
