import type { Id } from "@evavo/adventure-project-schema";
import { nightShiftRuntimeProject } from "./night-shift-runtime-contracts.js";

export type NightShiftProductionAssetRole =
  | "background"
  | "actor"
  | "prop"
  | "foreground"
  | "palette"
  | "font"
  | "ui-icon"
  | "audio-effect"
  | "audio-ambience";

export type NightShiftAssetEvidenceRole =
  | "period-vga"
  | "indexed-runtime"
  | "binary-alpha"
  | "opaque-native"
  | "audio-runtime"
  | "ui-native";

export interface NightShiftProductionAssetRequirement {
  readonly assetId: Id<"asset">;
  readonly role: NightShiftProductionAssetRole;
  readonly sourcePath: string;
  readonly nativeSize: { readonly width: number; readonly height: number } | null;
  readonly sizePolicy: "exact" | "art-directed" | "duration-dependent";
  readonly indexed: boolean;
  readonly alpha: "opaque" | "binary" | "not-applicable";
  readonly paletteRole: string | null;
  readonly evidence: readonly NightShiftAssetEvidenceRole[];
  readonly rules: readonly string[];
}

const requirement = (
  assetId: string,
  role: NightShiftProductionAssetRole,
  options: Omit<NightShiftProductionAssetRequirement, "assetId" | "role" | "sourcePath">,
): NightShiftProductionAssetRequirement => {
  const asset = nightShiftRuntimeProject.assets.find((candidate) => candidate.id === assetId);
  if (!asset) throw new Error(`Night Shift production requirement references missing asset '${assetId}'.`);
  return {
    assetId: asset.id,
    role,
    sourcePath: asset.path,
    ...options,
  };
};

const indexedBackground = (assetId: string, sceneLanguage: string) =>
  requirement(assetId, "background", {
    nativeSize: { width: 320, height: 200 },
    sizePolicy: "exact",
    indexed: true,
    alpha: "opaque",
    paletteRole: "room master",
    evidence: ["period-vga", "indexed-runtime", "opaque-native"],
    rules: [
      "Author and approve the room at raw 320×200; do not downsample a high-resolution concept painting as the final master.",
      "Block five to seven major value masses before material microdetail so paths, actors and exits read immediately.",
      "Keep perspective and practical architecture grounded; this is municipal contemporary VGA, not fantasy or cyberpunk scenery.",
      "Use selective material dithering and clustered highlights rather than uniform noise, modern gradients or baked CRT treatment.",
      sceneLanguage,
    ],
  });

const indexedActor = (
  assetId: string,
  nativeSize: { readonly width: number; readonly height: number },
  rules: readonly string[],
) =>
  requirement(assetId, "actor", {
    nativeSize,
    sizePolicy: "exact",
    indexed: true,
    alpha: "binary",
    paletteRole: "actor lighting banks 0/32/64/96",
    evidence: ["period-vga", "indexed-runtime", "binary-alpha"],
    rules: [
      "Sprite silhouette must read at 1× without a universal mechanical black outline.",
      "Use binary transparency only; no soft antialiased edge pixels or modern subpixel filtering.",
      "Skin, uniform, cloth and leather clusters must survive every authored palette-light bank without losing facial readability.",
      ...rules,
    ],
  });

const indexedProp = (
  assetId: string,
  nativeSize: { readonly width: number; readonly height: number },
  rules: readonly string[],
) =>
  requirement(assetId, "prop", {
    nativeSize,
    sizePolicy: "exact",
    indexed: true,
    alpha: "binary",
    paletteRole: "room/object reserved colours",
    evidence: ["period-vga", "indexed-runtime", "binary-alpha"],
    rules: [
      "Keep the prop readable at raw 1× without enlarging it beyond believable real-world proportions.",
      "Preserve hard binary edges and meaningful pixel clusters; do not outline every interior edge.",
      ...rules,
    ],
  });

const foreground = (assetId: string, rules: readonly string[]) =>
  requirement(assetId, "foreground", {
    nativeSize: null,
    sizePolicy: "art-directed",
    indexed: false,
    alpha: "binary",
    paletteRole: null,
    evidence: ["period-vga", "binary-alpha"],
    rules: [
      "Crop the foreground plate tightly around only the geometry that must occlude actors.",
      "Its authored baseline must agree visually with the corresponding room surface at native resolution.",
      "Use binary transparency; never feather the edge to hide a bad mask.",
      ...rules,
    ],
  });

const scenePalette = (assetId: string, sceneLabel: string) =>
  requirement(assetId, "palette", {
    nativeSize: null,
    sizePolicy: "art-directed",
    indexed: false,
    alpha: "not-applicable",
    paletteRole: `${sceneLabel} room/prop default palette`,
    evidence: ["indexed-runtime"],
    rules: [
      `Lock the ${sceneLabel} scene palette from the approved native indexed room master; do not invent a separate unrelated runtime palette after art approval.`,
      "Provide 1–256 complete RGBA palette entries with enough range for the maximum source index used by the room background and its indexed practical props.",
      "Preserve reserved material ramps deliberately so background and object index maps resolve consistently through the same room palette.",
    ],
  });

const audio = (assetId: string, role: "audio-effect" | "audio-ambience", rules: readonly string[]) =>
  requirement(assetId, role, {
    nativeSize: null,
    sizePolicy: "duration-dependent",
    indexed: false,
    alpha: "not-applicable",
    paletteRole: null,
    evidence: ["audio-runtime"],
    rules,
  });

export const nightShiftProductionAssets: readonly NightShiftProductionAssetRequirement[] = [
  indexedBackground(
    "asset.night-shift.background.station",
    "Station art should read as fluorescent municipal space: practical desks, briefing clutter and ordinary institutional materials rather than dramatic noir set dressing.",
  ),
  indexedBackground(
    "asset.night-shift.background.roadside",
    "Roadside art should separate wet asphalt, shoulder, vehicle silhouette and distant night values with restrained headlamp/rain contrast and no bloom.",
  ),
  indexedBackground(
    "asset.night-shift.background.diner",
    "Diner art should feel warm, observed and mundane: service counter, receipt area and quiet late-night depth rather than nostalgic neon caricature.",
  ),

  indexedActor("asset.night-shift.actor.officer", { width: 264, height: 50 }, [
    "The master contains idle, eight walk frames, reach, inspect and notebook poses in one single-page strip.",
    "Keep the planted foot within one native pixel across contact frames and retain stable hand/shadow anchors.",
    "Officer proportions must remain deliberately small against the room, matching early SCI1 staging rather than later portrait-heavy SCI32 scale.",
  ]),
  indexedActor("asset.night-shift.actor.sergeant", { width: 26, height: 46 }, [
    "The fixed sergeant should read as a working desk figure rather than a cinematic portrait pasted into the room.",
  ]),
  indexedActor("asset.night-shift.actor.driver", { width: 22, height: 44 }, [
    "Keep the driver readable beside the stopped sedan at roadside scale without exaggerating silhouette or gesture.",
  ]),
  indexedActor("asset.night-shift.actor.server", { width: 24, height: 46 }, [
    "The server remains an in-scene performance with clear face/torso clusters behind the counter rather than a dialogue portrait overlay.",
  ]),

  indexedProp("asset.night-shift.object.radio", { width: 16, height: 14 }, [
    "Charger/radio silhouette must still read as a small practical target; click comfort is authored separately and must not change the pixels.",
  ]),
  indexedProp("asset.night-shift.object.keys", { width: 12, height: 8 }, [
    "Use only enough highlight contrast for the key ring to read against the wall hook at 1×.",
  ]),
  indexedProp("asset.night-shift.object.door", { width: 30, height: 60 }, [
    "Door pixels must align with the threshold/door-frame composition so visual state and navigation state never disagree.",
  ]),
  indexedProp("asset.night-shift.object.sedan", { width: 84, height: 34 }, [
    "Vehicle body should use broad hard clusters and restrained wet highlights, not glossy modern concept-art reflections.",
  ]),
  indexedProp("asset.night-shift.object.briefing", { width: 20, height: 14 }, [
    "Text on the paper is implied at scene scale; do not fill the prop with illegible AI-like pseudo-writing.",
  ]),
  indexedProp("asset.night-shift.object.receipt", { width: 12, height: 10 }, [
    "The receipt spike is tiny by design; readability comes from silhouette/value and click comfort rather than oversizing the paper.",
  ]),

  foreground("asset.night-shift.foreground.desk", [
    "Keep only the desk-front geometry needed to let the officer pass convincingly behind the station counter edge.",
  ]),
  foreground("asset.night-shift.foreground.door-frame", [
    "The door-frame plate must preserve the exact reveal line used when the officer crosses the station threshold.",
  ]),
  foreground("asset.night-shift.foreground.sedan", [
    "The sedan-front plate must create a believable near/far crossing around the vehicle without duplicating the whole car image.",
  ]),
  foreground("asset.night-shift.foreground.counter", [
    "The diner counter plate must let the officer move in front of the room while the server remains convincingly behind service furniture.",
  ]),

  requirement("asset.palette.night-shift.actor-lighting", "palette", {
    nativeSize: null,
    sizePolicy: "art-directed",
    indexed: false,
    alpha: "not-applicable",
    paletteRole: "128-entry actor lighting table",
    evidence: ["indexed-runtime"],
    rules: [
      "Entries 0–15 are neutral officer/actor colours; 32–47 station fluorescent; 64–79 roadside headlamp; 96–111 diner warm practical.",
      "Unused entries remain intentionally reserved rather than filled with arbitrary duplicate colours.",
      "Palette swaps must preserve material identity and facial readability; they are substitutions, not exposure filters.",
    ],
  }),
  scenePalette("asset.palette.night-shift.station", "Station"),
  scenePalette("asset.palette.night-shift.roadside", "Roadside"),
  scenePalette("asset.palette.night-shift.diner", "Diner"),

  requirement("asset.night-shift.font.system", "font", {
    nativeSize: { width: 96, height: 48 },
    sizePolicy: "exact",
    indexed: true,
    alpha: "binary",
    paletteRole: "UI text",
    evidence: ["period-vga", "ui-native", "binary-alpha"],
    rules: [
      "Atlas follows the 5×7 printable ASCII contract in 6×8 cells.",
      "Glyphs must be hand-cleaned at 1× with no browser-font rasterisation or antialiasing.",
    ],
  }),
  ...(["walk", "look", "use", "talk"] as const).map((verb) =>
    requirement(`asset.night-shift.ui.${verb}`, "ui-icon", {
      nativeSize: { width: 16, height: 16 },
      sizePolicy: "exact",
      indexed: true,
      alpha: "binary",
      paletteRole: "UI icon",
      evidence: ["period-vga", "ui-native", "binary-alpha"],
      rules: [
        `The ${verb.toUpperCase()} icon must read instantly at 16×16 without vector curves, soft antialiasing or modern glyph-library styling.`,
        "Use simple early-90s pictogram construction and reserve high contrast for the actionable silhouette.",
      ],
    }),
  ),

  audio("asset.audio.night-shift.footstep.vinyl", "audio-effect", ["Short dry institutional-tile step; no cinematic bass enhancement or long room reverb."]),
  audio("asset.audio.night-shift.footstep.wet-asphalt", "audio-effect", ["Small wet shoe/asphalt transient with restrained water detail; avoid exaggerated splash effects."]),
  audio("asset.audio.night-shift.footstep.diner-tile", "audio-effect", ["Hard diner tile step, slightly brighter than station vinyl but still quiet enough for repeated walking."]),
  audio("asset.audio.night-shift.radio-lift", "audio-effect", ["Plastic/radio charger lift with one compact mechanical contact; no modern UI beep unless physically motivated."]),
  audio("asset.audio.night-shift.keys-jingle", "audio-effect", ["Very short metal key movement with limited high-frequency tail so repeated interactions remain unobtrusive."]),
  audio("asset.audio.night-shift.door-latch", "audio-effect", ["Municipal door latch/handle, practical and dry; avoid horror-door weight or exaggerated slam."]),
  audio("asset.audio.night-shift.notebook", "audio-effect", ["Pencil/notebook mark with restrained paper texture and no Foley flourish."]),
  audio("asset.audio.night-shift.paper-touch", "audio-effect", ["Tiny receipt/paper contact suitable for a scene-scale clue, not a close-mic ASMR effect."]),
  audio("asset.audio.night-shift.station-room", "audio-ambience", ["Seamless fluorescent/institutional room tone with restrained HVAC/electrical bed and no conspicuous loop seam."]),
  audio("asset.audio.night-shift.roadside-rain", "audio-ambience", ["Seamless rain plus distant traffic, broad and understated; no thunder spectacle unless authored by scene state."]),
  audio("asset.audio.night-shift.diner-room", "audio-ambience", ["Low late-night room tone: refrigeration/HVAC, distant crockery texture and quiet occupation without a modern cinematic music bed."]),
] as const;

export const validateNightShiftProductionAssetPlan = (): readonly string[] => {
  const issues: string[] = [];
  const projectAssetIds = new Set(nightShiftRuntimeProject.assets.map((asset) => asset.id as string));
  const requirementIds = new Set<string>();

  for (const entry of nightShiftProductionAssets) {
    if (requirementIds.has(entry.assetId)) issues.push(`Duplicate production requirement '${entry.assetId}'.`);
    requirementIds.add(entry.assetId);
    if (!projectAssetIds.has(entry.assetId)) issues.push(`Production requirement '${entry.assetId}' is not in the runtime project.`);
    if (entry.rules.length === 0) issues.push(`Production requirement '${entry.assetId}' has no art/audio rules.`);
    if (entry.sizePolicy === "exact" && !entry.nativeSize) issues.push(`Exact-size asset '${entry.assetId}' has no native size.`);
  }

  for (const assetId of projectAssetIds) {
    if (!requirementIds.has(assetId)) issues.push(`Runtime project asset '${assetId}' has no production requirement.`);
  }

  return issues.sort((left, right) => left.localeCompare(right));
};

export const nightShiftIndexedProductionAssetIds = nightShiftProductionAssets
  .filter((asset) => asset.indexed)
  .map((asset) => asset.assetId);

export const nightShiftPeriodVgaProductionAssetIds = nightShiftProductionAssets
  .filter((asset) => asset.evidence.includes("period-vga"))
  .map((asset) => asset.assetId);
