import { describe, expect, it } from "vitest";
import { expandDitheredIndexedPixels } from "../src/indexed-dither.js";

const surface = {
  width: 4,
  height: 4,
  indices: new Uint8Array(16).fill(0),
};

const basePalette = {
  entries: new Uint8Array([10, 20, 30, 255]),
};

const targetPalette = {
  entries: new Uint8Array([200, 210, 220, 255]),
};

const pixels = (rgba: Uint8Array): readonly string[] => {
  const output: string[] = [];
  for (let offset = 0; offset < rgba.length; offset += 4) {
    output.push(`${rgba[offset]},${rgba[offset + 1]},${rgba[offset + 2]},${rgba[offset + 3]}`);
  }
  return output;
};

describe("indexed ordered palette dither", () => {
  it("uses only the base palette at zero coverage and only the target at full coverage", () => {
    expect(
      new Set(
        pixels(
          expandDitheredIndexedPixels(surface, basePalette, targetPalette, {
            basePaletteOffset: 0,
            targetPaletteOffset: 0,
            coverage: 0,
            matrix: "bayer-4",
          }),
        ),
      ),
    ).toEqual(new Set(["10,20,30,255"]));

    expect(
      new Set(
        pixels(
          expandDitheredIndexedPixels(surface, basePalette, targetPalette, {
            basePaletteOffset: 0,
            targetPaletteOffset: 0,
            coverage: 1,
            matrix: "bayer-4",
          }),
        ),
      ),
    ).toEqual(new Set(["200,210,220,255"]));
  });

  it("selects only authored palette colours at half coverage", () => {
    const result = pixels(
      expandDitheredIndexedPixels(surface, basePalette, targetPalette, {
        basePaletteOffset: 0,
        targetPaletteOffset: 0,
        coverage: 0.5,
        matrix: "bayer-4",
      }),
    );
    expect(new Set(result)).toEqual(
      new Set(["10,20,30,255", "200,210,220,255"]),
    );
    expect(result.filter((pixel) => pixel === "200,210,220,255")).toHaveLength(8);
  });

  it("keeps the Bayer pattern stable but allows an authored native origin phase", () => {
    const first = pixels(
      expandDitheredIndexedPixels(surface, basePalette, targetPalette, {
        basePaletteOffset: 0,
        targetPaletteOffset: 0,
        coverage: 0.25,
        matrix: "bayer-4",
        originX: 0,
        originY: 0,
      }),
    );
    const shifted = pixels(
      expandDitheredIndexedPixels(surface, basePalette, targetPalette, {
        basePaletteOffset: 0,
        targetPaletteOffset: 0,
        coverage: 0.25,
        matrix: "bayer-4",
        originX: 1,
        originY: 0,
      }),
    );
    expect(first).not.toEqual(shifted);
    expect(new Set(first)).toEqual(
      new Set(["10,20,30,255", "200,210,220,255"]),
    );
    expect(new Set(shifted)).toEqual(
      new Set(["10,20,30,255", "200,210,220,255"]),
    );
  });

  it("rejects coverage outside the deterministic transition range", () => {
    expect(() =>
      expandDitheredIndexedPixels(surface, basePalette, targetPalette, {
        basePaletteOffset: 0,
        targetPaletteOffset: 0,
        coverage: 1.1,
        matrix: "bayer-4",
      }),
    ).toThrow(/coverage/u);
  });
});
