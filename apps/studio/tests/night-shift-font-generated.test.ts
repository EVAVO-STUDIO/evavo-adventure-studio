import { describe, expect, it } from "vitest";
import {
  nightShiftFontGeneratedSource,
  nightShiftFontIndexBytes,
  nightShiftFontPngBytes,
} from "../src/night-shift-font-generated.js";

const pngDimensions = (bytes: Uint8Array): { width: number; height: number } => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

describe("Night Shift generated bitmap font", () => {
  it("produces the exact 96x48 one-byte index atlas", () => {
    const indices = nightShiftFontIndexBytes();
    expect(indices.byteLength).toBe(96 * 48);
    expect(new Set(indices)).toEqual(new Set([0, 1]));
    expect(nightShiftFontGeneratedSource).toMatchObject({
      width: 96,
      height: 48,
      glyphCount: 94,
      transparentIndex: 0,
      maximumSourceIndex: 1,
      cell: { width: 6, height: 8 },
      glyph: { width: 5, height: 7 },
    });
  });

  it("produces deterministic native PNG bytes with exact atlas dimensions", () => {
    const first = nightShiftFontPngBytes();
    const second = nightShiftFontPngBytes();
    expect(first).toEqual(second);
    expect([...first.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(pngDimensions(first)).toEqual({ width: 96, height: 48 });
  });

  it("places printable glyph pixels into stable cells without antialias indices", () => {
    const indices = nightShiftFontIndexBytes();
    const glyphPixelCount = (glyphIndex: number): number => {
      const cellX = (glyphIndex % 16) * 6;
      const cellY = Math.floor(glyphIndex / 16) * 8;
      let count = 0;
      for (let y = 0; y < 7; y += 1) {
        for (let x = 0; x < 5; x += 1) {
          if (indices[(cellY + y) * 96 + cellX + x] === 1) count += 1;
        }
      }
      return count;
    };

    expect(glyphPixelCount("!".codePointAt(0)! - 33)).toBeGreaterThan(0);
    expect(glyphPixelCount("A".codePointAt(0)! - 33)).toBeGreaterThan(10);
    expect(glyphPixelCount("a".codePointAt(0)! - 33)).toBeGreaterThan(10);
    expect(glyphPixelCount("~".codePointAt(0)! - 33)).toBeGreaterThan(0);
  });
});
