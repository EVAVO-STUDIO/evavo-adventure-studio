import { nightShiftFontIndexBytes } from "./night-shift-font-generated.js";
import { encodeNativeIndexedPng } from "./native-png.js";

const nightShiftFontPalette = [
  { r: 0, g: 0, b: 0, a: 0 },
  { r: 227, g: 223, b: 214, a: 255 },
] as const;

export const nightShiftFontIndexedPngBytes = (): Uint8Array =>
  encodeNativeIndexedPng(96, 48, nightShiftFontIndexBytes(), nightShiftFontPalette);

export const nightShiftFontIndexedOutput = {
  assetId: "asset.night-shift.font.system",
  pngPath: "art/night-shift/system-font.png",
  indexPath: "indexed/night-shift/system-font.idx",
  width: 96,
  height: 48,
  paletteEntries: 2,
  transparentIndex: 0,
  maximumSourceIndex: 1,
  pngColourType: 3,
} as const;
