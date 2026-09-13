import { validateNightShiftArtMaster } from "./night-shift-art-master-intake.js";
import { nightShiftGeneratedVisualMasterObservations } from "./night-shift-generated-art-intake.js";
import { nightShiftOfficerMasterContract, validateNightShiftOfficerMasterContract } from "./night-shift-officer-master-contract.js";
import { nightShiftRuntimeIndexedAssetIds } from "./night-shift-runtime-index-requirements.js";

const FOUNDATION_ASSET_IDS = [
  "asset.palette.night-shift.actor-lighting",
  "asset.night-shift.font.system",
  "asset.night-shift.ui.walk",
  "asset.night-shift.ui.look",
  "asset.night-shift.ui.use",
  "asset.night-shift.ui.talk",
  "asset.night-shift.actor.officer",
] as const;

export interface NightShiftFoundationPreflightReport {
  readonly reportVersion: 1;
  readonly foundationAssetIds: readonly string[];
  readonly generatedTechnicalAssetIds: readonly string[];
  readonly generatedVisualIntakeReady: boolean;
  readonly officerContractReady: boolean;
  readonly remainingAuthoredMasterIds: readonly string[];
  readonly foundationRuntimeIndexedAssetIds: readonly string[];
  readonly readyForOfficerArt: boolean;
}

export const evaluateNightShiftFoundationPreflight = (): NightShiftFoundationPreflightReport => {
  const generatedVisualObservations = nightShiftGeneratedVisualMasterObservations();
  const generatedVisualIntakeReady = generatedVisualObservations.every(
    (observation) => validateNightShiftArtMaster(observation).length === 0,
  );
  const officerContractReady = validateNightShiftOfficerMasterContract().length === 0;
  const generatedTechnicalAssetIds = [
    "asset.palette.night-shift.actor-lighting",
    ...generatedVisualObservations.map((observation) => observation.assetId as string),
  ];
  const remainingAuthoredMasterIds = FOUNDATION_ASSET_IDS.filter(
    (assetId) => !generatedTechnicalAssetIds.includes(assetId),
  );
  const foundationRuntimeIndexedAssetIds = nightShiftRuntimeIndexedAssetIds.filter((assetId) =>
    FOUNDATION_ASSET_IDS.includes(assetId as (typeof FOUNDATION_ASSET_IDS)[number]),
  );

  return {
    reportVersion: 1,
    foundationAssetIds: [...FOUNDATION_ASSET_IDS],
    generatedTechnicalAssetIds,
    generatedVisualIntakeReady,
    officerContractReady,
    remainingAuthoredMasterIds,
    foundationRuntimeIndexedAssetIds,
    readyForOfficerArt:
      generatedTechnicalAssetIds.length === 6 &&
      generatedVisualIntakeReady &&
      officerContractReady &&
      remainingAuthoredMasterIds.length === 1 &&
      remainingAuthoredMasterIds[0] === nightShiftOfficerMasterContract.assetId,
  };
};
