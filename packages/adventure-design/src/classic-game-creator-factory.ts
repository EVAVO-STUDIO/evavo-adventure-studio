import type {
  AdventureProductionProfile,
  AdventureProductionProfileId,
} from "./production-profile-types.js";
import { adventureProductionProfiles } from "./production-profile-presets.js";
import type {
  AdventureProductionShowcase,
  AdventureProductionShowcaseId,
  AdventureShowcaseActorBeat,
  AdventureShowcasePlate,
  AdventureShowcasePropBeat,
} from "./production-showcase-types.js";
import { adventureProductionShowcases } from "./production-showcase-presets.js";
import type {
  ClassicAdventureCreatorActor,
  ClassicAdventureCreatorDialogue,
  ClassicAdventureCreatorFamily,
  ClassicAdventureCreatorInterface,
  ClassicAdventureCreatorLayer,
  ClassicAdventureCreatorProject,
  ClassicAdventureCreatorProp,
  ClassicAdventureCreatorPuzzle,
  ClassicAdventureCreatorScene,
  ClassicAdventureCreatorTiming,
} from "./classic-game-creator-types.js";

export interface ClassicAdventureCreatorRecipe {
  readonly id: string;
  readonly title: string;
  readonly family: ClassicAdventureCreatorFamily;
  readonly profileId: AdventureProductionProfileId;
  readonly showcaseId: AdventureProductionShowcaseId;
  readonly interface: ClassicAdventureCreatorInterface;
  readonly timing: ClassicAdventureCreatorTiming;
  readonly puzzles: readonly ClassicAdventureCreatorPuzzle[];
  readonly dialogues: readonly ClassicAdventureCreatorDialogue[];
  readonly productionPromise: string;
  readonly originalityStatement: string;
}

const productionProfile = (
  id: AdventureProductionProfileId,
): AdventureProductionProfile => {
  const profile = adventureProductionProfiles.find(
    (candidate) => candidate.id === id,
  );
  if (!profile) {
    throw new Error(`Adventure production profile '${id}' is missing.`);
  }
  return profile;
};

const productionShowcase = (
  id: AdventureProductionShowcaseId,
): AdventureProductionShowcase => {
  const showcase = adventureProductionShowcases.find(
    (candidate) => candidate.id === id,
  );
  if (!showcase) {
    throw new Error(`Adventure production showcase '${id}' is missing.`);
  }
  return showcase;
};

const shortName = (id: string): string =>
  (id.split(".").at(-1) ?? id)
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const actorFromBeat = (
  beat: AdventureShowcaseActorBeat,
  verticalScale: number,
): ClassicAdventureCreatorActor => ({
  id: beat.id,
  role: beat.role,
  name: shortName(beat.id),
  position: {
    x: beat.position.x,
    y: Math.round(beat.position.y * verticalScale),
  },
  height: Math.max(1, Math.round(beat.height * verticalScale)),
  facing: beat.facing,
  pose: beat.pose,
  animationState:
    beat.role === "player"
      ? "idle"
      : beat.role === "threat"
        ? "threaten"
        : "observe",
  silhouetteNote: beat.silhouetteNote,
});

const propVerbs = (
  beat: AdventureShowcasePropBeat,
): readonly string[] => {
  if (!beat.interactive) return [];
  switch (beat.role) {
    case "clue":
      return ["look", "take"];
    case "exit":
      return ["walk", "use"];
    case "puzzle":
      return ["look", "use"];
    case "ambience":
      return ["look"];
  }
};

const propFromBeat = (
  beat: AdventureShowcasePropBeat,
  verticalScale: number,
): ClassicAdventureCreatorProp => ({
  id: beat.id,
  role: beat.role,
  name: beat.label,
  position: {
    x: beat.position.x,
    y: Math.round(beat.position.y * verticalScale),
  },
  size: {
    width: beat.size.width,
    height: Math.max(1, Math.round(beat.size.height * verticalScale)),
  },
  state: beat.state,
  interactive: beat.interactive,
  verbs: propVerbs(beat),
  description:
    `${beat.label} begins in the '${beat.state}' state and must remain ` +
    "readable at one-times native scale.",
});

const layersForPlate = (
  plate: AdventureShowcasePlate,
): readonly ClassicAdventureCreatorLayer[] => [
  {
    id: `${plate.id}.layer.backdrop`,
    role: "backdrop",
    name: "Backdrop",
    depth: 0,
    locked: true,
    artBrief: "Paint the far silhouette and atmosphere as one quiet value group.",
  },
  {
    id: `${plate.id}.layer.architecture`,
    role: "rear-architecture",
    name: "Architecture",
    depth: 10,
    locked: false,
    artBrief: "Build location identity without competing with the active puzzle.",
  },
  {
    id: `${plate.id}.layer.interactive`,
    role: "interactive",
    name: "Interactive props",
    depth: 20,
    locked: false,
    artBrief: "Keep state changes obvious through shape, value and local contrast.",
  },
  {
    id: `${plate.id}.layer.actors`,
    role: "actors",
    name: "Actors",
    depth: 30,
    locked: false,
    artBrief: "Reserve clean silhouette pockets for every speaking or moving actor.",
  },
  {
    id: `${plate.id}.layer.foreground`,
    role: "foreground",
    name: "Foreground framing",
    depth: 40,
    locked: false,
    artBrief: "Frame the action without hiding walk routes or interaction targets.",
  },
  {
    id: `${plate.id}.layer.interface`,
    role: "interface",
    name: "Interface",
    depth: 50,
    locked: true,
    artBrief: "Preserve the selected production family's native interface geometry.",
  },
];

const lightingBrief = (
  family: ClassicAdventureCreatorFamily,
  plate: AdventureShowcasePlate,
): string => {
  switch (family) {
    case "storybook-icon":
      return (
        "Use broad painted value masses, one warm story light and crisp object " +
        `separation around ${plate.playerGoal.toLowerCase()}`
      );
    case "gothic-investigation":
      return (
        "Use cool ambient shadow, practical pools of warm light and one reserved " +
        "evidence accent. Faces and hands must remain readable."
      );
    case "verb-panel-comedy":
      return (
        "Use bright shape groups, clean local contrast and reaction-friendly " +
        "actor pockets above the persistent command panel."
      );
  }
};

const ambienceCue = (family: ClassicAdventureCreatorFamily): string => {
  switch (family) {
    case "storybook-icon":
      return "wind through orchard branches, distant bell metal and soft birds";
    case "gothic-investigation":
      return "rain against glass, paper movement, harbour horn and room tone";
    case "verb-panel-comedy":
      return "gulls, rigging, market chatter and deliberately timed object noises";
  }
};

const musicCue = (family: ClassicAdventureCreatorFamily): string => {
  switch (family) {
    case "storybook-icon":
      return "short melodic location theme with woodwind and bell colour";
    case "gothic-investigation":
      return "restrained motif with low strings, piano fragments and silence";
    case "verb-panel-comedy":
      return "light syncopated harbour theme with short comic punctuation";
  }
};

const sceneFromPlate = (
  plate: AdventureShowcasePlate,
  showcase: AdventureProductionShowcase,
  recipe: ClassicAdventureCreatorRecipe,
): ClassicAdventureCreatorScene => {
  const usesGameplayChrome =
    recipe.interface.openBehaviour === "persistent" &&
    (plate.kind === "gameplay" || plate.kind === "dialogue");
  const viewportHeight = usesGameplayChrome
    ? recipe.interface.gameplayViewportHeight
    : 200;
  const verticalScale = viewportHeight / 200;
  const horizonY = Math.round(plate.horizonY * verticalScale);
  const focalPoint = {
    x: plate.focalPoint.x,
    y: Math.round(plate.focalPoint.y * verticalScale),
  };
  const gameplay = plate.kind === "gameplay";
  const laneTop = gameplay
    ? Math.min(viewportHeight - 24, Math.max(horizonY + 12, 82))
    : Math.min(viewportHeight - 20, Math.max(horizonY, 64));
  const laneBottom = Math.max(laneTop + 16, viewportHeight - 4);
  return {
    id: `scene.creator.${showcase.id}.${plate.kind}`,
    sourcePlateId: plate.id,
    kind: plate.kind,
    motif: showcase.motif,
    name: plate.name,
    playerGoal: plate.playerGoal,
    artBrief:
      `${showcase.title}: ${plate.name}. ${showcase.titleTreatment} ` +
      plate.visualProofs.join(" "),
    lightingBrief: lightingBrief(recipe.family, plate),
    statusText: plate.statusText,
    horizonY,
    focalPoint,
    walkLane: {
      top: laneTop,
      bottom: laneBottom,
      note:
        gameplay
          ? "Keep a continuous actor route below the focal puzzle."
          : "Reserve a stable presentation lane for the selected scene mode.",
    },
    interfaceSafeRect: {
      x: 0,
      y: 0,
      width: 320,
      height: viewportHeight,
    },
    layers: layersForPlate(plate),
    actors: plate.actors.map((beat) =>
      actorFromBeat(beat, verticalScale),
    ),
    props: plate.props.map((beat) => propFromBeat(beat, verticalScale)),
    musicCue: musicCue(recipe.family),
    ambienceCue: ambienceCue(recipe.family),
    reviewProofs: plate.visualProofs,
  };
};

export const createClassicAdventureCreatorProject = (
  recipe: ClassicAdventureCreatorRecipe,
): ClassicAdventureCreatorProject => {
  const profile = productionProfile(recipe.profileId);
  const showcase = productionShowcase(recipe.showcaseId);
  if (showcase.profileId !== profile.id) {
    throw new Error(
      `Creator recipe '${recipe.id}' combines incompatible profile and showcase data.`,
    );
  }
  return {
    creatorVersion: 1,
    id: recipe.id,
    title: recipe.title,
    family: recipe.family,
    profileId: profile.id,
    showcaseId: showcase.id,
    nativeSize: profile.nativeSize,
    palette: {
      maxColours: profile.palette.maxColours,
      anchors: profile.palette.keyColours,
      actorValueRule: profile.actors.silhouette,
      interfaceReservation: profile.palette.reservedInterfaceColours,
    },
    interface: recipe.interface,
    timing: recipe.timing,
    scenes: showcase.plates.map((plate) =>
      sceneFromPlate(plate, showcase, recipe),
    ),
    puzzles: recipe.puzzles,
    dialogues: recipe.dialogues,
    productionPromise: recipe.productionPromise,
    originalityStatement: recipe.originalityStatement,
  };
};
