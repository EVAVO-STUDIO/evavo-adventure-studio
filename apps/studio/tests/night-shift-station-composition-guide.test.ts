import { describe, expect, it } from "vitest";
import {
  nightShiftStationCompositionGuide,
  nightShiftStationCompositionGuidePngBytes,
} from "../src/night-shift-station-composition-guide.js";

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
const uint32Be = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset] ?? 0) << 24) |
  ((bytes[offset + 1] ?? 0) << 16) |
  ((bytes[offset + 2] ?? 0) << 8) |
  (bytes[offset + 3] ?? 0);

describe("Night Shift Station composition guide", () => {
  it("emits a deterministic native 320x200 non-runtime PNG", () => {
    const first = nightShiftStationCompositionGuidePngBytes();
    const second = nightShiftStationCompositionGuidePngBytes();
    expect(first).toEqual(second);
    expect([...first.slice(0, 8)]).toEqual(pngSignature);
    expect(uint32Be(first, 16)).toBe(320);
    expect(uint32Be(first, 20)).toBe(200);
    expect(nightShiftStationCompositionGuide.runtimeAsset).toBe(false);
  });

  it("documents the canonical staging layers the guide visualises", () => {
    expect(nightShiftStationCompositionGuide.purpose).toMatch(/walk geometry/u);
    expect(Object.keys(nightShiftStationCompositionGuide.legend)).toEqual(
      expect.arrayContaining([
        "uiSafe",
        "navigation",
        "lane",
        "actor",
        "object",
        "approach",
        "occlusion",
        "light",
        "entrance",
      ]),
    );
  });
});
