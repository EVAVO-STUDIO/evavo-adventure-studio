import {
  indexedAssetManifestSchema,
  type IndexedAssetManifest,
} from "@evavo/adventure-asset-contract/indexed-assets";
import type { Id } from "@evavo/adventure-project-schema";
import {
  nightShiftRuntimeIndexBuildPlan,
  nightShiftStationRuntimeIndexBuildPlan,
  type NightShiftRuntimeIndexAssetPlan,
} from "./night-shift-runtime-index-build-plan.js";
import { nightShiftRuntimeProject } from "./night-shift-runtime-contracts.js";

export interface NightShiftCompiledIndexEvidence {
  readonly assetId: Id<"asset">;
  readonly sha256: string;
  readonly byteLength: number;
  readonly maximumSourceIndex: number;
}

const evidenceMap = (
  evidence: readonly NightShiftCompiledIndexEvidence[],
): ReadonlyMap<string, NightShiftCompiledIndexEvidence> => {
  const result = new Map<string, NightShiftCompiledIndexEvidence>();
  for (const entry of evidence) {
    if (result.has(entry.assetId)) {
      throw new Error(`Duplicate compiled index evidence '${entry.assetId}'.`);
    }
    result.set(entry.assetId, entry);
  }
  return result;
};

const recordFromPlan = (
  plan: NightShiftRuntimeIndexAssetPlan,
  evidence: NightShiftCompiledIndexEvidence,
) => ({
  assetId: plan.assetId,
  width: plan.width,
  height: plan.height,
  indexRuntimePath: plan.runtimePath,
  indexSha256: evidence.sha256,
  indexByteLength: evidence.byteLength,
  maximumSourceIndex: evidence.maximumSourceIndex,
  ...(plan.transparentIndex === null ? {} : { transparentIndex: plan.transparentIndex }),
  defaultPalette: plan.defaultPalette,
  frames: plan.frames,
});

export const materializeNightShiftIndexedAssetManifest = (
  plan: readonly NightShiftRuntimeIndexAssetPlan[],
  evidence: readonly NightShiftCompiledIndexEvidence[],
): IndexedAssetManifest => {
  const byId = evidenceMap(evidence);
  const expected = new Set(plan.map((entry) => entry.assetId as string));
  for (const entry of evidence) {
    if (!expected.has(entry.assetId)) {
      throw new Error(`Compiled index evidence '${entry.assetId}' is not part of this Night Shift build plan.`);
    }
  }
  const assets = plan.map((entry) => {
    const measured = byId.get(entry.assetId);
    if (!measured) throw new Error(`Missing compiled index evidence for '${entry.assetId}'.`);
    return recordFromPlan(entry, measured);
  });
  return indexedAssetManifestSchema.parse({
    manifestVersion: 1,
    projectId: nightShiftRuntimeProject.id,
    assets,
  });
};

export const materializeNightShiftFullIndexedAssetManifest = (
  evidence: readonly NightShiftCompiledIndexEvidence[],
): IndexedAssetManifest => materializeNightShiftIndexedAssetManifest(nightShiftRuntimeIndexBuildPlan, evidence);

export const materializeNightShiftStationIndexedAssetManifest = (
  evidence: readonly NightShiftCompiledIndexEvidence[],
): IndexedAssetManifest =>
  materializeNightShiftIndexedAssetManifest(nightShiftStationRuntimeIndexBuildPlan, evidence);
