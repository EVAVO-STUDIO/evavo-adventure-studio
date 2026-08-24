import { audioMixManifestSchema } from "@evavo/adventure-audio";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { nightShiftOfficerActor } from "./night-shift-animation-contract.js";
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
  ["asset.audio.night-shift.station-room", "audio/night-shift/station-room.wav"],
  ["asset.audio.night-shift.roadside-rain", "audio/night-shift/roadside-rain.wav"],
  ["asset.audio.night-shift.diner-room", "audio/night-shift/diner-room.wav"],
] as const;

const uiAssets = [
  ["asset.night-shift.font.system", "ui/night-shift/system-font.png", "image"],
  ["asset.night-shift.ui.walk", "ui/night-shift/icon-walk.png", "image"],
  ["asset.night-shift.ui.look", "ui/night-shift/icon-look.png", "image"],
  ["asset.night-shift.ui.use", "ui/night-shift/icon-use.png", "image"],
  ["asset.night-shift.ui.talk", "ui/night-shift/icon-talk.png", "image"],
] as const;

export const nightShiftRuntimeProject = parseAdventureProject({
  ...nightShiftCompleteProject,
  actors: nightShiftCompleteProject.actors.map((actor) =>
    actor.id === nightShiftOfficerActor.id ? nightShiftOfficerActor : actor,
  ),
  assets: [
    ...nightShiftCompleteProject.assets,
    {
      id: "asset.palette.night-shift.actor-lighting",
      path: "palettes/night-shift-actor-lighting.pal",
      kind: "palette",
    },
    ...audioAssets.map(([id, path]) => ({ id, path, kind: "audio" as const })),
    ...uiAssets.map(([id, path, kind]) => ({ id, path, kind })),
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

const ambienceCue = (
  id: string,
  name: string,
  assetId: string,
  endMilliseconds: number,
  volume: number,
) => ({
  id,
  name,
  assetId,
  bus: "ambience" as const,
  volume,
  startOffsetMilliseconds: 0,
  fadeInTicks: 8,
  fadeOutTicks: 12,
  loop: {
    startMilliseconds: 0,
    endMilliseconds,
    crossfadeMilliseconds: 120,
  },
  polyphony: "restart" as const,
  maxInstances: 1,
  priority: 4,
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
      id: "audio-ducking-rule.night-shift.speech-over-ambience",
      sourceBus: "speech",
      targetBus: "ambience",
      targetVolume: 0.58,
      attackTicks: 2,
      releaseTicks: 10,
    },
    {
      id: "audio-ducking-rule.night-shift.speech-over-effects",
      sourceBus: "speech",
      targetBus: "effects",
      targetVolume: 0.78,
      attackTicks: 2,
      releaseTicks: 8,
    },
  ],
  cues: [
    effectCue("audio-cue.night-shift.footstep.vinyl", "Vinyl tile footstep", "asset.audio.night-shift.footstep.vinyl", 0.54, 8),
    effectCue("audio-cue.night-shift.footstep.wet-asphalt", "Wet asphalt footstep", "asset.audio.night-shift.footstep.wet-asphalt", 0.58, 8),
    effectCue("audio-cue.night-shift.footstep.diner-tile", "Diner tile footstep", "asset.audio.night-shift.footstep.diner-tile", 0.5, 8),
    effectCue("audio-cue.night-shift.radio-lift", "Radio lifted from charger", "asset.audio.night-shift.radio-lift", 0.72, 30),
    effectCue("audio-cue.night-shift.keys-jingle", "Vehicle keys", "asset.audio.night-shift.keys-jingle", 0.68, 28),
    effectCue("audio-cue.night-shift.door-latch", "Station door latch", "asset.audio.night-shift.door-latch", 0.76, 32),
    effectCue("audio-cue.night-shift.notebook", "Notebook mark", "asset.audio.night-shift.notebook", 0.56, 22),
    effectCue("audio-cue.night-shift.paper-touch", "Receipt paper touch", "asset.audio.night-shift.paper-touch", 0.5, 18),
    ambienceCue("audio-cue.night-shift.station-room", "Station fluorescent room tone", "asset.audio.night-shift.station-room", 12000, 0.45),
    ambienceCue("audio-cue.night-shift.roadside-rain", "Wet roadside rain and distant traffic", "asset.audio.night-shift.roadside-rain", 16000, 0.62),
    ambienceCue("audio-cue.night-shift.diner-room", "Late diner room tone", "asset.audio.night-shift.diner-room", 14000, 0.48),
  ],
  soundscapes: [
    {
      sceneId: "scene.night-shift.station",
      layers: [{ id: "audio-scene-layer.night-shift.station.room", cueId: "audio-cue.night-shift.station-room", role: "room-tone", startDelayTicks: 0, fadeInTicks: 8, fadeOutTicks: 12, restartPolicy: "continue" }],
    },
    {
      sceneId: "scene.night-shift.roadside",
      layers: [{ id: "audio-scene-layer.night-shift.roadside.rain", cueId: "audio-cue.night-shift.roadside-rain", role: "ambience", startDelayTicks: 0, fadeInTicks: 8, fadeOutTicks: 14, restartPolicy: "continue" }],
    },
    {
      sceneId: "scene.night-shift.diner",
      layers: [{ id: "audio-scene-layer.night-shift.diner.room", cueId: "audio-cue.night-shift.diner-room", role: "room-tone", startDelayTicks: 0, fadeInTicks: 8, fadeOutTicks: 12, restartPolicy: "continue" }],
    },
  ],
  speechBindings: [],
});

export const nightShiftRuntimeContracts = {
  project: nightShiftRuntimeProject,
  audioMix: nightShiftAudioMix,
  paletteMaps: nightShiftDirectorPaletteMaps,
  frontEnd: nightShiftFrontEnd,
  lifecycle: nightShiftLifecycle,
} as const;
