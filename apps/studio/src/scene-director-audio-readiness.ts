import type { AudioMixManifest } from "@evavo/adventure-audio";
import type { SceneStagingManifest } from "@evavo/adventure-scene-instances/staging";

export interface SceneDirectorAudioCueIssue {
  readonly sceneId: string;
  readonly source: "surface" | "choreography";
  readonly sourceId: string;
  readonly cueId: string;
  readonly message: string;
}

export interface SceneDirectorAudioCueUsage {
  readonly sceneId: string;
  readonly source: "surface" | "choreography";
  readonly sourceId: string;
  readonly cueId: string;
}

export const sceneDirectorStagingAudioCueUsages = (
  staging: SceneStagingManifest,
): readonly SceneDirectorAudioCueUsage[] => {
  const usages: SceneDirectorAudioCueUsage[] = [];
  for (const scene of staging.scenes) {
    for (const surface of scene.surfaceZones) {
      if (surface.footstepCueId) {
        usages.push({
          sceneId: scene.sceneId,
          source: "surface",
          sourceId: surface.id,
          cueId: surface.footstepCueId,
        });
      }
    }
    for (const choreography of scene.interactionChoreographies) {
      for (const beat of choreography.beats) {
        if (beat.kind !== "sound") continue;
        usages.push({
          sceneId: scene.sceneId,
          source: "choreography",
          sourceId: choreography.id,
          cueId: beat.cueId,
        });
      }
    }
  }
  return usages.sort(
    (left, right) =>
      left.sceneId.localeCompare(right.sceneId) ||
      left.source.localeCompare(right.source) ||
      left.sourceId.localeCompare(right.sourceId) ||
      left.cueId.localeCompare(right.cueId),
  );
};

export const validateSceneDirectorStagingAudioCues = (
  staging: SceneStagingManifest,
  audioMix: AudioMixManifest,
): readonly SceneDirectorAudioCueIssue[] => {
  const cueIds = new Set(audioMix.cues.map((cue) => cue.id as string));
  return sceneDirectorStagingAudioCueUsages(staging)
    .filter((usage) => !cueIds.has(usage.cueId))
    .map((usage) => ({
      ...usage,
      message: `${usage.source} '${usage.sourceId}' references missing audio cue '${usage.cueId}'.`,
    }));
};
