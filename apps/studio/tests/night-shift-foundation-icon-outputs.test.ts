import { describe, expect, it } from "vitest";
import { nightShiftGeneratedFoundationIcons } from "../src/night-shift-foundation-icon-outputs.js";

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
const uint32Be = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset] ?? 0) << 24) |
  ((bytes[offset + 1] ?? 0) << 16) |
  ((bytes[offset + 2] ?? 0) << 8) |
  (bytes[offset + 3] ?? 0);

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

  it("writes valid 16x16 RGBA PNG headers", () => {
    for (const output of nightShiftGeneratedFoundationIcons()) {
      expect([...output.pngBytes.slice(0, 8)]).toEqual(pngSignature);
      expect(uint32Be(output.pngBytes, 16)).toBe(16);
      expect(uint32Be(output.pngBytes, 20)).toBe(16);
      expect(output.pngBytes[24]).toBe(8);
      expect(output.pngBytes[25]).toBe(6);
    }
  });

  it("uses binary alpha in the visible PNG source", () => {
    for (const output of nightShiftGeneratedFoundationIcons()) {
      expect(output.transparentIndex).toBe(0);
      expect(output.maximumSourceIndex).toBeGreaterThanOrEqual(2);
    }
  });
});
