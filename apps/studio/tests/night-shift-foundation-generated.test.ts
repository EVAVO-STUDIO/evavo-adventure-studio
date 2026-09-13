import { describe, expect, it } from "vitest";
import {
  nightShiftActorLightingPaletteBytes,
  nightShiftFoundationGeneratedOutputs,
} from "../src/night-shift-foundation-generated.js";
import {
  nightShiftFoundationIconById,
  nightShiftFoundationIcons,
  validateNightShiftFoundationIcons,
} from "../src/night-shift-foundation-icons.js";
import { nightShiftActorLightingPalette } from "../src/scene-director-palette-specs.js";

const rgbaAt = (bytes: Uint8Array, index: number): readonly number[] =>
  [...bytes.slice(index * 4, index * 4 + 4)];

const hexRgba = (hex: string): readonly number[] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
  255,
];

describe("Night Shift generated Foundation sources", () => {
  it("materialises the 128-entry actor-lighting palette exactly at authored bank offsets", () => {
    const bytes = nightShiftActorLightingPaletteBytes();
    expect(bytes.byteLength).toBe(128 * 4);
    expect(nightShiftFoundationGeneratedOutputs.palette.byteLength).toBe(512);

    for (const bank of nightShiftActorLightingPalette.banks) {
      expect(rgbaAt(bytes, bank.offset)).toEqual(hexRgba(bank.colours[0]!));
      expect(rgbaAt(bytes, bank.offset + 15)).toEqual(hexRgba(bank.colours[15]!));
    }
    expect(rgbaAt(bytes, 16)).toEqual([0, 0, 0, 255]);
  });

  it("ships four hand-authored 16x16 indexed icon recipes", () => {
    expect(validateNightShiftFoundationIcons()).toEqual([]);
    expect(nightShiftFoundationIcons.map((icon) => icon.id)).toEqual([
      "walk",
      "look",
      "use",
      "talk",
    ]);
    for (const icon of nightShiftFoundationIcons) {
      expect(icon.indices).toHaveLength(256);
      expect(icon.transparentIndex).toBe(0);
      expect(Math.max(...icon.indices)).toBeLessThanOrEqual(3);
    }
  });

  it("keeps the LOOK icon eye-shaped with a visible central pupil", () => {
    const icon = nightShiftFoundationIconById("look");
    const centre = icon.indices[7 * 16 + 7];
    expect(centre).toBe(1);
    expect(icon.indices[2 * 16 + 7]).toBe(2);
  });
});
