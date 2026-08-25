import { adventureProductionProfiles } from "./production-profile-presets.js";
import { ninthReliquaryGameplayProof } from "./ninth-reliquary-gameplay-proof.js";
import {
  createNinthReliquaryCreativeWorkOrders,
  type NinthReliquaryCreativeAuthorities,
} from "./ninth-reliquary-creative-production.js";
import { compileNinthReliquaryCreativeProofWorkOrders } from "./ninth-reliquary-creative-proof.js";

export interface NinthReliquaryAuthorityRequirement {
  readonly id:
    | "source-revision"
    | "visual-standard"
    | "style-bank"
    | "palette-authority"
    | "environment-layout"
    | "protagonist-model-sheet"
    | "protagonist-walk-x-sheet"
    | "environment-references"
    | "character-references";
  readonly owner: "adventure-studio" | "art-studio" | "cel-animation-studio";
  readonly requiredState: string;
  readonly purpose: string;
}

export interface NinthReliquaryProductionBlueprint {
  readonly blueprintVersion: 2;
  readonly projectKey: "ninth-reliquary";
  readonly productionProfileId: "cinematic-handdrawn-conspiracy";
  readonly authorityRequirements: readonly NinthReliquaryAuthorityRequirement[];
  readonly workOrderPlan: readonly {
    readonly workOrderId: string;
    readonly destinationStudio: "art-studio" | "cel-animation-studio";
    readonly taskKind: string;
    readonly assetId: string;
    readonly requiresTransparentAlpha: boolean;
    readonly requiresModelSheet: boolean;
    readonly requiresXSheet: boolean;
  }[];
}

const authorityRequirements: readonly NinthReliquaryAuthorityRequirement[] = [
  {
    id: "source-revision",
    owner: "adventure-studio",
    requiredState: "frozen authored project/gameplay/staging revision digest",
    purpose: "Prevents creative assets from silently targeting a different Adventure Studio revision.",
  },
  {
    id: "visual-standard",
    owner: "art-studio",
    requiredState: "approved visual standard/style authority digest",
    purpose: "Defines scene-wide line, colour, material, lighting and finish rules before production candidates are admitted.",
  },
  {
    id: "style-bank",
    owner: "art-studio",
    requiredState: "approved style/reference bank digest",
    purpose: "Keeps generated or repaired assets on one controlled visual language across locations and revisions.",
  },
  {
    id: "palette-authority",
    owner: "art-studio",
    requiredState: "approved palette/colour-role authority digest",
    purpose: "Separates actual colour-role authority from the broader style/reference bank and makes palette drift independently reviewable.",
  },
  {
    id: "environment-layout",
    owner: "adventure-studio",
    requiredState: "approved native scene/layout authority digest",
    purpose: "Locks exits, actor staging lanes, focal geometry and background/foreground alignment before final environment paint.",
  },
  {
    id: "protagonist-model-sheet",
    owner: "cel-animation-studio",
    requiredState: "approved protagonist model-sheet digest",
    purpose: "Locks identity, proportions, costume and construction before exposed animation drawings are produced.",
  },
  {
    id: "protagonist-walk-x-sheet",
    owner: "cel-animation-studio",
    requiredState: "approved walk-cycle X-sheet digest",
    purpose: "Locks drawing identity/order/exposures and prevents independent-frame animation generation.",
  },
  {
    id: "environment-references",
    owner: "art-studio",
    requiredState: "approved environmental reference evidence digests",
    purpose: "Grounds architecture/material/perspective decisions in a governed reference set without copying a protected room.",
  },
  {
    id: "character-references",
    owner: "cel-animation-studio",
    requiredState: "approved character construction/performance reference evidence digests",
    purpose: "Supports consistent hand/costume/pose language without copying a protected character or named artist.",
  },
] as const;

const workOrderPlan: NinthReliquaryProductionBlueprint["workOrderPlan"] = [
  {
    workOrderId: "creative.ninth-reliquary.old-city-square.background",
    destinationStudio: "art-studio",
    taskKind: "background",
    assetId: "asset.ninth-reliquary.old-city-square.background",
    requiresTransparentAlpha: false,
    requiresModelSheet: false,
    requiresXSheet: false,
  },
  {
    workOrderId: "creative.ninth-reliquary.old-city-square.foreground-awning",
    destinationStudio: "art-studio",
    taskKind: "foreground-plate",
    assetId: "asset.ninth-reliquary.old-city-square.foreground-awning",
    requiresTransparentAlpha: true,
    requiresModelSheet: false,
    requiresXSheet: false,
  },
  {
    workOrderId: "creative.ninth-reliquary.protagonist.model-sheet",
    destinationStudio: "cel-animation-studio",
    taskKind: "character-model-sheet",
    assetId: "asset.ninth-reliquary.protagonist.model-sheet",
    requiresTransparentAlpha: false,
    requiresModelSheet: false,
    requiresXSheet: false,
  },
  {
    workOrderId: "creative.ninth-reliquary.protagonist.walk-east",
    destinationStudio: "cel-animation-studio",
    taskKind: "animation-sequence",
    assetId: "asset.ninth-reliquary.protagonist.walk-east",
    requiresTransparentAlpha: true,
    requiresModelSheet: true,
    requiresXSheet: true,
  },
] as const;

export const ninthReliquaryProductionBlueprint = (): NinthReliquaryProductionBlueprint => ({
  blueprintVersion: 2,
  projectKey: "ninth-reliquary",
  productionProfileId: "cinematic-handdrawn-conspiracy",
  authorityRequirements,
  workOrderPlan,
});

export const ninthReliquaryProductionProfile = () => {
  const profile = adventureProductionProfiles.find(
    (candidate) => candidate.id === "cinematic-handdrawn-conspiracy",
  );
  if (!profile) throw new Error("Cinematic hand-drawn conspiracy production profile is unavailable.");
  return profile;
};

export interface NinthReliquaryFinalizedProductionPackage {
  readonly packageVersion: 1;
  readonly blueprint: NinthReliquaryProductionBlueprint;
  readonly profile: ReturnType<typeof ninthReliquaryProductionProfile>;
  readonly gameplayProof: typeof ninthReliquaryGameplayProof;
  readonly artStudioWorkOrders: ReturnType<typeof createNinthReliquaryCreativeWorkOrders>;
  readonly celAnimationStudioWorkOrders: ReturnType<typeof createNinthReliquaryCreativeWorkOrders>;
}

export const createNinthReliquaryFinalizedProductionPackage = (
  authorities: NinthReliquaryCreativeAuthorities,
): NinthReliquaryFinalizedProductionPackage => {
  const orders = createNinthReliquaryCreativeWorkOrders(authorities);
  return {
    packageVersion: 1,
    blueprint: ninthReliquaryProductionBlueprint(),
    profile: ninthReliquaryProductionProfile(),
    gameplayProof: ninthReliquaryGameplayProof,
    artStudioWorkOrders: orders.filter((order) => order.destinationStudio === "art-studio"),
    celAnimationStudioWorkOrders: orders.filter(
      (order) => order.destinationStudio === "cel-animation-studio",
    ),
  };
};

export interface NinthReliquaryCreativeAuthoritiesV2 extends NinthReliquaryCreativeAuthorities {
  readonly paletteDigest: string;
  readonly environmentLayoutDigest: string;
}

export interface NinthReliquaryFinalizedProductionPackageV2 {
  readonly packageVersion: 2;
  readonly blueprint: NinthReliquaryProductionBlueprint;
  readonly profile: ReturnType<typeof ninthReliquaryProductionProfile>;
  readonly gameplayProof: typeof ninthReliquaryGameplayProof;
  readonly legacy: NinthReliquaryFinalizedProductionPackage;
  readonly artStudioWorkOrdersV2: readonly ReturnType<typeof compileNinthReliquaryCreativeProofWorkOrders>[keyof ReturnType<typeof compileNinthReliquaryCreativeProofWorkOrders>][];
  readonly celAnimationStudioWorkOrdersV2: readonly ReturnType<typeof compileNinthReliquaryCreativeProofWorkOrders>[keyof ReturnType<typeof compileNinthReliquaryCreativeProofWorkOrders>][];
}

export const createNinthReliquaryFinalizedProductionPackageV2 = (
  authorities: NinthReliquaryCreativeAuthoritiesV2,
  revision = 1,
): NinthReliquaryFinalizedProductionPackageV2 => {
  const legacy = createNinthReliquaryFinalizedProductionPackage(authorities);
  const v2 = compileNinthReliquaryCreativeProofWorkOrders(
    {
      projectId: authorities.projectId,
      sourceRevisionDigest: authorities.sourceRevisionDigest,
      styleDigest: authorities.visualStandardDigest,
      paletteDigest: authorities.paletteDigest,
      environmentLayoutDigest: authorities.environmentLayoutDigest,
      modelSheetDigest: authorities.protagonistModelSheetDigest,
      xSheetDigest: authorities.protagonistWalkXSheetDigest,
      environmentReferenceDigests: authorities.environmentalReferenceDigests,
      characterReferenceDigests: authorities.characterReferenceDigests,
    },
    revision,
  );
  const orders = [v2.background, v2.foregroundAwning, v2.maraModelSheet, v2.maraWalkEast];
  return {
    packageVersion: 2,
    blueprint: ninthReliquaryProductionBlueprint(),
    profile: ninthReliquaryProductionProfile(),
    gameplayProof: ninthReliquaryGameplayProof,
    legacy,
    artStudioWorkOrdersV2: orders.filter((order) => order.destinationStudio === "art-studio"),
    celAnimationStudioWorkOrdersV2: orders.filter((order) => order.destinationStudio === "cel-animation-studio"),
  };
};
