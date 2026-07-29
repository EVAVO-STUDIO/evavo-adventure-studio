import { describe, expect, it } from "vitest";
import { assetBuildManifestSchema } from "@evavo/adventure-asset-contract";
import type { Id } from "@evavo/adventure-project-schema";
import {
  compileImage,
  encodeRgbaPng,
  type RgbaImage,
} from "../src/index.js";
import { compileAtlas } from "../src/atlas-compiler.js";
import {
  createArtVisualEvidenceFromAssetManifest,
  createArtVisualEvidenceManifest,
  createImageArtVisualEvidence,
  createSpritesheetArtVisualEvidence,
} from "../src/art-evidence.js";
import {
  analysePngEvidence,
  classifyAlphaMode,
} from "../src/png-evidence.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;
const hash = "0".repeat(64);

const image = (
  pixels: readonly (readonly [number, number, number, number])[],
): RgbaImage => {
  const data = new Uint8Array(pixels.length * 4);
  pixels.forEach((pixel, index) => data.set(pixel, index * 4));
  return { width: pixels.length, height: 1, data };
};

describe("PNG visual evidence", () => {
  it("classifies opaque, binary and full alpha", () => {
    expect(classifyAlphaMode(image([[10, 20, 30, 255]]))).toBe("opaque");
    expect(
      classifyAlphaMode(
        image([
          [10, 20, 30, 255],
          [0, 0, 0, 0],
        ]),
      ),
    ).toBe("binary");
    expect(classifyAlphaMode(image([[10, 20, 30, 128]]))).toBe("full");
  });

  it("reads encoded palette and colour evidence", async () => {
    const encoded = await encodeRgbaPng(
      image([
        [255, 0, 0, 255],
        [0, 0, 0, 0],
      ]),
      { mode: "indexed-png", colours: 16, dither: 0 },
    );

    expect(await analysePngEvidence(encoded)).toEqual({
      palette: true,
      colourCount: 2,
      alphaMode: "binary",
    });
  });
});

describe("art evidence builders", () => {
  it("derives image evidence from compiled image bytes", async () => {
    const source = await encodeRgbaPng(
      image([
        [20, 30, 40, 255],
        [50, 60, 70, 255],
      ]),
    );
    const compiled = await compileImage(source, {
      assetId: id<"asset">("asset.office"),
      trim: { mode: "none" },
      output: { mode: "indexed-png", colours: 16, dither: 0 },
    });

    expect(await createImageArtVisualEvidence(compiled)).toEqual({
      assetId: "asset.office",
      kind: "image",
      palette: true,
      colourCount: 2,
      alphaMode: "opaque",
    });
  });

  it("derives stable per-page atlas evidence", async () => {
    const atlas = await compileAtlas(
      [
        {
          id: id<"sprite-frame">("frame.actor.idle"),
          image: image([
            [255, 255, 255, 255],
            [0, 0, 0, 0],
          ]),
          originalSize: { width: 4, height: 3 },
          trimOffset: { x: 1, y: 1 },
        },
      ],
      {
        pageWidth: 16,
        pageHeight: 16,
        padding: 1,
        output: { mode: "indexed-png", colours: 16, dither: 0 },
      },
    );

    const evidence = await createSpritesheetArtVisualEvidence(
      id<"asset">("asset.actor"),
      atlas,
    );
    expect(evidence).toMatchObject({
      assetId: "asset.actor",
      kind: "spritesheet",
      pages: [
        {
          outputRole: "page-000",
          palette: true,
          alphaMode: "binary",
        },
      ],
    });

    expect(
      createArtVisualEvidenceManifest(
        id<"project">("project.evidence"),
        [evidence],
        "1.2.3",
      ),
    ).toMatchObject({
      manifestVersion: 1,
      projectId: "project.evidence",
      compilerVersion: "1.2.3",
      assets: [{ assetId: "asset.actor" }],
    });
  });

  it("reads image and atlas page bytes by declared output role", async () => {
    const opaqueImage = await encodeRgbaPng(
      image([
        [40, 50, 60, 255],
        [80, 90, 100, 255],
      ]),
      { mode: "indexed-png", colours: 16, dither: 0 },
    );
    const binaryAtlas = await encodeRgbaPng(
      image([
        [255, 255, 255, 255],
        [0, 0, 0, 0],
      ]),
      { mode: "indexed-png", colours: 16, dither: 0 },
    );
    const manifest = assetBuildManifestSchema.parse({
      manifestVersion: 1,
      projectId: "project.manifest-evidence",
      compilerVersion: "2.0.0",
      fingerprint: hash,
      assets: [
        {
          assetId: "asset.z-actor",
          kind: "spritesheet",
          sourceFiles: [
            { path: "art/actor.aseprite", sha256: hash, byteLength: 10 },
          ],
          outputFiles: [
            {
              role: "atlas-manifest",
              runtimePath: "assets/actor/atlas.json",
              mediaType: "application/json",
              sha256: hash,
              byteLength: 10,
            },
            {
              role: "page-000",
              runtimePath: "assets/actor/page.png",
              mediaType: "image/png",
              sha256: hash,
              byteLength: binaryAtlas.byteLength,
            },
          ],
          metadata: {
            kind: "spritesheet",
            pages: [{ outputRole: "page-000", width: 2, height: 1 }],
            frames: [
              {
                frameId: "frame.actor.idle",
                pageOutputRole: "page-000",
                sourceRect: { x: 0, y: 0, width: 2, height: 1 },
                originalSize: { width: 2, height: 1 },
                trimOffset: { x: 0, y: 0 },
                padding: 0,
              },
            ],
          },
        },
        {
          assetId: "asset.a-office",
          kind: "image",
          sourceFiles: [
            { path: "art/office.png", sha256: hash, byteLength: 10 },
          ],
          outputFiles: [
            {
              role: "primary",
              runtimePath: "assets/office.png",
              mediaType: "image/png",
              sha256: hash,
              byteLength: opaqueImage.byteLength,
            },
          ],
          metadata: {
            kind: "image",
            width: 2,
            height: 1,
            palette: true,
            colourCount: 2,
          },
        },
      ],
    });
    const bytesByPath = new Map<string, Uint8Array>([
      ["assets/office.png", opaqueImage],
      ["assets/actor/page.png", binaryAtlas],
    ]);
    const reads: string[] = [];

    const evidence = await createArtVisualEvidenceFromAssetManifest(
      manifest,
      async (_assetId, output) => {
        reads.push(output.runtimePath);
        const bytes = bytesByPath.get(output.runtimePath);
        if (!bytes) throw new Error(`Unexpected output '${output.runtimePath}'.`);
        return bytes;
      },
    );

    expect(reads).toEqual([
      "assets/office.png",
      "assets/actor/page.png",
    ]);
    expect(evidence).toMatchObject({
      projectId: "project.manifest-evidence",
      compilerVersion: "2.0.0",
      assets: [
        {
          assetId: "asset.a-office",
          kind: "image",
          palette: true,
          alphaMode: "opaque",
        },
        {
          assetId: "asset.z-actor",
          kind: "spritesheet",
          pages: [
            {
              outputRole: "page-000",
              palette: true,
              alphaMode: "binary",
            },
          ],
        },
      ],
    });
  });
});
