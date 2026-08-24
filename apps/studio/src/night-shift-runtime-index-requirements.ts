import type { Id } from "@evavo/adventure-project-schema";
import { nightShiftProductionAssets } from "./night-shift-production-assets.js";

export const nightShiftRuntimeIndexedAssetIds: readonly Id<"asset">[] = nightShiftProductionAssets
  .filter((asset) => asset.evidence.includes("indexed-runtime") && asset.role !== "palette")
  .map((asset) => asset.assetId);

export const nightShiftPaletteIndexedMasterAssetIds: readonly Id<"asset">[] = nightShiftProductionAssets
  .filter((asset) => asset.evidence.includes("period-vga"))
  .map((asset) => asset.assetId);

export const nightShiftAssetRequiresRuntimeIndexMap = (assetId: Id<"asset"> | string): boolean =>
  nightShiftRuntimeIndexedAssetIds.includes(assetId as Id<"asset">);
