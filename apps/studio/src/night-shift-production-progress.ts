import type { Id } from "@evavo/adventure-project-schema";
import {
  nightShiftProductionWaves,
  type NightShiftProductionWave,
  type NightShiftProductionWaveId,
} from "./night-shift-production-waves.js";

export interface NightShiftProductionWaveProgress {
  readonly id: NightShiftProductionWaveId;
  readonly label: string;
  readonly ready: boolean;
  readonly completedAssets: number;
  readonly totalAssets: number;
  readonly missingAssetIds: readonly Id<"asset">[];
  readonly blockedBy: readonly NightShiftProductionWaveId[];
}

export interface NightShiftProductionProgress {
  readonly waves: readonly NightShiftProductionWaveProgress[];
  readonly completedAssets: number;
  readonly totalAssets: number;
  readonly nextWave: NightShiftProductionWave | null;
  readonly complete: boolean;
}

export const evaluateNightShiftProductionProgress = (
  completedAssetIds: ReadonlySet<string>,
): NightShiftProductionProgress => {
  const readyWaveIds = new Set<NightShiftProductionWaveId>();
  const waves: NightShiftProductionWaveProgress[] = [];

  for (const wave of nightShiftProductionWaves) {
    const missingAssetIds = wave.assetIds.filter((assetId) => !completedAssetIds.has(assetId));
    const blockedBy = wave.dependsOn.filter((dependency) => !readyWaveIds.has(dependency));
    const ready = missingAssetIds.length === 0 && blockedBy.length === 0;
    if (ready) readyWaveIds.add(wave.id);
    waves.push({
      id: wave.id,
      label: wave.label,
      ready,
      completedAssets: wave.assetIds.length - missingAssetIds.length,
      totalAssets: wave.assetIds.length,
      missingAssetIds,
      blockedBy,
    });
  }

  const allAssetIds = nightShiftProductionWaves.flatMap((wave) => wave.assetIds);
  const completedAssets = allAssetIds.filter((assetId) => completedAssetIds.has(assetId)).length;
  const nextWave = nightShiftProductionWaves.find((wave) => !readyWaveIds.has(wave.id)) ?? null;
  return {
    waves,
    completedAssets,
    totalAssets: allAssetIds.length,
    nextWave,
    complete: nextWave === null,
  };
};
