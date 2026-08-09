import { colourLuminance, colourSaturation, validHexColour } from "./authenticity-colour.js";
import {
  addAuthenticityCheck,
  createAuthenticityDimension,
  type MutableAuthenticityDimension,
} from "./authenticity-types.js";
import type { AdventureDesignDocument } from "./types.js";

const distinctStrings = (values: readonly string[]): boolean =>
  new Set(values.map((value) => value.trim().toLocaleLowerCase("en-US"))).size === values.length;

const nativeCanvas = (document: AdventureDesignDocument): MutableAuthenticityDimension => {
  const result = createAuthenticityDimension("native-canvas");
  const size = document.creativeDirection.nativeSize;
  addAuthenticityCheck(
    result,
    (size.width === 320 && size.height === 200) || (size.width === 640 && size.height === 480),
    4,
    {
      id: "native-canvas-nonstandard",
      severity: "warning",
      path: "creativeDirection.nativeSize",
      message: `${size.width} × ${size.height} is not a recognised VGA or SVGA production canvas.`,
      recommendation:
        "Use 320 × 200 or 640 × 480, or document the nonstandard canvas as a conscious constraint.",
    },
  );
  const palette = document.creativeDirection.palette;
  addAuthenticityCheck(result, palette.maxColours >= 16 && palette.maxColours <= 256, 3, {
    id: "native-canvas-colour-budget",
    severity: "warning",
    path: "creativeDirection.palette.maxColours",
    message: "The colour budget is outside the common 16-to-256-colour authored range.",
    recommendation:
      "For a VGA identity, build around a controlled indexed budget no greater than 256 colours.",
  });
  addAuthenticityCheck(result, palette.keyColours.length >= 6 && palette.keyColours.length <= 24, 2, {
    id: "native-canvas-anchor-count",
    severity: "warning",
    path: "creativeDirection.palette.keyColours",
    message: "The anchor palette is too sparse or too diffuse to guide production.",
    recommendation:
      "Define six to twenty-four anchors for shadow, material, skin, environmental light and UI accents.",
  });
  addAuthenticityCheck(
    result,
    document.creativeDirection.authenticityRules.some((rule) =>
      /native|pixel|canvas|resolution/iu.test(rule),
    ),
    1,
    {
      id: "native-canvas-rule-missing",
      severity: "note",
      path: "creativeDirection.authenticityRules",
      message: "The guardrails do not explicitly protect native-resolution composition.",
      recommendation:
        "Require thumbnails, staging and interaction readability to be reviewed at final native size.",
    },
  );
  return result;
};

const paletteValues = (document: AdventureDesignDocument): MutableAuthenticityDimension => {
  const result = createAuthenticityDimension("palette-values");
  const colours = document.creativeDirection.palette.keyColours;
  const valid = colours.filter(validHexColour);
  const luminances = valid
    .map(colourLuminance)
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
  const saturations = valid.map(colourSaturation).filter((value): value is number => value !== null);
  addAuthenticityCheck(result, valid.length === colours.length, 2, {
    id: "palette-invalid-anchor",
    severity: "error",
    path: "creativeDirection.palette.keyColours",
    message: "One or more anchors are not six-digit hexadecimal colours.",
    recommendation: "Store deterministic #RRGGBB anchors so value and saturation review is reproducible.",
  });
  addAuthenticityCheck(
    result,
    new Set(colours.map((colour) => colour.toLowerCase())).size === colours.length,
    2,
    {
      id: "palette-duplicate-anchor",
      severity: "warning",
      path: "creativeDirection.palette.keyColours",
      message: "The anchor palette repeats colours and overstates its usable range.",
      recommendation: "Remove duplicates and assign each retained anchor a production role.",
    },
  );
  const minimum = luminances[0] ?? 1;
  const maximum = luminances.at(-1) ?? 0;
  addAuthenticityCheck(result, maximum - minimum >= 0.48, 3, {
    id: "palette-value-range-narrow",
    severity: "warning",
    path: "creativeDirection.palette.keyColours",
    message: "The palette cannot clearly separate shadow, action and focal highlights.",
    recommendation:
      "Add a deep shadow and restrained focal highlight, then review the composition in greyscale.",
  });
  addAuthenticityCheck(result, minimum <= 0.12 && maximum >= 0.62, 2, {
    id: "palette-value-extremes-missing",
    severity: "note",
    path: "creativeDirection.palette.keyColours",
    message: "The palette lacks a strong shadow or readable highlight anchor.",
    recommendation: "Reserve extreme values for silhouettes, faces, exits and consequential props.",
  });
  addAuthenticityCheck(
    result,
    saturations.some((value) => value >= 0.55),
    1,
    {
      id: "palette-accent-missing",
      severity: "note",
      path: "creativeDirection.palette.keyColours",
      message: "No anchor provides a decisive chromatic accent.",
      recommendation:
        "Reserve one saturated family for interaction, danger, magic or another project meaning.",
    },
  );
  return result;
};

const sceneComposition = (document: AdventureDesignDocument): MutableAuthenticityDimension => {
  const result = createAuthenticityDimension("scene-composition");
  const size = document.creativeDirection.nativeSize;
  addAuthenticityCheck(
    result,
    document.map.locations.every(
      (location) =>
        location.position.x >= 0 &&
        location.position.y >= 0 &&
        location.position.x <= size.width &&
        location.position.y <= size.height,
    ),
    2,
    {
      id: "composition-map-outside-canvas",
      severity: "warning",
      path: "map.locations",
      message: "One or more illustrated-map nodes fall outside the native canvas.",
      recommendation: "Keep nodes inside the authored canvas so labels and routes remain legible.",
    },
  );
  addAuthenticityCheck(
    result,
    document.map.locations.every(
      (location) => location.artBrief.length >= 48 && location.arrivalBeat.length >= 48,
    ),
    3,
    {
      id: "composition-location-brief-thin",
      severity: "warning",
      path: "map.locations",
      message: "At least one location lacks a useful visual brief or arrival beat.",
      recommendation:
        "Define value mass, interaction lane, actor entrance, focal prop, exit hierarchy and first task.",
    },
  );
  const direction = document.creativeDirection;
  addAuthenticityCheck(
    result,
    direction.perspective.length >= 32 &&
      direction.lighting.length >= 32 &&
      direction.backgroundHierarchy.length >= 32,
    3,
    {
      id: "composition-doctrine-thin",
      severity: "warning",
      path: "creativeDirection",
      message: "Perspective, lighting or background hierarchy is underdefined.",
      recommendation:
        "Describe camera height, vanishing behaviour, light direction, value grouping and detail limits.",
    },
  );
  addAuthenticityCheck(
    result,
    new Set(document.map.locations.map((location) => location.kind)).size >= 2,
    1,
    {
      id: "composition-location-variety",
      severity: "note",
      path: "map.locations",
      message: "Every location uses the same spatial role.",
      recommendation: "Mix hubs, interiors, travel beats, close-ups and set pieces to vary visual rhythm.",
    },
  );
  addAuthenticityCheck(
    result,
    distinctStrings(document.map.locations.map((location) => location.artBrief)),
    1,
    {
      id: "composition-briefs-repeated",
      severity: "note",
      path: "map.locations",
      message: "Location art briefs repeat rather than define distinct identities.",
      recommendation: "Vary silhouette, value mass, material family and emotional temperature.",
    },
  );
  return result;
};

const actorPerformance = (document: AdventureDesignDocument): MutableAuthenticityDimension => {
  const result = createAuthenticityDimension("actor-performance");
  const direction = document.creativeDirection;
  addAuthenticityCheck(result, direction.actorSilhouette.length >= 40, 3, {
    id: "actor-silhouette-thin",
    severity: "warning",
    path: "creativeDirection.actorSilhouette",
    message: "Actor silhouette direction cannot yet govern native-scale readability.",
    recommendation:
      "Specify posture, costume masses, held objects, facing consistency and background separation.",
  });
  addAuthenticityCheck(result, direction.portraitTreatment.length >= 32, 2, {
    id: "actor-portrait-thin",
    severity: "note",
    path: "creativeDirection.portraitTreatment",
    message: "Portrait and close-up treatment is underdefined.",
    recommendation:
      "Define crop, eye line, light continuity, expression range and relation to the stage actor.",
  });
  addAuthenticityCheck(result, direction.animationCadence.length >= 40, 3, {
    id: "actor-animation-thin",
    severity: "warning",
    path: "creativeDirection.animationCadence",
    message: "Animation cadence lacks enough key-pose direction.",
    recommendation: "Define anticipation, contact, reaction, held poses, loop closure and frame budgets.",
  });
  addAuthenticityCheck(result, direction.authenticityRules.length >= 4, 1, {
    id: "actor-authenticity-rules-sparse",
    severity: "note",
    path: "creativeDirection.authenticityRules",
    message: "The bible has too few positive production guardrails.",
    recommendation: "Record at least four rules artists and animators can apply in review.",
  });
  addAuthenticityCheck(result, direction.prohibitedShortcuts.length >= 4, 1, {
    id: "actor-shortcut-rules-sparse",
    severity: "note",
    path: "creativeDirection.prohibitedShortcuts",
    message: "The bible has too few explicit visual anti-patterns.",
    recommendation: "Record shortcuts likely to flatten silhouette, material or motion rhythm.",
  });
  return result;
};

const interfaceIdentity = (document: AdventureDesignDocument): MutableAuthenticityDimension => {
  const result = createAuthenticityDimension("interface-identity");
  const direction = document.creativeDirection;
  addAuthenticityCheck(result, direction.interfaceTreatment.length >= 48, 4, {
    id: "interface-treatment-thin",
    severity: "warning",
    path: "creativeDirection.interfaceTreatment",
    message: "The project does not yet have a complete interaction language.",
    recommendation:
      "Specify layout, cursor grammar, bitmap type, inventory, dialogue, score and accessibility.",
  });
  addAuthenticityCheck(
    result,
    direction.prohibitedShortcuts.some((rule) =>
      /interface|hud|vector|glass|hotspot|marker|typography/iu.test(rule),
    ),
    2,
    {
      id: "interface-modern-shortcut-unguarded",
      severity: "note",
      path: "creativeDirection.prohibitedShortcuts",
      message: "No shortcut rule protects the interface from generic modern treatment.",
      recommendation: "Ban the overlays, glass panels, vector type or markers that break this fiction.",
    },
  );
  addAuthenticityCheck(result, direction.palette.keyColours.length >= 6, 2, {
    id: "interface-palette-unanchored",
    severity: "note",
    path: "creativeDirection.palette.keyColours",
    message: "The interface lacks enough shared palette anchors.",
    recommendation: "Reserve UI colours from the world palette and test them over scene values.",
  });
  addAuthenticityCheck(result, direction.productionMode !== "custom", 2, {
    id: "interface-custom-production-mode",
    severity: "note",
    path: "creativeDirection.productionMode",
    message: "A custom production mode provides no inherited period defaults.",
    recommendation: "Document explicit native UI and cursor conventions for a custom mode.",
  });
  return result;
};

const audioIdentity = (document: AdventureDesignDocument): MutableAuthenticityDimension => {
  const result = createAuthenticityDimension("audio-identity");
  const direction = document.creativeDirection;
  addAuthenticityCheck(result, direction.musicDirection.length >= 40, 3, {
    id: "audio-music-thin",
    severity: "warning",
    path: "creativeDirection.musicDirection",
    message: "Music direction cannot yet guide thematic and dramatic continuity.",
    recommendation: "Define instrumentation, motif ownership, transitions and when silence leads.",
  });
  addAuthenticityCheck(result, direction.ambienceDirection.length >= 40, 3, {
    id: "audio-ambience-thin",
    severity: "warning",
    path: "creativeDirection.ambienceDirection",
    message: "Ambience direction cannot yet create a coherent environmental identity.",
    recommendation: "Define room tone, weather, machinery, wildlife, crowds and state changes.",
  });
  const locations = document.map.locations;
  const cueCoverage =
    locations.length === 0 ? 0 : locations.filter((location) => location.musicCue).length / locations.length;
  addAuthenticityCheck(result, cueCoverage >= 0.5, 2, {
    id: "audio-location-cue-coverage",
    severity: "note",
    path: "map.locations",
    message: "Fewer than half of the locations define a musical arrival cue.",
    recommendation: "Assign cues to major locations and deliberately mark ambience-led or silent spaces.",
  });
  const shots = document.cutscenes.flatMap((cutscene) => cutscene.shots);
  const soundCoverage = shots.length === 0 ? 0 : shots.filter((shot) => shot.sound).length / shots.length;
  addAuthenticityCheck(result, soundCoverage >= 0.5, 2, {
    id: "audio-storyboard-sound-coverage",
    severity: "note",
    path: "cutscenes",
    message: "Fewer than half of storyboard shots carry explicit sound intent.",
    recommendation: "Mark dialogue, music, ambience, sync effects or intentional silence per shot.",
  });
  return result;
};

export const evaluateAdventureFoundationDimensions = (
  document: AdventureDesignDocument,
): readonly MutableAuthenticityDimension[] => [
  nativeCanvas(document),
  paletteValues(document),
  sceneComposition(document),
  actorPerformance(document),
  interfaceIdentity(document),
  audioIdentity(document),
];
