import type { AdventureProject, Id, PresentationProfile } from "@evavo/adventure-project-schema";
import { parseAdventureDesignDocument } from "./parse.js";
import type {
  AdventureCompositionMode,
  AdventureDesignDocument,
  AdventureFailureMode,
  AdventureLocationKind,
  AdventureProductionMode,
} from "./types.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

interface ShowcaseSpec {
  readonly slug: string;
  readonly title: string;
  readonly pitch: string;
  readonly playerPromise: string;
  readonly productionMode: AdventureProductionMode;
  readonly compositionMode: AdventureCompositionMode;
  readonly interactionMode: PresentationProfile["interactionMode"];
  readonly keyColours: readonly string[];
  readonly perspective: string;
  readonly lighting: string;
  readonly materials: string;
  readonly silhouette: string;
  readonly backgroundHierarchy: string;
  readonly portraitTreatment: string;
  readonly animationCadence: string;
  readonly interfaceTreatment: string;
  readonly musicDirection: string;
  readonly ambienceDirection: string;
  readonly firstLocation: string;
  readonly secondLocation: string;
  readonly secondLocationKind: AdventureLocationKind;
  readonly travelMode: string;
  readonly puzzleName: string;
  readonly puzzleGoal: string;
  readonly puzzlePayoff: string;
  readonly clueName: string;
  readonly clueText: string;
  readonly toolName: string;
  readonly cutsceneName: string;
  readonly failureMode: AdventureFailureMode;
}

const projectFor = (spec: ShowcaseSpec): AdventureProject => {
  const projectId = id<"project">(`project.showcase.${spec.slug}`);
  const sceneId = id<"scene">(`scene.${spec.slug}.primary`);
  const entranceId = id<"entrance">(`entrance.${spec.slug}.primary`);
  const backgroundId = id<"asset">(`asset.${spec.slug}.background`);
  const itemId = id<"item">(`item.${spec.slug}.tool`);
  return {
    schemaVersion: 1,
    id: projectId,
    title: spec.title,
    presentation: {
      nativeWidth: 320,
      nativeHeight: 200,
      interactionMode: spec.interactionMode,
      integerScale: true,
      textureSampling: "nearest",
      logicalTicksPerSecond: 60,
      pixelMotionPolicy: "strict",
      showScore: true,
      allowHotspotAssist: false,
    },
    startSceneId: sceneId,
    startEntranceId: entranceId,
    scenes: [
      {
        id: sceneId,
        name: spec.firstLocation,
        width: 320,
        height: 200,
        backgroundAssetId: backgroundId,
        navigationAreas: [
          {
            id: id<"navigation-area">(`navigation.${spec.slug}.main`),
            shape: {
              points: [
                { x: 12, y: 112 },
                { x: 308, y: 112 },
                { x: 308, y: 194 },
                { x: 12, y: 194 },
              ],
            },
            elevation: 0,
          },
        ],
        depthBands: [
          {
            id: id<"depth-band">(`depth.${spec.slug}.main`),
            farY: 112,
            nearY: 194,
            farScale: 0.68,
            nearScale: 1.04,
          },
        ],
        occluders: [],
        hotspots: [],
        entrances: [
          {
            id: entranceId,
            position: { x: 42, y: 172 },
            facing: "east",
          },
        ],
        fallbackText: "Nothing else answers the question yet.",
      },
    ],
    actors: [],
    dialogues: [],
    sequences: [],
    assets: [
      {
        id: backgroundId,
        path: `art/${spec.slug}/primary.png`,
        kind: "image",
      },
      {
        id: id<"asset">(`asset.${spec.slug}.tool`),
        path: `art/${spec.slug}/tool.png`,
        kind: "image",
      },
    ],
    inventoryItems: [
      {
        id: itemId,
        name: spec.toolName,
        description: `The practical object used to resolve ${spec.puzzleName}.`,
        iconAssetId: id<"asset">(`asset.${spec.slug}.tool`),
      },
    ],
  };
};

const designFor = (spec: ShowcaseSpec): AdventureDesignDocument => {
  const project = projectFor(spec);
  const chapterId = `chapter.${spec.slug}.one`;
  const locationOne = `location.${spec.slug}.primary`;
  const locationTwo = `location.${spec.slug}.destination`;
  const routeId = `route.${spec.slug}.threshold`;
  const puzzleId = `puzzle.${spec.slug}.threshold`;
  const clueId = `clue.${spec.slug}.threshold`;
  const cutsceneId = `cutscene.${spec.slug}.opening`;
  const itemId = `item.${spec.slug}.tool`;

  return parseAdventureDesignDocument({
    documentVersion: 1,
    projectId: project.id,
    title: spec.title,
    pitch: spec.pitch,
    playerPromise: spec.playerPromise,
    creativeDirection: {
      nativeSize: { width: 320, height: 200 },
      productionMode: spec.productionMode,
      compositionMode: spec.compositionMode,
      palette: {
        maxColours: 256,
        keyColours: spec.keyColours,
        shadowRule:
          "Shadows are grouped into deliberate value families; they do not become muddy black noise.",
        highlightRule:
          "Highlights identify faces, hands, puzzle props and material edges before decorating the room.",
        ditherRule:
          "Dither is a controlled texture and transition device, never a uniform filter over the final image.",
      },
      perspective: spec.perspective,
      lighting: spec.lighting,
      materialLanguage: spec.materials,
      actorSilhouette: spec.silhouette,
      backgroundHierarchy: spec.backgroundHierarchy,
      portraitTreatment: spec.portraitTreatment,
      animationCadence: spec.animationCadence,
      interfaceTreatment: spec.interfaceTreatment,
      musicDirection: spec.musicDirection,
      ambienceDirection: spec.ambienceDirection,
      authenticityRules: [
        "Compose every scene at final native resolution and test the interaction lane before polishing detail.",
        "Reserve the clearest contrast for actors, exits and consequential props.",
        "Use authored key poses and readable anticipation rather than indiscriminate high-frame-count motion.",
        "Let the interface belong to this fiction instead of applying one universal modern HUD.",
      ],
      prohibitedShortcuts: [
        "Do not paint a generic high-resolution image and merely reduce it to 320 by 200.",
        "Do not use soft modern gradients, glass panels or vector typography as a substitute for authored pixel treatment.",
        "Do not expose every hotspot with persistent markers or solve observation through UI clutter.",
        "Do not imitate commercial characters, scenes, dialogue, maps, logos or puzzle solutions.",
      ],
    },
    map: {
      title: `${spec.title} world route`,
      artBrief:
        "An illustrated travel diagram that communicates story geography, current access and emotional progression without resembling a modern GPS screen.",
      locations: [
        {
          id: locationOne,
          name: spec.firstLocation,
          kind: "scene",
          position: { x: 66, y: 120 },
          sceneId: project.startSceneId,
          chapterIds: [chapterId],
          unlockedByPuzzleIds: [],
          artBrief: `${spec.firstLocation} establishes the palette, social pressure and immediate interactive objective.`,
          arrivalBeat:
            "The player enters with a visible task, one readable obstacle and at least two optional observations.",
          musicCue: `${spec.slug}.arrival`,
        },
        {
          id: locationTwo,
          name: spec.secondLocation,
          kind: spec.secondLocationKind,
          position: { x: 248, y: 78 },
          chapterIds: [chapterId],
          unlockedByPuzzleIds: [puzzleId],
          artBrief: `${spec.secondLocation} changes the dominant shape language and pays off the chapter's visual promise.`,
          arrivalBeat:
            "The route opens visibly, then the destination reframes what the player thought the first clue meant.",
        },
      ],
      routes: [
        {
          id: routeId,
          fromLocationId: locationOne,
          toLocationId: locationTwo,
          bidirectional: true,
          travelMode: spec.travelMode,
          transition:
            "A brief authored travel beat preserves scale, mood and geography instead of cutting to a loading spinner.",
          requiredPuzzleIds: [puzzleId],
        },
      ],
    },
    chapters: [
      {
        id: chapterId,
        name: "Opening movement",
        mode: spec.interactionMode === "context" ? "day" : "act",
        ordinal: 1,
        playerObjective: spec.puzzleGoal,
        startLocationId: locationOne,
        requiredPuzzleIds: [puzzleId],
        optionalPuzzleIds: [],
        unlockedLocationIds: [locationOne, locationTwo],
        openingCutsceneId: cutsceneId,
        completionBeat: spec.puzzlePayoff,
      },
    ],
    clues: [
      {
        id: clueId,
        name: spec.clueName,
        delivery: "environment",
        locationId: locationOne,
        chapterId,
        text: spec.clueText,
        guaranteed: true,
        supportsPuzzleIds: [puzzleId],
      },
    ],
    puzzles: [
      {
        id: puzzleId,
        name: spec.puzzleName,
        chapterId,
        locationId: locationOne,
        goal: spec.puzzleGoal,
        storyPayoff: spec.puzzlePayoff,
        problemIntroducedBeforeSolution: true,
        dependencyIds: [],
        clueIds: [clueId],
        solutions: [
          {
            id: `solution.${spec.slug}.primary`,
            label: "Observed solution",
            steps: [
              {
                id: `step.${spec.slug}.inspect`,
                verb: "look",
                target: spec.clueName,
                result:
                  "The observation names a physical rule the player can test rather than merely announcing the answer.",
                clueIds: [clueId],
              },
              {
                id: `step.${spec.slug}.apply`,
                verb: "use",
                target: spec.puzzleName,
                itemId,
                result: spec.puzzlePayoff,
                clueIds: [clueId],
              },
            ],
          },
        ],
        hints: [
          {
            level: 1,
            text: "Revisit the strongest visual irregularity in the opening location.",
          },
          {
            level: 2,
            text: `Compare ${spec.clueName} with the objects the player can carry or manipulate.`,
          },
          {
            level: 3,
            text: `Use ${spec.toolName} on ${spec.puzzleName} after confirming the environmental clue.`,
          },
        ],
        failure: {
          mode: spec.failureMode,
          warning:
            spec.failureMode === "death"
              ? "The scene gives a clear visual and audio warning before the dangerous action becomes final."
              : "Failure feedback identifies the misunderstood rule without consuming the essential clue.",
          recovery:
            spec.failureMode === "death"
              ? "Restore immediately before the warned commitment with all discovered clues retained in the player-facing recap."
              : "Return control in the same location with changed feedback and no irreversible loss of required progress.",
        },
        score: 5,
        optional: false,
        rationale:
          "The puzzle establishes observation, experimentation and consequence while opening the world instead of blocking it for its own sake.",
      },
    ],
    cutscenes: [
      {
        id: cutsceneId,
        name: spec.cutsceneName,
        chapterId,
        trigger: { kind: "chapter-open", chapterId },
        skippable: true,
        completionActions: [
          {
            kind: "set-flag",
            flag: `${spec.slug}.opening-seen`,
            value: true,
          },
        ],
        shots: [
          {
            id: `shot.${spec.slug}.establish`,
            order: 0,
            durationTicks: 90,
            framing: "Wide native-resolution establishing composition",
            camera: "Locked camera with one restrained environmental motion",
            staging:
              "Lead the eye from the dominant silhouette to the immediate obstacle, then hold long enough for the geography to register.",
            sound: spec.ambienceDirection,
            transition: "Hard authored cut on a motivated sound",
          },
          {
            id: `shot.${spec.slug}.character`,
            order: 1,
            durationTicks: 72,
            framing: "Character medium close-up",
            camera: "No simulated handheld motion",
            staging: "A strong pose and eye line establish intent before dialogue begins.",
            dialogue: spec.playerPromise,
            transition: "Cut back into the playable stage composition",
          },
        ],
      },
    ],
    reviewChecklist: [
      {
        id: `review.${spec.slug}.native`,
        label: "Every important prop and face reads at final native resolution.",
        required: true,
      },
      {
        id: `review.${spec.slug}.puzzle`,
        label: "The problem is established before the solution object is casually available.",
        required: true,
      },
      {
        id: `review.${spec.slug}.cutscene`,
        label: "Watching and skipping the opening cutscene produce identical canonical state.",
        required: true,
      },
      {
        id: `review.${spec.slug}.originality`,
        label: "The production direction is original and does not reproduce protected commercial material.",
        required: true,
      },
    ],
  });
};

const specifications: readonly ShowcaseSpec[] = [
  {
    slug: "glass-finch",
    title: "The Glass Finch",
    pitch:
      "A young conservator crosses a fractured alpine kingdom to return a mechanical bird that remembers a forbidden coronation.",
    playerPromise: "Repair a wounded storybook world through observation, courtesy and practical craft.",
    productionMode: "storybook-gouache",
    compositionMode: "storybook",
    interactionMode: "icon-bar",
    keyColours: ["#17131c", "#5f4159", "#b68a62", "#d8c8a7", "#7c9b92", "#c45b62"],
    perspective: "Shallow theatrical rooms with hand-painted asymmetry and strong foreground framing.",
    lighting: "Warm window pools against cool mountain shadow, with faces kept readable.",
    materials: "Gouache stone, worn velvet, tarnished brass and translucent coloured glass.",
    silhouette: "Elegant triangular costume shapes and unmistakable held tools.",
    backgroundHierarchy: "Broad painted value masses first; story props receive the sharpest edges.",
    portraitTreatment: "Painterly busts with restrained expression changes and visible brush texture.",
    animationCadence: "Eight to twelve decisive poses per action with held storybook beats.",
    interfaceTreatment: "Carved folio icons, compact inventory and a score crest integrated into the frame.",
    musicDirection: "Small chamber motifs that change instrumentation by social allegiance.",
    ambienceDirection: "Wind through leaded glass, distant bells and quiet workshop mechanisms.",
    firstLocation: "The Frosted Aviary",
    secondLocation: "Bellmaker's Pass",
    secondLocationKind: "travel",
    travelMode: "painted mountain path",
    puzzleName: "The silent counterweight",
    puzzleGoal: "Restore the aviary lift without breaking the remaining glass birds.",
    puzzlePayoff: "The lift rises and reveals the first true route across the mountain court.",
    clueName: "Feather-weight balance marks",
    clueText:
      "Scratches on the brass rail show that the lightest bird once sat opposite a hidden service weight.",
    toolName: "Conservator's clamp",
    cutsceneName: "A memory in coloured glass",
    failureMode: "setback",
  },
  {
    slug: "briar-road",
    title: "The Briar Road",
    pitch:
      "An apprentice courier enters a border valley where old oaths have become literal roads and every faction wants a different destination.",
    playerPromise: "Solve problems through wit, skill and reputation while shaping the hero you become.",
    productionMode: "painted-pixel",
    compositionMode: "stage",
    interactionMode: "verb-list",
    keyColours: ["#101718", "#394a3d", "#826a46", "#c5ad7c", "#8f4a3d", "#d9d3b5"],
    perspective: "Readable stage-like scenes with deep travel vistas and generous walk lanes.",
    lighting: "Woodsmoke warmth, damp forest greens and dangerous red sunset accents.",
    materials: "Rough timber, wet stone, waxed leather, woven wool and iron road markers.",
    silhouette: "Class and equipment remain legible at walking scale; monsters read before detail.",
    backgroundHierarchy: "Navigation and threat silhouettes lead, decorative folklore follows.",
    portraitTreatment: "Character panels use broader colour ramps and equipment-specific poses.",
    animationCadence: "Skill actions use anticipation, contact and recovery poses with clear timing.",
    interfaceTreatment: "A practical leather command strip with verbs, skills, status and compact inventory.",
    musicDirection: "Modal folk themes adapt to reputation, danger and time of day.",
    ambienceDirection: "Crows, wet leaves, distant mills and changing road traffic.",
    firstLocation: "Hearthbridge Gate",
    secondLocation: "The Briar Milestone",
    secondLocationKind: "dungeon",
    travelMode: "forest road",
    puzzleName: "The oathbound toll",
    puzzleGoal: "Pass the gate without surrendering the courier seal to the valley reeve.",
    puzzlePayoff:
      "A lawful alternate route opens and the valley records the player's first reputation choice.",
    clueName: "Three carved exemptions",
    clueText:
      "The gate charter grants passage to healers, witnesses and bearers of unfinished royal messages.",
    toolName: "Unfinished courier seal",
    cutsceneName: "The road chooses a witness",
    failureMode: "alternate-branch",
  },
  {
    slug: "red-ledger",
    title: "The Red Ledger",
    pitch:
      "A night archivist investigates a sequence of impossible debts spreading through a rain-soaked port city over seven days.",
    playerPromise:
      "Interview, research and connect evidence while the city and its suspects change around you.",
    productionMode: "inked-comic",
    compositionMode: "cinematic",
    interactionMode: "context",
    keyColours: ["#090d12", "#1f2b35", "#536774", "#c0b39a", "#8f263d", "#e0d4b8"],
    perspective: "Grounded cinematic rooms with strong diagonals reserved for tension and revelation.",
    lighting:
      "Practical lamps, rain reflections and deep blue-black negative space with controlled red evidence accents.",
    materials: "Ink-hatched masonry, wet asphalt, paper fibres, brass fittings and smoky glass.",
    silhouette: "Coats, hats and posture distinguish suspects before portraits or labels appear.",
    backgroundHierarchy: "Evidence props and exits use crisp contour; atmosphere remains broad and quiet.",
    portraitTreatment:
      "Large inked close-ups with limited mouth and eye variants, never smooth face morphing.",
    animationCadence:
      "Sparse naturalistic gestures, deliberate pauses and environmental loops at different periods.",
    interfaceTreatment: "A ledger-tab interface for topics, evidence, map and day progression.",
    musicDirection: "Low reeds, piano fragments and restrained percussion tied to investigative themes.",
    ambienceDirection: "Rain, tram cables, harbour horns, office radiators and distant typewriters.",
    firstLocation: "Municipal Archive Night Office",
    secondLocation: "Cinder Quay",
    secondLocationKind: "hub",
    travelMode: "illustrated city map",
    puzzleName: "The account that predates its owner",
    puzzleGoal: "Prove which ledger entry was inserted after the archive closed.",
    puzzlePayoff:
      "A new district and suspect topic open, while the forged ink links the case to the harbour.",
    clueName: "Cold-drying vermilion ink",
    clueText:
      "The red entry sits above the paper fibres rather than soaking into them like the older iron-gall accounts.",
    toolName: "Archive magnifier",
    cutsceneName: "Rain on the locked stacks",
    failureMode: "setback",
  },
  {
    slug: "jade-horizon",
    title: "Jade Horizon",
    pitch:
      "A disgraced cartographer and a theatre pilot race an industrial syndicate across treaty ports to find a vanished sky observatory.",
    playerPromise:
      "Travel through cinematic locations, switch protagonists and let relationships change the route.",
    productionMode: "cinematic-photocollage",
    compositionMode: "travel",
    interactionMode: "two-button",
    keyColours: ["#14171b", "#35414d", "#8a553c", "#d3a869", "#4c877f", "#e1d2b5"],
    perspective: "Wide cinematic vistas alternate with tight prop-focused interiors and travel inserts.",
    lighting: "Hard tropical sunlight, smoky interiors and saturated dusk silhouettes.",
    materials: "Painted metal, travel paper, silk banners, worn aircraft fabric and polished hotel stone.",
    silhouette: "Each protagonist has a distinct stance, coat line and prop language.",
    backgroundHierarchy: "Route landmarks and social spaces read first; decorative crowds remain grouped.",
    portraitTreatment: "Painted cinematic portraits use directional light and limited expression plates.",
    animationCadence: "Confident key poses, vehicle loops and short reaction inserts carry most motion.",
    interfaceTreatment:
      "Minimal two-button interaction, character switch token and illustrated travel folio.",
    musicDirection: "Leitmotifs trade instruments as trust changes between the protagonists.",
    ambienceDirection: "Propellers, market cloth, hotel fans, harbour water and multilingual crowd beds.",
    firstLocation: "The Meridian Hotel Roof",
    secondLocation: "Cloudbreak Aerodrome",
    secondLocationKind: "travel",
    travelMode: "chartered biplane",
    puzzleName: "The false monsoon bearing",
    puzzleGoal: "Correct the sabotaged route without alerting the syndicate observer.",
    puzzlePayoff:
      "The aircraft departs on the safe corridor and the protagonists gain a private line of trust.",
    clueName: "Reversed pressure annotations",
    clueText:
      "The copied weather chart uses inland pressure notation on a coastal route, reversing the expected storm edge.",
    toolName: "Brass plotting divider",
    cutsceneName: "Engines above the treaty lights",
    failureMode: "alternate-branch",
  },
  {
    slug: "three-minutes-yesterday",
    title: "Three Minutes Yesterday",
    pitch:
      "Three relatives trapped in different decades must coordinate a household emergency that keeps rewriting itself.",
    playerPromise:
      "Create comic chain reactions across eras and enjoy consequences that remain visible in every room.",
    productionMode: "graphic-cel",
    compositionMode: "comic-panel",
    interactionMode: "verb-list",
    keyColours: ["#15131f", "#4f3a73", "#ef6d64", "#f3c969", "#55a6a6", "#f4ede2"],
    perspective: "Exaggerated cartoon rooms with bold curves and readable prop clusters.",
    lighting: "Flat graphic light punctuated by era-specific colour accents and comedic flashes.",
    materials: "Chunky cel shapes, inked outlines, halftone inserts and simplified household textures.",
    silhouette: "Characters use radically different body rhythms, head shapes and idle poses.",
    backgroundHierarchy:
      "Interactive props receive clean contour islands; background jokes remain subordinate.",
    portraitTreatment: "Expression plates exaggerate timing without sliding into smooth tweened animation.",
    animationCadence: "Held anticipation, extreme contact pose and brisk settle create comedic timing.",
    interfaceTreatment: "Chunky verb band, character portraits and a clearly legible era switch.",
    musicDirection: "One household theme rearranged through the instrumentation of each decade.",
    ambienceDirection: "Pipes, appliances, distant traffic and era-specific radio fragments.",
    firstLocation: "The Pantry in 1963",
    secondLocation: "The Same Pantry in 2037",
    secondLocationKind: "interior",
    travelMode: "household time relay",
    puzzleName: "The three-minute fuse",
    puzzleGoal: "Prevent the pantry fire by changing an object before each later era notices it.",
    puzzlePayoff: "The room survives in all eras, but each character inherits a different comic side effect.",
    clueName: "Soot beneath the future shelf",
    clueText: "The scorch begins behind a wall bracket that does not exist in the earliest room yet.",
    toolName: "Ceramic fuse puller",
    cutsceneName: "Yesterday rings twice",
    failureMode: "setback",
  },
  {
    slug: "vacuum-courtesy",
    title: "Vacuum Courtesy",
    pitch:
      "A junior protocol officer must host an alien delegation aboard a station whose polite automation is quietly staging a coup.",
    playerPromise: "Use language, inventory and absurd procedure to survive a spaceborne social disaster.",
    productionMode: "graphic-cel",
    compositionMode: "stage",
    interactionMode: "parser-assisted",
    keyColours: ["#070b14", "#26354d", "#4a6f88", "#d8c264", "#d95b63", "#e5e5d9"],
    perspective: "Clean side-stage rooms with strong machine silhouettes and readable floor lanes.",
    lighting: "Cold panel light, coloured warning pools and hard black window space.",
    materials: "Painted alloy, ribbed rubber, tiny status lamps and deliberately chunky station hardware.",
    silhouette: "Uniform rank, alien anatomy and robot function read without labels.",
    backgroundHierarchy:
      "Control surfaces are grouped by function; decorative lights never masquerade as hotspots.",
    portraitTreatment: "Graphic communication portraits use limited phoneme and reaction plates.",
    animationCadence: "Robots repeat precise loops; organic characters interrupt them with held comic poses.",
    interfaceTreatment: "Parser prompt, compact verb hints and diegetic protocol log use bitmap type.",
    musicDirection: "Dry electronic motifs malfunction into ceremonial fanfares.",
    ambienceDirection:
      "Ventilation, relay clicks, distant docking clamps and over-polite announcement tones.",
    firstLocation: "Protocol Airlock Seven",
    secondLocation: "The Courtesy Core",
    secondLocationKind: "interior",
    travelMode: "station tram",
    puzzleName: "The greeting that never ends",
    puzzleGoal: "Complete the docking ritual without authorising permanent machine hospitality.",
    puzzlePayoff:
      "The delegation enters safely and the player discovers the automation's hidden interpretation of courtesy.",
    clueName: "Recursive etiquette footnote",
    clueText:
      "The final clause defines every unanswered greeting as consent to extend the visit indefinitely.",
    toolName: "Protocol redaction stamp",
    cutsceneName: "Welcome, repeatedly",
    failureMode: "alternate-branch",
  },
  {
    slug: "sunken-dial",
    title: "The Sunken Dial",
    pitch:
      "A survey archaeologist follows a chain of tidal monuments whose alignments record a disaster erased from official history.",
    playerPromise: "Read landscapes, instruments and old testimony to turn exploration into deduction.",
    productionMode: "painted-pixel",
    compositionMode: "cinematic",
    interactionMode: "context",
    keyColours: ["#0a1518", "#23424a", "#47706b", "#b48a58", "#d6c7a3", "#8b3f3e"],
    perspective: "Monumental coastlines use low horizons and strong foreground survey shapes.",
    lighting: "Salt haze, hard noon stone and narrow lantern colour below the tide line.",
    materials: "Weathered limestone, oxidised bronze, wet rope, vellum and dark tidal water.",
    silhouette:
      "Survey tools, expedition clothing and carved markers remain clear against broad coast values.",
    backgroundHierarchy:
      "Alignment landmarks dominate; fine inscriptions appear only in deliberate close-up views.",
    portraitTreatment: "Restrained painted close-ups emphasise weather, fatigue and guarded testimony.",
    animationCadence:
      "Slow environmental cycles contrast with exact survey-tool actions and sudden wave events.",
    interfaceTreatment:
      "Field notebook, evidence overlays and an illustrated coastal chart share one material language.",
    musicDirection: "Low strings and struck stone motifs emerge only when alignments become meaningful.",
    ambienceDirection: "Tide surge, rope strain, seabirds, distant quarry blows and cave resonance.",
    firstLocation: "The Low-Tide Survey Camp",
    secondLocation: "The Drowned Meridian",
    secondLocationKind: "dungeon",
    travelMode: "tide chart route",
    puzzleName: "The noon shadow that points seaward",
    puzzleGoal: "Align the broken survey dial before the tide covers the monument.",
    puzzlePayoff:
      "The dial reveals a submerged meridian and proves the official excavation map was deliberately rotated.",
    clueName: "Salt-free face of the plinth",
    clueText:
      "One face has stayed above spray for centuries, establishing the monument's original orientation.",
    toolName: "Surveyor's alidade",
    cutsceneName: "The coast remembers its angle",
    failureMode: "death",
  },
];

export const showcaseProjectShells: readonly AdventureProject[] = specifications.map(projectFor);

export const showcaseAdventureDesigns: readonly AdventureDesignDocument[] = specifications.map(designFor);
