import { describe, expect, it } from "vitest";
import { expandIndexedPixels } from "../src/indexed-pixels.js";

describe("indexed pixel expansion", () => {
  it("expands palette indices deterministically with binary transparency", () => {
    const palette = new Uint8Array([
      0, 0, 0, 255,
      120, 80, 40, 255,
      220, 210, 180, 255,
      255, 255, 255, 255,
    ]);
    const rgba = expandIndexedPixels(
      {
        width: 2,
        height: 2,
        indices: new Uint8Array([0, 1, 2, 3]),
      },
      { entries: palette, transparentIndex: 0 },
    );

    expect([...rgba]).toEqual([
      0, 0, 0, 0,
      120, 80, 40, 255,
      220, 210, 180, 255,
      255, 255, 255, 255,
    ]);
  });

  it("applies palette offsets without mutating source indices", () => {
    const indices = new Uint8Array([0, 1]);
    const palette = new Uint8Array([
      1, 1, 1, 255,
      2, 2, 2, 255,
      100, 110, 120, 255,
      130, 140, 150, 255,
    ]);
    const rgba = expandIndexedPixels(
      { width: 2, height: 1, indices },
      { entries: palette },
      2,
    );

    expect([...rgba]).toEqual([100, 110, 120, 255, 130, 140, 150, 255]);
    expect([...indices]).toEqual([0, 1]);
  });

  it("fails closed on invalid dimensions, palettes and offset overflow", () => {
    expect(() =>
      expandIndexedPixels(
        { width: 2, height: 2, indices: new Uint8Array([0]) },
        { entries: new Uint8Array([0, 0, 0, 255]) },
      ),
    ).toThrow("expected 4");

    expect(() =>
      expandIndexedPixels(
        { width: 1, height: 1, indices: new Uint8Array([0]) },
        { entries: new Uint8Array([0, 0, 0]) },
      ),
    ).toThrow("RGBA quads");

    expect(() =>
      expandIndexedPixels(
        { width: 1, height: 1, indices: new Uint8Array([3]) },
        { entries: new Uint8Array([0, 0, 0, 255]) },
      ),
    ).toThrow("palette index 3");
  });
});
