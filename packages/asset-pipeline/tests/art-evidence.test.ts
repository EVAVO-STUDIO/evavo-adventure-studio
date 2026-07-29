import { describe, expect, it } from "vitest";
import type { Id } from "@evavo/adventure-project-schema";
import {
  compileImage,
  encodeRgbaPng,
  type RgbaImage,
} from "../src/index.js";
import { compileAtlas } from "../src/atlas-compiler.js";
import {
  createArtVisualEvidenceManifest,
  createImageArtVisualEvidence,
  createSpritesheetArtVisualEvidence,
} from "../src/art-evidence.js";
import {
  analysePngEvidence,
  classifyAlphaMode,
} from "../src/png-evidence.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

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
});
