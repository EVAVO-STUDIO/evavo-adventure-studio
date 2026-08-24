import { encodeNativeRgbaPng } from "./native-png.js";
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

const indexedIconRgba = (master: NightShiftFoundationIconMaster): Uint8Array => {
  const palette = nightShiftActorLightingPaletteBytes();
  const rgba = new Uint8Array(master.indices.length * 4);
  master.indices.forEach((index, pixel) => {
    const source = (master.paletteOffset + index) * 4;
    const target = pixel * 4;
    rgba[target] = palette[source] ?? 0;
    rgba[target + 1] = palette[source + 1] ?? 0;
    rgba[target + 2] = palette[source + 2] ?? 0;
    rgba[target + 3] = index === master.transparentIndex ? 0 : (palette[source + 3] ?? 255);
  });
  return rgba;
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
    pngBytes: encodeNativeRgbaPng(16, 16, indexedIconRgba(master)),
    indexBytes,
  };
};

export const nightShiftGeneratedFoundationIcons = (): readonly NightShiftGeneratedIconOutput[] =>
  nightShiftFoundationIcons.map(generateNightShiftFoundationIconOutput);
