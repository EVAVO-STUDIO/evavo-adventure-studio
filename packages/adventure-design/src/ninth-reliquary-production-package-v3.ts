import { compileAdventureStudioProductionRequestV3 } from "./creative-production-bridge-v3.js";
import type { AdventureCreativeWorkOrderV3 } from "./creative-production-handoff-v3.js";
import {
  compileNinthReliquaryCreativeProofV3,
  type NinthReliquaryCreativeAuthoritiesV3,
} from "./ninth-reliquary-creative-proof-v3.js";
import { ninthReliquaryGameplayProof } from "./ninth-reliquary-gameplay-proof.js";
import {
  ninthReliquaryProductionBlueprint,
  ninthReliquaryProductionProfile,
  type NinthReliquaryAuthorityRequirement,
} from "./ninth-reliquary-production-package.js";

export interface NinthReliquaryProductionAuthoritiesV3 {
  readonly projectId?: string;
  readonly sourceRevisionDigest: string;
  readonly visualStandardDigest: string;
  readonly styleBankDigest: string;
  readonly paletteDigest: string;
  readonly environmentLayoutDigest: string;
  readonly protagonistModelSheetDigest: string;
  readonly protagonistWalkXSheetDigest: string;
  readonly environmentalReferenceDigests: readonly string[];
  readonly characterReferenceDigests: readonly string[];
}

export interface NinthReliquaryProductionEvidenceRequirementV3 {
  readonly workOrderId: string;
  readonly assetId: string;
  readonly destinationStudio: "art-studio" | "cel-animation-studio";
  readonly alphaEvidenceRequired: boolean;
  readonly hostilePlateReviewRequired: boolean;
  readonly sequenceEvidenceRequired: boolean;
  readonly modelSheetAuthorityRequired: boolean;
  readonly xSheetAuthorityRequired: boolean;
  readonly exactNativeSize: { readonly width: number; readonly height: number };
  readonly deliveryReceiptRequired: true;
}

export interface NinthReliquaryProductionBlueprintV3 {
  readonly blueprintVersion: 3;
  readonly projectKey: "ninth-reliquary";
  readonly productionProfileId: "cinematic-handdrawn-conspiracy";
  readonly authorityRequirements: readonly NinthReliquaryAuthorityRequirement[];
  readonly workOrderPlan: readonly {
    readonly key:
      | "squareLayout"
      | "squareBackground"
      | "squareForeground"
      | "maraModelSheet"
      | "maraWalkEast"
      | "maraInspect"
      | "chapelCutaway";
    readonly destinationStudio: "art-studio" | "cel-animation-studio";
    readonly taskKind: string;
    readonly assetId: string;
  }[];
}

const v3Plan: NinthReliquaryProductionBlueprintV3["workOrderPlan"] = [
  {
    key: "squareLayout",
    destinationStudio: "art-studio",
    taskKind: "background-layout",
    assetId: "asset.ninth-reliquary.square.layout",
  },
  {
    key: "squareBackground",
    destinationStudio: "art-studio",
    taskKind: "background-paint",
    assetId: "asset.ninth-reliquary.square.background",
  },
  {
    key: "squareForeground",
    destinationStudio: "art-studio",
    taskKind: "foreground-plate",
    assetId: "asset.ninth-reliquary.square.foreground-awning",
  },
  {
    key: "maraModelSheet",
    destinationStudio: "cel-animation-studio",
    taskKind: "character-model-sheet",
    assetId: "asset.ninth-reliquary.mara.model-sheet",
  },
  {
    key: "maraWalkEast",
    destinationStudio: "cel-animation-studio",
    taskKind: "animation-sequence",
    assetId: "asset.ninth-reliquary.mara.walk-east",
  },
  {
    key: "maraInspect",
    destinationStudio: "cel-animation-studio",
    taskKind: "animation-sequence",
    assetId: "asset.ninth-reliquary.mara.inspect",
  },
  {
    key: "chapelCutaway",
    destinationStudio: "cel-animation-studio",
    taskKind: "cutscene-shot",
    assetId: "asset.ninth-reliquary.chapel-cutaway",
  },
] as const;

export const ninthReliquaryProductionBlueprintV3 = (): NinthReliquaryProductionBlueprintV3 => ({
  blueprintVersion: 3,
  projectKey: "ninth-reliquary",
  productionProfileId: "cinematic-handdrawn-conspiracy",
  authorityRequirements: ninthReliquaryProductionBlueprint().authorityRequirements,
  workOrderPlan: v3Plan,
});

const creativeAuthorities = (
  authorities: NinthReliquaryProductionAuthoritiesV3,
): NinthReliquaryCreativeAuthoritiesV3 => ({
  ...(authorities.projectId ? { projectId: authorities.projectId } : {}),
  sourceRevisionDigest: authorities.sourceRevisionDigest,
  styleDigest: authorities.styleBankDigest,
  paletteDigest: authorities.paletteDigest,
  environmentLayoutDigest: authorities.environmentLayoutDigest,
  modelSheetDigest: authorities.protagonistModelSheetDigest,
  xSheetDigest: authorities.protagonistWalkXSheetDigest,
  referenceDigests: [
    authorities.visualStandardDigest,
    ...authorities.environmentalReferenceDigests,
    ...authorities.characterReferenceDigests,
  ],
});

const isSequence = (order: AdventureCreativeWorkOrderV3): boolean =>
  order.taskKind === "animation-sequence" ||
  order.taskKind === "cutscene-shot" ||
  order.taskKind === "effects-sequence";

const evidenceRequirement = (
  order: AdventureCreativeWorkOrderV3,
): NinthReliquaryProductionEvidenceRequirementV3 => ({
  workOrderId: order.workOrderId,
  assetId: order.assetId,
  destinationStudio: order.destinationStudio,
  alphaEvidenceRequired: order.alphaPolicy !== "opaque",
  hostilePlateReviewRequired: order.transparencyPolicy.hostilePlateReviewRequired,
  sequenceEvidenceRequired: isSequence(order),
  modelSheetAuthorityRequired: Boolean(order.authorities.modelSheetDigest),
  xSheetAuthorityRequired: Boolean(order.authorities.xSheetDigest),
  exactNativeSize: order.nativeSize,
  deliveryReceiptRequired: true,
});

export interface NinthReliquaryFinalizedProductionPackageV3 {
  readonly packageVersion: 3;
  readonly blueprint: NinthReliquaryProductionBlueprintV3;
  readonly profile: ReturnType<typeof ninthReliquaryProductionProfile>;
  readonly gameplayProof: typeof ninthReliquaryGameplayProof;
  readonly workOrders: readonly AdventureCreativeWorkOrderV3[];
  readonly artStudioRequests: readonly ReturnType<typeof compileAdventureStudioProductionRequestV3>[];
  readonly celAnimationStudioRequests: readonly ReturnType<typeof compileAdventureStudioProductionRequestV3>[];
  readonly evidenceRequirements: readonly NinthReliquaryProductionEvidenceRequirementV3[];
}

export const createNinthReliquaryFinalizedProductionPackageV3 = (
  authorities: NinthReliquaryProductionAuthoritiesV3,
  revision = 1,
): NinthReliquaryFinalizedProductionPackageV3 => {
  const proof = compileNinthReliquaryCreativeProofV3(creativeAuthorities(authorities), revision);
  const workOrders = v3Plan.map((entry) => proof[entry.key]);
  const requests = workOrders.map(compileAdventureStudioProductionRequestV3);
  return {
    packageVersion: 3,
    blueprint: ninthReliquaryProductionBlueprintV3(),
    profile: ninthReliquaryProductionProfile(),
    gameplayProof: ninthReliquaryGameplayProof,
    workOrders,
    artStudioRequests: requests.filter((entry) => entry.destination === "art-studio"),
    celAnimationStudioRequests: requests.filter((entry) => entry.destination === "cel-animation-studio"),
    evidenceRequirements: workOrders.map(evidenceRequirement),
  };
};
