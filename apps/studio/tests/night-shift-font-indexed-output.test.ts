import { describe, expect, it } from "vitest";
import {
  nightShiftFontIndexedOutput,
  nightShiftFontIndexedPngBytes,
} from "../src/night-shift-font-indexed-output.js";

const uint32Be = (bytes: Uint8Array, offset: number): number =>
  (((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)) >>> 0;

const containsAscii = (bytes: Uint8Array, value: string): boolean => {
  const needle = new TextEncoder().encode(value);
  for (let start = 0; start <= bytes.length - needle.length; start += 1) {
    if (needle.every((byte, index) => bytes[start + index] === byte)) return true;
  }
  return false;
};

describe("Night Shift indexed bitmap-font output", () => {
  it("emits a deterministic 96x48 palette-indexed PNG", () => {
    const first = nightShiftFontIndexedPngBytes();
    const second = nightShiftFontIndexedPngBytes();
    expect(first).toEqual(second);
    expect([...first.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(uint32Be(first, 16)).toBe(96);
    expect(uint32Be(first, 20)).toBe(48);
    expect(first[24]).toBe(8);
    expect(first[25]).toBe(3);
    expect(containsAscii(first, "PLTE")).toBe(true);
    expect(containsAscii(first, "tRNS")).toBe(true);
  });

  it("describes exactly the same indexed source used by the runtime font contract", () => {
    expect(nightShiftFontIndexedOutput).toMatchObject({
      assetId: "asset.night-shift.font.system",
      pngPath: "art/night-shift/system-font.png",
      indexPath: "indexed/night-shift/system-font.idx",
      width: 96,
      height: 48,
      paletteEntries: 2,
      transparentIndex: 0,
      maximumSourceIndex: 1,
      pngColourType: 3,
    });
  });
});
