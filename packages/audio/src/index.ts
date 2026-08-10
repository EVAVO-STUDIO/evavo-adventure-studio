import {
  type AdventureProject,
  conditionSchema,
  type Id,
  idSchema,
} from "@evavo/adventure-project-schema";
import { z } from "zod";

export const audioContentBusIds = [
  "music",
  "speech",
  "ambience",
  "effects",
  "interface",
] as const;
export const audioBusIds = ["master", ...audioContentBusIds] as const;

export const audioContentBusIdSchema = z.enum(audioContentBusIds);
export type AudioContentBusId = z.infer<typeof audioContentBusIdSchema>;

export const audioBusIdSchema = z.enum(audioBusIds);
export type AudioBusId = z.infer<typeof audioBusIdSchema>;

export const audioBusMixSchema = z
  .object({
    id: audioBusIdSchema,
    volume: z.number().min(0).max(1),
    muted: z.boolean().default(false),
    maxVoices: z.number().int().min(1).max(128),
    stealPolicy: z.enum(["oldest", "quietest", "lowest-priority"]).default("lowest-priority"),
  })
  .strict();
export type AudioBusMix = z.infer<typeof audioBusMixSchema>;

export const audioDuckingRuleSchema = z
  .object({
    id: idSchema("audio-ducking-rule"),
    sourceBus: audioContentBusIdSchema,
    targetBus: audioContentBusIdSchema,
    targetVolume: z.number().min(0).max(1),
    attackTicks: z.number().int().nonnegative(),
    releaseTicks: z.number().int().nonnegative(),
  })
  .strict();
export type AudioDuckingRule = z.infer<typeof audioDuckingRuleSchema>;

export const audioLoopSchema = z
  .object({
    startMilliseconds: z.number().int().nonnegative(),
    endMilliseconds: z.number().int().positive(),
    crossfadeMilliseconds: z.number().int().nonnegative().default(0),
  })
  .strict();
export type AudioLoop = z.infer<typeof audioLoopSchema>;

export const audioCueSchema = z
  .object({
    id: idSchema("audio-cue"),
    name: z.string().min(1),
    assetId: idSchema("asset"),
    bus: audioContentBusIdSchema,
    volume: z.number().min(0).max(1).default(1),
    startOffsetMilliseconds: z.number().int().nonnegative().default(0),
    fadeInTicks: z.number().int().nonnegative().default(0),
    fadeOutTicks: z.number().int().nonnegative().default(0),
    loop: audioLoopSchema.nullable().default(null),
    polyphony: z.enum(["overlap", "restart", "ignore"]).default("overlap"),
    maxInstances: z.number().int().min(1).max(32).default(8),
    priority: z.number().int().min(-1000).max(1000).default(0),
    interruptGroup: z.string().min(1).nullable().default(null),
  })
  .strict();
export type AudioCue = z.infer<typeof audioCueSchema>;

export const audioSceneLayerSchema = z
  .object({
    id: idSchema("audio-scene-layer"),
    cueId: idSchema("audio-cue"),
    role: z.enum(["music", "ambience", "room-tone"]),
    when: conditionSchema.optional(),
    startDelayTicks: z.number().int().nonnegative().default(0),
    fadeInTicks: z.number().int().nonnegative().default(0),
    fadeOutTicks: z.number().int().nonnegative().default(0),
    restartPolicy: z.enum(["restart", "resume", "continue"]).default("continue"),
  })
  .strict();
export type AudioSceneLayer = z.infer<typeof audioSceneLayerSchema>;

export const audioSceneSoundscapeSchema = z
  .object({
    sceneId: idSchema("scene"),
    layers: z.array(audioSceneLayerSchema),
  })
  .strict();
export type AudioSceneSoundscape = z.infer<typeof audioSceneSoundscapeSchema>;

export const audioSpeechMarkerSchema = z
  .object({
    atTick: z.number().int().nonnegative(),
    name: z.string().min(1),
  })
  .strict();
export type AudioSpeechMarker = z.infer<typeof audioSpeechMarkerSchema>;

export const audioSpeechBindingSchema = z
  .object({
    id: idSchema("audio-speech-binding"),
    dialogueLineId: idSchema("dialogue-line"),
    cueId: idSchema("audio-cue"),
    leadInTicks: z.number().int().nonnegative().default(0),
    tailTicks: z.number().int().nonnegative().default(0),
    markers: z.array(audioSpeechMarkerSchema).default([]),
  })
  .strict();
export type AudioSpeechBinding = z.infer<typeof audioSpeechBindingSchema>;

export const audioMixManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    logicalTicksPerSecond: z.number().int().positive(),
    buses: z.array(audioBusMixSchema).min(1),
    ducking: z.array(audioDuckingRuleSchema).default([]),
    cues: z.array(audioCueSchema).default([]),
    soundscapes: z.array(audioSceneSoundscapeSchema).default([]),
    speechBindings: z.array(audioSpeechBindingSchema).default([]),
  })
  .strict();
export type AudioMixManifest = z.infer<typeof audioMixManifestSchema>;

export const parseAudioMixManifest = (input: unknown): AudioMixManifest =>
  audioMixManifestSchema.parse(input);

export type AudioMixIssueCode =
  | "project-mismatch"
  | "tick-rate-mismatch"
  | "duplicate-bus"
  | "missing-bus"
  | "duplicate-cue"
  | "unknown-cue-asset"
  | "cue-asset-kind"
  | "unknown-cue-bus"
  | "invalid-loop-range"
  | "invalid-loop-crossfade"
  | "speech-cue-loop"
  | "polyphony-limit-mismatch"
  | "duplicate-ducking-rule"
  | "unknown-ducking-bus"
  | "self-ducking-rule"
  | "duplicate-soundscape"
  | "unknown-soundscape-scene"
  | "duplicate-scene-layer"
  | "unknown-layer-cue"
  | "layer-bus-mismatch"
  | "duplicate-speech-binding"
  | "duplicate-speech-line-binding"
  | "unknown-dialogue-line"
  | "unknown-speech-cue"
  | "speech-binding-bus-mismatch"
  | "speech-marker-order"
  | "sequence-audio-asset-missing"
  | "sequence-audio-asset-kind"
  | "sequence-audio-bus-unconfigured";

export interface AudioMixIssue {
  readonly severity: "error" | "warning";
  readonly code: AudioMixIssueCode;
  readonly path: string;
  readonly message: string;
}

const addIssue = (
  issues: AudioMixIssue[],
  severity: AudioMixIssue["severity"],
  code: AudioMixIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity, code, path, message });
};

const requiredBusIds = new Set<string>(audioBusIds);

const cueById = (
  manifest: AudioMixManifest,
): ReadonlyMap<string, AudioCue> =>
  new Map(manifest.cues.map((cue) => [cue.id as string, cue] as const));

const validateBuses = (
  manifest: AudioMixManifest,
  issues: AudioMixIssue[],
): ReadonlySet<string> => {
  const buses = new Set<string>();
  manifest.buses.forEach((bus, index) => {
    if (buses.has(bus.id)) {
      addIssue(
        issues,
        "error",
        "duplicate-bus",
        `buses[${index}].id`,
        `Audio bus '${bus.id}' is duplicated.`,
      );
    }
    buses.add(bus.id);
  });
  for (const busId of requiredBusIds) {
    if (!buses.has(busId)) {
      addIssue(
        issues,
        "error",
        "missing-bus",
        "buses",
        `Audio mix requires the '${busId}' bus.`,
      );
    }
  }
  return buses;
};

const validateCues = (
  project: Pick<AdventureProject, "assets">,
  manifest: AudioMixManifest,
  buses: ReadonlySet<string>,
  issues: AudioMixIssue[],
): void => {
  const assets = new Map(
    project.assets.map((asset) => [asset.id as string, asset] as const),
  );
  const cueIds = new Set<string>();
  manifest.cues.forEach((cue, index) => {
    const path = `cues[${index}]`;
    if (cueIds.has(cue.id)) {
      addIssue(
        issues,
        "error",
        "duplicate-cue",
        `${path}.id`,
        `Audio cue '${cue.id}' is duplicated.`,
      );
    }
    cueIds.add(cue.id);

    const asset = assets.get(cue.assetId);
    if (!asset) {
      addIssue(
        issues,
        "error",
        "unknown-cue-asset",
        `${path}.assetId`,
        `Audio cue '${cue.id}' references missing asset '${cue.assetId}'.`,
      );
    } else if (asset.kind !== "audio") {
      addIssue(
        issues,
        "error",
        "cue-asset-kind",
        `${path}.assetId`,
        `Audio cue '${cue.id}' references '${asset.kind}' asset '${asset.id}'.`,
      );
    }

    if (!buses.has(cue.bus)) {
      addIssue(
        issues,
        "error",
        "unknown-cue-bus",
        `${path}.bus`,
        `Audio cue '${cue.id}' references unavailable bus '${cue.bus}'.`,
      );
    }

    if (cue.loop) {
      const loopLength = cue.loop.endMilliseconds - cue.loop.startMilliseconds;
      if (loopLength <= 0) {
        addIssue(
          issues,
          "error",
          "invalid-loop-range",
          `${path}.loop`,
          `Audio cue '${cue.id}' loop end must be after its start.`,
        );
      }
      if (cue.loop.crossfadeMilliseconds * 2 > loopLength) {
        addIssue(
          issues,
          "error",
          "invalid-loop-crossfade",
          `${path}.loop.crossfadeMilliseconds`,
          `Audio cue '${cue.id}' crossfade cannot consume more than its loop range.`,
        );
      }
      if (cue.bus === "speech") {
        addIssue(
          issues,
          "error",
          "speech-cue-loop",
          `${path}.loop`,
          `Speech cue '${cue.id}' cannot loop.`,
        );
      }
    }

    if (cue.polyphony !== "overlap" && cue.maxInstances !== 1) {
      addIssue(
        issues,
        "warning",
        "polyphony-limit-mismatch",
        `${path}.maxInstances`,
        `Audio cue '${cue.id}' uses '${cue.polyphony}' polyphony and normally has one instance.`,
      );
    }
  });
};

const validateDucking = (
  manifest: AudioMixManifest,
  buses: ReadonlySet<string>,
  issues: AudioMixIssue[],
): void => {
  const ids = new Set<string>();
  manifest.ducking.forEach((rule, index) => {
    const path = `ducking[${index}]`;
    if (ids.has(rule.id)) {
      addIssue(
        issues,
        "error",
        "duplicate-ducking-rule",
        `${path}.id`,
        `Audio ducking rule '${rule.id}' is duplicated.`,
      );
    }
    ids.add(rule.id);
    if (!buses.has(rule.sourceBus)) {
      addIssue(
        issues,
        "error",
        "unknown-ducking-bus",
        `${path}.sourceBus`,
        `Ducking source bus '${rule.sourceBus}' is unavailable.`,
      );
    }
    if (!buses.has(rule.targetBus)) {
      addIssue(
        issues,
        "error",
        "unknown-ducking-bus",
        `${path}.targetBus`,
        `Ducking target bus '${rule.targetBus}' is unavailable.`,
      );
    }
    if (rule.sourceBus === rule.targetBus) {
      addIssue(
        issues,
        "error",
        "self-ducking-rule",
        path,
        `Audio bus '${rule.sourceBus}' cannot duck itself.`,
      );
    }
  });
};

const validateSoundscapes = (
  project: Pick<AdventureProject, "scenes">,
  manifest: AudioMixManifest,
  issues: AudioMixIssue[],
): void => {
  const scenes = new Set(project.scenes.map((scene) => scene.id as string));
  const cues = cueById(manifest);
  const sceneIds = new Set<string>();
  manifest.soundscapes.forEach((soundscape, soundscapeIndex) => {
    const path = `soundscapes[${soundscapeIndex}]`;
    if (sceneIds.has(soundscape.sceneId)) {
      addIssue(
        issues,
        "error",
        "duplicate-soundscape",
        `${path}.sceneId`,
        `Scene '${soundscape.sceneId}' has more than one soundscape.`,
      );
    }
    sceneIds.add(soundscape.sceneId);
    if (!scenes.has(soundscape.sceneId)) {
      addIssue(
        issues,
        "error",
        "unknown-soundscape-scene",
        `${path}.sceneId`,
        `Soundscape references missing scene '${soundscape.sceneId}'.`,
      );
    }

    const layerIds = new Set<string>();
    soundscape.layers.forEach((layer, layerIndex) => {
      const layerPath = `${path}.layers[${layerIndex}]`;
      if (layerIds.has(layer.id)) {
        addIssue(
          issues,
          "error",
          "duplicate-scene-layer",
          `${layerPath}.id`,
          `Soundscape layer '${layer.id}' is duplicated.`,
        );
      }
      layerIds.add(layer.id);
      const cue = cues.get(layer.cueId);
      if (!cue) {
        addIssue(
          issues,
          "error",
          "unknown-layer-cue",
          `${layerPath}.cueId`,
          `Soundscape layer '${layer.id}' references missing cue '${layer.cueId}'.`,
        );
        return;
      }
      const expectedBus = layer.role === "music" ? "music" : "ambience";
      if (cue.bus !== expectedBus) {
        addIssue(
          issues,
          "error",
          "layer-bus-mismatch",
          `${layerPath}.cueId`,
          `Soundscape layer '${layer.id}' requires a '${expectedBus}' cue, not '${cue.bus}'.`,
        );
      }
    });
  });
};

const validateSpeechBindings = (
  project: Pick<AdventureProject, "dialogues">,
  manifest: AudioMixManifest,
  issues: AudioMixIssue[],
): void => {
  const lines = new Set(
    project.dialogues.flatMap((dialogue) =>
      dialogue.nodes.flatMap((node) =>
        node.lines.map((line) => line.id as string),
      ),
    ),
  );
  const cues = cueById(manifest);
  const bindingIds = new Set<string>();
  const boundLines = new Set<string>();
  manifest.speechBindings.forEach((binding, bindingIndex) => {
    const path = `speechBindings[${bindingIndex}]`;
    if (bindingIds.has(binding.id)) {
      addIssue(
        issues,
        "error",
        "duplicate-speech-binding",
        `${path}.id`,
        `Speech binding '${binding.id}' is duplicated.`,
      );
    }
    bindingIds.add(binding.id);
    if (boundLines.has(binding.dialogueLineId)) {
      addIssue(
        issues,
        "error",
        "duplicate-speech-line-binding",
        `${path}.dialogueLineId`,
        `Dialogue line '${binding.dialogueLineId}' has more than one speech binding.`,
      );
    }
    boundLines.add(binding.dialogueLineId);
    if (!lines.has(binding.dialogueLineId)) {
      addIssue(
        issues,
        "error",
        "unknown-dialogue-line",
        `${path}.dialogueLineId`,
        `Speech binding references missing dialogue line '${binding.dialogueLineId}'.`,
      );
    }
    const cue = cues.get(binding.cueId);
    if (!cue) {
      addIssue(
        issues,
        "error",
        "unknown-speech-cue",
        `${path}.cueId`,
        `Speech binding references missing cue '${binding.cueId}'.`,
      );
    } else if (cue.bus !== "speech") {
      addIssue(
        issues,
        "error",
        "speech-binding-bus-mismatch",
        `${path}.cueId`,
        `Speech binding cue '${cue.id}' uses '${cue.bus}', not the speech bus.`,
      );
    }

    let previousTick = -1;
    binding.markers.forEach((marker, markerIndex) => {
      if (marker.atTick < previousTick) {
        addIssue(
          issues,
          "error",
          "speech-marker-order",
          `${path}.markers[${markerIndex}].atTick`,
          `Speech markers for '${binding.id}' must be ordered by tick.`,
        );
      }
      previousTick = marker.atTick;
    });
  });
};

const validateSequenceAudio = (
  project: Pick<AdventureProject, "assets" | "sequences">,
  buses: ReadonlySet<string>,
  issues: AudioMixIssue[],
): void => {
  const assets = new Map(
    project.assets.map((asset) => [asset.id as string, asset] as const),
  );
  project.sequences.forEach((sequence, sequenceIndex) => {
    sequence.tracks.forEach((track, trackIndex) => {
      track.cues.forEach((cue, cueIndex) => {
        const path = `project.sequences[${sequenceIndex}].tracks[${trackIndex}].cues[${cueIndex}]`;
        if (cue.kind === "sound") {
          const asset = assets.get(cue.assetId);
          if (!asset) {
            addIssue(
              issues,
              "error",
              "sequence-audio-asset-missing",
              `${path}.assetId`,
              `Sequence sound references missing asset '${cue.assetId}'.`,
            );
          } else if (asset.kind !== "audio") {
            addIssue(
              issues,
              "error",
              "sequence-audio-asset-kind",
              `${path}.assetId`,
              `Sequence sound references '${asset.kind}' asset '${asset.id}'.`,
            );
          }
          if (!buses.has(cue.bus)) {
            addIssue(
              issues,
              "error",
              "sequence-audio-bus-unconfigured",
              `${path}.bus`,
              `Sequence sound uses unavailable audio bus '${cue.bus}'.`,
            );
          }
        } else if (cue.kind === "stop-audio" && !buses.has(cue.bus)) {
          addIssue(
            issues,
            "error",
            "sequence-audio-bus-unconfigured",
            `${path}.bus`,
            `Sequence audio stop uses unavailable bus '${cue.bus}'.`,
          );
        }
      });
    });
  });
};

export const validateAudioMixManifest = (
  project: Pick<
    AdventureProject,
    "id" | "presentation" | "assets" | "scenes" | "dialogues" | "sequences"
  >,
  manifest: AudioMixManifest,
): readonly AudioMixIssue[] => {
  const issues: AudioMixIssue[] = [];
  if (manifest.projectId !== project.id) {
    addIssue(
      issues,
      "error",
      "project-mismatch",
      "projectId",
      `Audio project '${manifest.projectId}' does not match '${project.id}'.`,
    );
  }
  if (
    manifest.logicalTicksPerSecond !==
    project.presentation.logicalTicksPerSecond
  ) {
    addIssue(
      issues,
      "error",
      "tick-rate-mismatch",
      "logicalTicksPerSecond",
      `Audio tick rate ${manifest.logicalTicksPerSecond} does not match project rate ${project.presentation.logicalTicksPerSecond}.`,
    );
  }

  const buses = validateBuses(manifest, issues);
  validateCues(project, manifest, buses, issues);
  validateDucking(manifest, buses, issues);
  validateSoundscapes(project, manifest, issues);
  validateSpeechBindings(project, manifest, issues);
  validateSequenceAudio(project, buses, issues);
  return issues;
};

const defaultBus = (
  id: AudioBusId,
  volume: number,
  maxVoices: number,
): AudioBusMix => ({
  id,
  volume,
  muted: false,
  maxVoices,
  stealPolicy: "lowest-priority",
});

export const createDefaultAudioMixManifest = (
  project: Pick<AdventureProject, "id" | "presentation">,
): AudioMixManifest =>
  audioMixManifestSchema.parse({
    manifestVersion: 1,
    projectId: project.id,
    logicalTicksPerSecond: project.presentation.logicalTicksPerSecond,
    buses: [
      defaultBus("master", 1, 128),
      defaultBus("music", 0.78, 4),
      defaultBus("speech", 1, 4),
      defaultBus("ambience", 0.72, 16),
      defaultBus("effects", 0.9, 32),
      defaultBus("interface", 0.82, 12),
    ],
    ducking: [
      {
        id: "audio-ducking-rule.speech-over-music",
        sourceBus: "speech",
        targetBus: "music",
        targetVolume: 0.46,
        attackTicks: 6,
        releaseTicks: 18,
      },
      {
        id: "audio-ducking-rule.speech-over-ambience",
        sourceBus: "speech",
        targetBus: "ambience",
        targetVolume: 0.68,
        attackTicks: 6,
        releaseTicks: 18,
      },
    ],
    cues: [],
    soundscapes: [],
    speechBindings: [],
  });

export const audioCueId = (value: string): Id<"audio-cue"> =>
  value as Id<"audio-cue">;
