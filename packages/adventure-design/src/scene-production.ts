import type { Size } from "@evavo/adventure-project-schema";
import type { AdventureDesignDocument, AdventureDesignId, AdventureMapLocation } from "./types.js";

export interface AdventureSceneProductionBrief {
  readonly locationId: AdventureDesignId<"location">;
  readonly name: string;
  readonly sceneId: AdventureMapLocation["sceneId"] | null;
  readonly nativeSize: Size;
  readonly paletteBudget: number;
  readonly productionMode: AdventureDesignDocument["creativeDirection"]["productionMode"];
  readonly compositionMode: AdventureDesignDocument["creativeDirection"]["compositionMode"];
  readonly visualPromise: string;
  readonly interactionLane: string;
  readonly focalHierarchy: readonly string[];
  readonly layerPlan: readonly string[];
  readonly actorReadability: string;
  readonly animationDirection: string;
  readonly interfaceDirection: string;
  readonly audioDirection: string;
  readonly reviewQuestions: readonly string[];
}

const interactionLaneFor = (document: AdventureDesignDocument, location: AdventureMapLocation): string =>
  location.kind === "close-up"
    ? "Reserve the centre and lower third for the object, hands and reaction poses."
    : document.creativeDirection.compositionMode === "stage"
      ? "Protect a broad lower-third walk lane with clean foot contact and silhouette."
      : document.creativeDirection.compositionMode === "storybook"
        ? "Use a readable path between actor, obstacle and exit."
        : "Lead the eye from entrance to obstacle, focal prop and exit without overlays.";

const layerPlanFor = (document: AdventureDesignDocument): readonly string[] => [
  "Background value mass and architecture",
  "Rear atmosphere and restrained palette motion",
  "Walkable world and consequential props",
  "Actor and contact effects",
  "Foreground occlusion and framing",
  `Native ${document.creativeDirection.interfaceTreatment}`,
];

export const createAdventureSceneProductionBriefs = (
  document: AdventureDesignDocument,
): readonly AdventureSceneProductionBrief[] =>
  document.map.locations.map((location) => ({
    locationId: location.id,
    name: location.name,
    sceneId: location.sceneId ?? null,
    nativeSize: { ...document.creativeDirection.nativeSize },
    paletteBudget: document.creativeDirection.palette.maxColours,
    productionMode: document.creativeDirection.productionMode,
    compositionMode: document.creativeDirection.compositionMode,
    visualPromise: location.artBrief,
    interactionLane: interactionLaneFor(document, location),
    focalHierarchy: [
      "Player or speaking actor silhouette",
      "Immediate obstacle or threat",
      "Consequential prop or clue",
      "Primary exit and travel direction",
      "Decorative story evidence",
    ],
    layerPlan: layerPlanFor(document),
    actorReadability: document.creativeDirection.actorSilhouette,
    animationDirection: document.creativeDirection.animationCadence,
    interfaceDirection: document.creativeDirection.interfaceTreatment,
    audioDirection: location.musicCue
      ? `${document.creativeDirection.ambienceDirection} Arrival cue: ${location.musicCue}.`
      : `${document.creativeDirection.ambienceDirection} Use music or silence deliberately.`,
    reviewQuestions: [
      "Does the room read at 1× native size without hotspot assistance?",
      "Do actor, obstacle, focal prop and exit occupy distinct value families?",
      "Can important interactions be understood from silhouette and feedback?",
      "Does foreground detail frame rather than obscure the action?",
      "Does revisiting reveal chapter or puzzle-state consequence?",
    ],
  }));
