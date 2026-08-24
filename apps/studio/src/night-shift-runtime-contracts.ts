import { audioMixManifestSchema } from "@evavo/adventure-audio";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { nightShiftCompleteProject } from "./night-shift-complete-proof.js";
import { nightShiftFrontEnd } from "./night-shift-front-end.js";
import { nightShiftLifecycle } from "./night-shift-lifecycle.js";
import { nightShiftDirectorPaletteMaps } from "./scene-director-palette-maps.js";

const audioAssets = [
  ["asset.audio.night-shift.footstep.vinyl", "audio/night-shift/footstep-vinyl.wav"],
  ["asset.audio.night-shift.footstep.wet-asphalt", "audio/night-shift/footstep-wet-asphalt.wav"],
  ["asset.audio.night-shift.footstep.diner-tile", "audio/night-shift/footstep-diner-tile.wav"],
  ["asset.audio.night-shift.radio-lift", "audio/night-shift/radio-lift.wav"],
  ["asset.audio.night-shift.keys-jingle", "audio/night-shift/keys-jingle.wav"],
  ["asset.audio.night-shift.door-latch", "audio/night-shift/door-latch.wav"],
  ["asset.audio.night-shift.notebook", "audio/night-shift/notebook.wav"],
  ["asset.audio.night-shift.paper-touch", "audio/night-shift/paper-touch.wav"],
] as const;

export const nightShiftRuntimeProject = parseAdventureProject({
  ...nightShiftCompleteProject,
  assets: [
    ...nightShiftCompleteProject.assets,
    {
      id: "asset.palette.night-shift.actor-lighting",
      path: "palettes/night-shift-actor-lighting.pal",
      kind: "palette",
    },
    ...audioAssets.map(([id, path]) => ({ id, path, kind: "audio" as const })),
  ],
});

const effectCue = (
  id: string,
  name: string,
  assetId: string,
  volume = 1,
  priority = 20,
) => ({
  id,
  name,
  assetId,
  bus: "effects" as const,
  volume,
  startOffsetMilliseconds: 0,
  fadeInTicks: 0,
  fadeOutTicks: 0,
  loop: null,
  polyphony: "overlap" as const,
  maxInstances: 4,
  priority,
  interruptGroup: null,
});

export const nightShiftAudioMix = audioMixManifestSchema.parse({
  manifestVersion: 1,
  projectId: nightShiftRuntimeProject.id,
  logicalTicksPerSecond: 60,
  buses: [
    { id: "master", volume: 1, muted: false, maxVoices: 32, stealPolicy: "lowest-priority" },
    { id: "music", volume: 0.72, muted: false, maxVoices: 2, stealPolicy: "oldest" },
    { id: "speech", volume: 1, muted: false, maxVoices: 4, stealPolicy: "oldest" },
    { id: "ambience", volume: 0.78, muted: false, maxVoices: 6, stealPolicy: "lowest-priority" },
    { id: "effects", volume: 0.92, muted: false, maxVoices: 16, stealPolicy: "lowest-priority" },
    { id: "interface", volume: 0.82, muted: false, maxVoices: 6, stealPolicy: "oldest" },
  ],
  ducking: [
    {
      id: "audio-ducking-rule.night-shift.speech-over-effects",
      sourceBus: "speech",
      targetBus: "effects",
      targetVolume: 0.7,
      attackTicks: 2,
      releaseTicks: 8,
    },
  ],
  cues: [
    effectCue(
      "audio-cue.night-shift.footstep.vinyl",
      "Vinyl tile footstep",
      "asset.audio.night-shift.footstep.vinyl",
      0.54,
      8,
    ),
    effectCue(
      "audio-cue.night-shift.footstep.wet-asphalt",
      "Wet asphalt footstep",
      "asset.audio.night-shift.footstep.wet-asphalt",
      0.58,
      8,
    ),
    effectCue(
      "audio-cue.night-shift.footstep.diner-tile",
      "Diner tile footstep",
      "asset.audio.night-shift.footstep.diner-tile",
      0.5,
      8,
    ),
    effectCue(
      "audio-cue.night-shift.radio-lift",
      "Radio lifted from charger",
      "asset.audio.night-shift.radio-lift",
      0.72,
      30,
    ),
    effectCue(
      "audio-cue.night-shift.keys-jingle",
      "Vehicle keys",
      "asset.audio.night-shift.keys-jingle",
      0.68,
      28,
    ),
    effectCue(
      "audio-cue.night-shift.door-latch",
      "Station door latch",
      "asset.audio.night-shift.door-latch",
      0.76,
      32,
    ),
    effectCue(
      "audio-cue.night-shift.notebook",
      "Notebook mark",
      "asset.audio.night-shift.notebook",
      0.56,
      22,
    ),
    effectCue(
      "audio-cue.night-shift.paper-touch",
      "Receipt paper touch",
      "asset.audio.night-shift.paper-touch",
      0.5,
      18,
    ),
  ],
  soundscapes: [],
  speechBindings: [],
});

export const nightShiftRuntimeContracts = {
  project: nightShiftRuntimeProject,
  audioMix: nightShiftAudioMix,
  paletteMaps: nightShiftDirectorPaletteMaps,
  frontEnd: nightShiftFrontEnd,
  lifecycle: nightShiftLifecycle,
} as const;
