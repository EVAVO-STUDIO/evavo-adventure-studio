import type {
  AdventureProductionProfile,
  AdventureProductionProfileSeed,
} from "./production-profile-types.js";
import type { AdventureDesignId, AdventureReviewItem } from "./types.js";

export const createAdventureProductionProfileSeed = (
  profile: AdventureProductionProfile,
): AdventureProductionProfileSeed => ({
  profileId: profile.id,
  presentation: {
    nativeWidth: profile.nativeSize.width,
    nativeHeight: profile.nativeSize.height,
    interactionMode: profile.interface.primaryInteractionMode,
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: profile.pixelMotionPolicy,
    showScore: profile.interface.showScore,
    allowHotspotAssist: false,
  },
  creativeDirection: {
    nativeSize: { ...profile.nativeSize },
    productionMode: profile.productionModes[0]!,
    compositionMode: profile.compositionModes[0]!,
    palette: {
      maxColours: profile.palette.maxColours,
      keyColours: [...profile.palette.keyColours],
      shadowRule: profile.palette.shadowRule,
      highlightRule: profile.palette.highlightRule,
      ditherRule: profile.palette.ditherRule,
    },
    perspective: profile.scene.cameraDoctrine,
    lighting: `${profile.palette.shadowRule} ${profile.palette.highlightRule}`,
    materialLanguage: profile.scene.foregroundDoctrine,
    actorSilhouette: profile.actors.silhouette,
    backgroundHierarchy: profile.scene.focalHierarchy,
    portraitTreatment: profile.actors.portraitTreatment,
    animationCadence: profile.animation.cadence,
    interfaceTreatment:
      `${profile.interface.family}; ${profile.interface.inventoryPresentation} ` +
      `${profile.interface.statusPresentation}`,
    musicDirection: profile.audio.music,
    ambienceDirection: profile.audio.ambience,
    authenticityRules: [...profile.authenticityRules],
    prohibitedShortcuts: [...profile.prohibitedShortcuts],
  },
  reviewChecklist: profile.reviewQuestions.map(
    (label, index): AdventureReviewItem => ({
      id: `review.production-profile.${profile.id}.${index + 1}` as AdventureDesignId<"review-item">,
      label,
      required: true,
    }),
  ),
  splash: profile.splash,
  showcase: profile.showcase,
});
