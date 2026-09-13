import type { NightShiftArtMasterObservation } from "./night-shift-art-master-intake.js";
import { nightShiftFontIndexedOutput } from "./night-shift-font-indexed-output.js";
import { nightShiftGeneratedFoundationIcons } from "./night-shift-foundation-icon-outputs.js";

export const nightShiftGeneratedVisualMasterObservations = (): readonly NightShiftArtMasterObservation[] => [
  {
    assetId: nightShiftFontIndexedOutput.assetId as never,
    width: nightShiftFontIndexedOutput.width,
    height: nightShiftFontIndexedOutput.height,
    paletteIndexed: true,
    colourCount: nightShiftFontIndexedOutput.paletteEntries,
    alphaMode: "binary",
    sourceFormat: "png",
  },
  ...nightShiftGeneratedFoundationIcons().map((icon) => ({
    assetId: icon.assetId as never,
    width: icon.width,
    height: icon.height,
    paletteIndexed: true as const,
    colourCount: icon.maximumSourceIndex + 1,
    alphaMode: "binary" as const,
    sourceFormat: "png" as const,
  })),
];

export const nightShiftGeneratedVisualMasterAssetIds = nightShiftGeneratedVisualMasterObservations().map(
  (observation) => observation.assetId,
);
