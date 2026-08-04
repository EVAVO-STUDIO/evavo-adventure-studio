import type {
  AdventureSplashBeat,
  AdventureSplashFamily,
  AdventureSplashProfile,
} from "./production-profile-types.js";

const beat = (
  id: string,
  role: AdventureSplashBeat["role"],
  startTick: number,
  durationTicks: number,
  composition: string,
): AdventureSplashBeat => ({
  id,
  role,
  startTick,
  durationTicks,
  composition,
  motion: "Discrete authored key poses at native resolution.",
  transition: "Palette-stepped or opaque transition without blur.",
  soundCue: `splash.${id}`,
});

const splash = (
  family: AdventureSplashFamily,
  originalMarkName: string,
  audioDirection: string,
  treatments: readonly [string, string, string, string],
): AdventureSplashProfile => ({
  family,
  originalMarkName,
  totalTicks: 128,
  skippableAfterTick: 48,
  audioDirection,
  completion: "open-main-menu",
  beats: [
    beat(`${family}.dark`, "dark-hold", 0, 24, treatments[0]),
    beat(`${family}.mark`, "mark-reveal", 24, 40, treatments[1]),
    beat(`${family}.title`, "publisher-line", 64, 40, treatments[2]),
    beat(`${family}.exit`, "transition", 104, 24, treatments[3]),
  ],
});

export const productionProfileSplashes = {
  lantern: splash(
    "lantern-reveal",
    "Lantern & Laurel",
    "Four woodwind and celesta notes with a quiet room tail.",
    [
      "Near-black field with one warm pixel cluster.",
      "An original lantern emblem reveals a laurel silhouette.",
      "Small bitmap lettering rests in generous negative space.",
      "The light closes to one point before the painted menu.",
    ],
  ),
  comic: splash(
    "comic-transmission",
    "Orbital Errand Works",
    "Dry FM percussion, a modem chirp and clipped brass fall.",
    [
      "Deep navy field with a parked scan line.",
      "A crooked satellite stamp assembles from colour plates.",
      "Maintenance lettering lands with one registration wobble.",
      "The scan line wipes into a comic control-room menu.",
    ],
  ),
  celestial: splash(
    "celestial-mark",
    "North Window Stories",
    "Low strings, glass harmonics and one continuing bell.",
    [
      "Black-blue field with an almost invisible leaded window.",
      "Moonlight crosses an original eye-shaped pane emblem.",
      "Small bitmap lettering settles below the glass mark.",
      "The silhouette remains while the menu room fades in.",
    ],
  ),
  pulp: splash(
    "pulp-panel",
    "Fathom Line Pictures",
    "Muted snare, bass clarinet and a narrow-band map-room chord.",
    [
      "Warm black field with a torn-paper edge.",
      "Three expedition panels form an original compass mark.",
      "The mark locks over a restrained contour map.",
      "A stepped shutter opens onto the illustrated menu.",
    ],
  ),
  kinetic: splash(
    "kinetic-monolith",
    "Vector Brass Company",
    "Low sampled impact, metallic scrape and clipped synth resolve.",
    [
      "Black field with a narrow copper line.",
      "Copper planes fold into an original raster monolith.",
      "Condensed lettering clamps into a mechanical frame.",
      "The monolith becomes the first dossier panel.",
    ],
  ),
  noir: splash(
    "noir-signal",
    "Dead Channel Works",
    "Filtered radio tone, distant rain and two electric-piano notes.",
    [
      "Near-black field with sparse rain and one signal light.",
      "A broken-frequency emblem resolves in a terminal frame.",
      "Monospaced lettering appears as a recovered label.",
      "The signal frame widens into the first scene.",
    ],
  ),
} as const;
