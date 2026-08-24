import { encodeNativeIndexedPng } from "./native-png.js";
import { nightShiftActorLightingPaletteBytes } from "./night-shift-foundation-generated.js";
import {
  nightShiftFoundationIcons,
  type NightShiftFoundationIconMaster,
} from "./night-shift-foundation-icons.js";

export interface NightShiftGeneratedIconOutput {
  readonly assetId: string;
  readonly pngPath: string;
  readonly indexPath: string;
  readonly width: 16;
  readonly height: 16;
  readonly transparentIndex: 0;
  readonly maximumSourceIndex: number;
  readonly pngBytes: Uint8Array;
  readonly indexBytes: Uint8Array;
}

const iconPalette = (master: NightShiftFoundationIconMaster) => {
  const palette = nightShiftActorLightingPaletteBytes();
  return Array.from({ length: 4 }, (_, index) => {
    const source = (master.paletteOffset + index) * 4;
    return {
      r: palette[source] ?? 0,
      g: palette[source + 1] ?? 0,
      b: palette[source + 2] ?? 0,
      a: index === master.transparentIndex ? 0 : (palette[source + 3] ?? 255),
    };
  });
};

export const generateNightShiftFoundationIconOutput = (
  master: NightShiftFoundationIconMaster,
): NightShiftGeneratedIconOutput => {
  let maximumSourceIndex = 0;
  for (const index of master.indices) maximumSourceIndex = Math.max(maximumSourceIndex, index);
  const indexBytes = new Uint8Array(master.indices);
  return {
    assetId: master.assetId,
    pngPath: `art/night-shift/ui-${master.id}.png`,
    indexPath: `indexed/night-shift/ui-${master.id}.idx`,
    width: 16,
    height: 16,
    transparentIndex: 0,
    maximumSourceIndex,
    pngBytes: encodeNativeIndexedPng(16, 16, indexBytes, iconPalette(master)),
    indexBytes,
  };
};

export const nightShiftGeneratedFoundationIcons = (): readonly NightShiftGeneratedIconOutput[] =>
  nightShiftFoundationIcons.map(generateNightShiftFoundationIconOutput);
