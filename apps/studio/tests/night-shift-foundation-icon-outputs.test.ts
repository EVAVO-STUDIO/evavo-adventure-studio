import { describe, expect, it } from "vitest";
import { nightShiftGeneratedFoundationIcons } from "../src/night-shift-foundation-icon-outputs.js";

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
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

describe("Night Shift generated icon outputs", () => {
  it("emits deterministic PNG and exact 256-byte index payloads", () => {
    const first = nightShiftGeneratedFoundationIcons();
    const second = nightShiftGeneratedFoundationIcons();
    expect(first).toHaveLength(4);
    for (let index = 0; index < first.length; index += 1) {
      expect(first[index]?.pngBytes).toEqual(second[index]?.pngBytes);
      expect(first[index]?.indexBytes).toEqual(second[index]?.indexBytes);
      expect(first[index]?.indexBytes).toHaveLength(256);
      expect(first[index]?.maximumSourceIndex).toBeLessThanOrEqual(3);
    }
  });

  it("writes valid 16x16 palette-indexed PNG headers with transparency chunks", () => {
    for (const output of nightShiftGeneratedFoundationIcons()) {
      expect([...output.pngBytes.slice(0, 8)]).toEqual(pngSignature);
      expect(uint32Be(output.pngBytes, 16)).toBe(16);
      expect(uint32Be(output.pngBytes, 20)).toBe(16);
      expect(output.pngBytes[24]).toBe(8);
      expect(output.pngBytes[25]).toBe(3);
      expect(containsAscii(output.pngBytes, "PLTE")).toBe(true);
      expect(containsAscii(output.pngBytes, "tRNS")).toBe(true);
      expect(containsAscii(output.pngBytes, "IDAT")).toBe(true);
    }
  });

  it("uses a binary-transparent source index and only the reserved icon ramp", () => {
    for (const output of nightShiftGeneratedFoundationIcons()) {
      expect(output.transparentIndex).toBe(0);
      expect(output.maximumSourceIndex).toBeGreaterThanOrEqual(2);
      expect(output.maximumSourceIndex).toBeLessThanOrEqual(3);
    }
  });
});
