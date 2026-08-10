import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  addSaveGameIssue,
  type SaveGameCompatibilityIssue,
} from "./errors.js";
import type { SaveGame } from "./schema.js";

export const validateSavedAudio = (
  bundle: RuntimeBundle,
  save: SaveGame,
): readonly SaveGameCompatibilityIssue[] => {
  const audio = save.audio;
  if (!audio) return [];

  const issues: SaveGameCompatibilityIssue[] = [];
  const manifest = bundle.audioMix;
  if (!manifest) {
    addSaveGameIssue(
      issues,
      "audio-state-without-runtime-mix",
      "audio",
      "Save game contains audio state but the runtime bundle has no audio mix.",
    );
    return issues;
  }

  if (audio.projectId !== bundle.projectId) {
    addSaveGameIssue(
      issues,
      "audio-project-mismatch",
      "audio.projectId",
      `Saved audio project '${audio.projectId}' does not match '${bundle.projectId}'.`,
    );
  }
  if (audio.sceneId !== save.world.story.currentSceneId) {
    addSaveGameIssue(
      issues,
      "audio-scene-mismatch",
      "audio.sceneId",
      `Saved audio scene '${audio.sceneId}' does not match story scene '${save.world.story.currentSceneId}'.`,
    );
  }
  if (audio.tick !== save.world.story.tick) {
    addSaveGameIssue(
      issues,
      "audio-tick-mismatch",
      "audio.tick",
      `Saved audio tick ${audio.tick} does not match story tick ${save.world.story.tick}.`,
    );
  }

  const configuredBuses = new Set(
    manifest.buses.map((bus) => bus.id as string),
  );
  for (const busId of Object.keys(audio.buses)) {
    if (!configuredBuses.has(busId)) {
      addSaveGameIssue(
        issues,
        "audio-bus-unconfigured",
        `audio.buses.${busId}`,
        `Saved audio bus '${busId}' is not configured by the runtime mix.`,
      );
    }
  }

  const assets = new Map(
    bundle.assets.map((asset) => [asset.assetId as string, asset] as const),
  );
  const cues = new Map(
    manifest.cues.map((cue) => [cue.id as string, cue] as const),
  );
  const soundscapes = new Map(
    manifest.soundscapes.map(
      (soundscape) => [soundscape.sceneId as string, soundscape] as const,
    ),
  );

  audio.voices.forEach((voice, voiceIndex) => {
    const path = `audio.voices[${voiceIndex}]`;
    const asset = assets.get(voice.assetId);
    if (!asset) {
      addSaveGameIssue(
        issues,
        "audio-voice-asset-missing",
        `${path}.assetId`,
        `Saved audio voice '${voice.id}' references missing asset '${voice.assetId}'.`,
      );
    } else if (asset.kind !== "audio") {
      addSaveGameIssue(
        issues,
        "audio-voice-asset-kind",
        `${path}.assetId`,
        `Saved audio voice '${voice.id}' references '${asset.kind}' asset '${asset.assetId}'.`,
      );
    }

    if (!configuredBuses.has(voice.bus)) {
      addSaveGameIssue(
        issues,
        "audio-bus-unconfigured",
        `${path}.bus`,
        `Saved audio voice '${voice.id}' uses unavailable bus '${voice.bus}'.`,
      );
    }

    if (voice.cueId) {
      const cue = cues.get(voice.cueId);
      if (!cue) {
        addSaveGameIssue(
          issues,
          "audio-voice-cue-missing",
          `${path}.cueId`,
          `Saved audio voice '${voice.id}' references missing cue '${voice.cueId}'.`,
        );
      } else if (
        cue.assetId !== voice.assetId ||
        cue.bus !== voice.bus ||
        cue.interruptGroup !== voice.interruptGroup
      ) {
        addSaveGameIssue(
          issues,
          "audio-voice-cue-mismatch",
          `${path}.cueId`,
          `Saved audio voice '${voice.id}' no longer matches cue '${voice.cueId}'.`,
        );
      }
    }

    if (voice.owner.kind === "scene-layer") {
      const soundscape = soundscapes.get(voice.owner.sceneId);
      const layer = soundscape?.layers.find(
        (candidate) => candidate.id === voice.owner.layerId,
      );
      if (!layer) {
        addSaveGameIssue(
          issues,
          "audio-scene-layer-missing",
          `${path}.owner.layerId`,
          `Saved audio voice '${voice.id}' references unavailable scene layer '${voice.owner.layerId}'.`,
        );
      } else if (voice.cueId !== layer.cueId) {
        addSaveGameIssue(
          issues,
          "audio-voice-cue-mismatch",
          `${path}.cueId`,
          `Saved scene-layer voice '${voice.id}' does not use layer cue '${layer.cueId}'.`,
        );
      }
    }
  });

  for (const cueId of Object.keys(audio.resumeOffsetsMilliseconds)) {
    if (!cues.has(cueId)) {
      addSaveGameIssue(
        issues,
        "audio-resume-cue-missing",
        `audio.resumeOffsetsMilliseconds.${cueId}`,
        `Saved resume offset references missing cue '${cueId}'.`,
      );
    }
  }

  return issues;
};
