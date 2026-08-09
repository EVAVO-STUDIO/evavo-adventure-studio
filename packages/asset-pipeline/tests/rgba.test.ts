import { describe, expect, it } from "vitest";
import {
  countUniqueRgbaColours,
  cropRgba,
  extrudeRgba,
  findAlphaBounds,
  normalizeTransparentRgb,
  type RgbaImage,
} from "../src/rgba.js";

const image: RgbaImage = {
  width: 3,
  height: 3,
  data: new Uint8Array([
    255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 20, 30, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0,
  ]),
};

describe("canonical RGBA operations", () => {
  it("zeros hidden RGB values in fully transparent pixels", () => {
    const normalized = normalizeTransparentRgb(image);

    expect([...normalized.data.slice(0, 4)]).toEqual([0, 0, 0, 0]);
    expect([...normalized.data.slice(16, 20)]).toEqual([10, 20, 30, 255]);
    expect([...image.data.slice(0, 4)]).toEqual([255, 0, 0, 0]);
  });

  it("finds inclusive alpha bounds and crops without interpolation", () => {
    const bounds = findAlphaBounds(image);
    expect(bounds).toEqual({ x: 1, y: 1, width: 1, height: 1 });

    const cropped = cropRgba(image, bounds!);
    expect(cropped).toEqual({
      width: 1,
      height: 1,
      data: new Uint8Array([10, 20, 30, 255]),
    });
  });

  it("extrudes exact edge pixels around a frame", () => {
    const source: RgbaImage = {
      width: 2,
      height: 1,
      data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]),
    };
    const extruded = extrudeRgba(source, 1);

    expect(extruded.width).toBe(4);
    expect(extruded.height).toBe(3);
    for (let y = 0; y < 3; y += 1) {
      const row = [...extruded.data.slice(y * 16, y * 16 + 16)];
      expect(row).toEqual([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255]);
    }
  });

  it("counts complete RGBA values rather than visible RGB only", () => {
    const colours: RgbaImage = {
      width: 2,
      height: 1,
      data: new Uint8Array([20, 30, 40, 255, 20, 30, 40, 128]),
    };

    expect(countUniqueRgbaColours(colours)).toBe(2);
  });
});
