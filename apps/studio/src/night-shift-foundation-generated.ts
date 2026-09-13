import { nightShiftActorLightingPalette } from "./scene-director-palette-specs.js";

const rgbaFromHex = (hex: string): readonly [number, number, number, number] => {
  if (!/^#[0-9a-f]{6}$/iu.test(hex)) {
    throw new TypeError(`Night Shift palette colour '${hex}' is not six-digit RGB hex.`);
  }
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
    255,
  ];
};

export const nightShiftActorLightingPaletteBytes = (): Uint8Array => {
  const bytes = new Uint8Array(nightShiftActorLightingPalette.entryCount * 4);
  for (let entry = 0; entry < nightShiftActorLightingPalette.entryCount; entry += 1) {
    const offset = entry * 4;
    bytes[offset] = 0;
    bytes[offset + 1] = 0;
    bytes[offset + 2] = 0;
    bytes[offset + 3] = 255;
  }

  for (const bank of nightShiftActorLightingPalette.banks) {
    bank.colours.forEach((colour, index) => {
      const rgba = rgbaFromHex(colour);
      const offset = (bank.offset + index) * 4;
      bytes[offset] = rgba[0];
      bytes[offset + 1] = rgba[1];
      bytes[offset + 2] = rgba[2];
      bytes[offset + 3] = rgba[3];
    });
  }
  return bytes;
};

export const nightShiftFoundationGeneratedOutputs = {
  palette: {
    assetId: "asset.palette.night-shift.actor-lighting",
    sourcePath: "palettes/night-shift-actor-lighting.pal",
    runtimePath: "palettes/night-shift-actor-lighting.rgba",
    entryCount: nightShiftActorLightingPalette.entryCount,
    byteLength: nightShiftActorLightingPalette.entryCount * 4,
    authoredBanks: nightShiftActorLightingPalette.banks.map((bank) => ({
      label: bank.label,
      offset: bank.offset,
      entries: bank.colours.length,
    })),
  },
} as const;
