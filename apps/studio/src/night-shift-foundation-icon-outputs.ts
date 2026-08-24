import { encodeNativeIndexedPng } from "./native-png.js";
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

const uiIconPalette = [
  { r: 11, g: 16, b: 21, a: 0 },
  { r: 111, g: 125, b: 134, a: 255 },
  { r: 184, g: 179, b: 167, a: 255 },
  { r: 227, g: 223, b: 214, a: 255 },
] as const;

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
    pngBytes: encodeNativeIndexedPng(16, 16, indexBytes, uiIconPalette),
    indexBytes,
  };
};

export const nightShiftGeneratedFoundationIcons = (): readonly NightShiftGeneratedIconOutput[] =>
  nightShiftFoundationIcons.map(generateNightShiftFoundationIconOutput);
