import { validateBitmapFontManifest } from "@evavo/adventure-bitmap-font";
import { validateAudioMixManifest } from "@evavo/adventure-audio";
import { validateSceneInstanceManifest } from "@evavo/adventure-scene-instances";
import { validateSceneStagingManifest } from "@evavo/adventure-scene-instances/staging-validation";
import { validateUiSkinManifest } from "@evavo/adventure-ui-skin";
import { nightShiftCompleteInstances } from "./night-shift-complete-proof.js";
import { nightShiftProductionAssets, validateNightShiftProductionAssetPlan } from "./night-shift-production-assets.js";
import { nightShiftRuntimeContracts, nightShiftRuntimeProject } from "./night-shift-runtime-contracts.js";
import { nightShiftRuntimeStaging } from "./night-shift-runtime-staging.js";
import { validateSceneDirectorStagingAudioCues } from "./scene-director-audio-readiness.js";
import { nightShiftBitmapFonts, nightShiftUiSkins } from "./night-shift-ui-contracts.js";

export const nightShiftRuntimeSource = {
  project: nightShiftRuntimeProject,
  sceneInstances: nightShiftCompleteInstances,
  sceneStaging: nightShiftRuntimeStaging,
  paletteMaps: nightShiftRuntimeContracts.paletteMaps,
  bitmapFonts: nightShiftBitmapFonts,
  uiSkins: nightShiftUiSkins,
  audioMix: nightShiftRuntimeContracts.audioMix,
  frontEnd: nightShiftRuntimeContracts.frontEnd,
  lifecycle: nightShiftRuntimeContracts.lifecycle,
  productionAssets: nightShiftProductionAssets,
} as const;

const paletteMapSourceIssues = (): readonly string[] => {
  const issues: string[] = [];
  if (nightShiftRuntimeSource.paletteMaps.projectId !== nightShiftRuntimeSource.project.id) {
    issues.push("Palette-map project identity does not match the Night Shift runtime project.");
  }
  for (const map of nightShiftRuntimeSource.paletteMaps.maps) {
    const asset = nightShiftRuntimeSource.project.assets.find((candidate) => candidate.id === map.paletteAssetId);
    if (!asset) {
      issues.push(`Palette map '${map.id}' references missing asset '${map.paletteAssetId}'.`);
    } else if (asset.kind !== "palette") {
      issues.push(`Palette map '${map.id}' references '${asset.kind}' asset '${asset.id}', not a palette.`);
    }
  }
  return issues;
};

export const validateNightShiftRuntimeSource = (): readonly string[] => {
  const project = nightShiftRuntimeSource.project;
  const issues: string[] = [];

  issues.push(
    ...validateSceneInstanceManifest(
      {
        projectId: project.id,
        scenes: project.scenes,
        actors: project.actors,
        assets: project.assets,
        inventoryItems: project.inventoryItems,
        dialogues: project.dialogues,
        sequences: project.sequences,
      },
      nightShiftRuntimeSource.sceneInstances,
    ).map((issue) => `scene-instances:${issue.code}:${issue.message}`),
  );
  issues.push(
    ...validateSceneStagingManifest(
      {
        projectId: project.id,
        scenes: project.scenes,
        actors: project.actors,
        assets: project.assets,
        sequences: project.sequences,
        sceneInstances: nightShiftRuntimeSource.sceneInstances,
      },
      nightShiftRuntimeSource.sceneStaging,
    ).map((issue) => `scene-staging:${issue.code}:${issue.message}`),
  );
  issues.push(
    ...validateBitmapFontManifest(project, nightShiftRuntimeSource.bitmapFonts).map(
      (issue) => `bitmap-font:${issue.code}:${issue.message}`,
    ),
  );
  issues.push(
    ...validateUiSkinManifest(project, nightShiftRuntimeSource.bitmapFonts, nightShiftRuntimeSource.uiSkins).map(
      (issue) => `ui-skin:${issue.code}:${issue.message}`,
    ),
  );
  issues.push(
    ...validateAudioMixManifest(project, nightShiftRuntimeSource.audioMix).map(
      (issue) => `audio:${issue.code}:${issue.message}`,
    ),
  );
  issues.push(
    ...validateSceneDirectorStagingAudioCues(
      nightShiftRuntimeSource.sceneStaging,
      nightShiftRuntimeSource.audioMix,
    ).map((issue) => `staging-audio:${issue.cueId}:${issue.message}`),
  );
  issues.push(...paletteMapSourceIssues());
  issues.push(...validateNightShiftProductionAssetPlan().map((issue) => `production-assets:${issue}`));

  for (const [name, projectId] of [
    ["front-end", nightShiftRuntimeSource.frontEnd.projectId],
    ["lifecycle", nightShiftRuntimeSource.lifecycle.projectId],
    ["audio", nightShiftRuntimeSource.audioMix.projectId],
    ["bitmap-fonts", nightShiftRuntimeSource.bitmapFonts.projectId],
    ["ui-skins", nightShiftRuntimeSource.uiSkins.projectId],
    ["scene-instances", nightShiftRuntimeSource.sceneInstances.projectId],
    ["scene-staging", nightShiftRuntimeSource.sceneStaging.projectId],
    ["palette-maps", nightShiftRuntimeSource.paletteMaps.projectId],
  ] as const) {
    if (projectId !== project.id) issues.push(`${name} project '${projectId}' does not match '${project.id}'.`);
  }

  return issues.sort((left, right) => left.localeCompare(right));
};

export const nightShiftRuntimeSourceSummary = {
  projectId: nightShiftRuntimeSource.project.id,
  scenes: nightShiftRuntimeSource.project.scenes.length,
  actors: nightShiftRuntimeSource.project.actors.length,
  runtimeAssets: nightShiftRuntimeSource.project.assets.length,
  productionAssets: nightShiftRuntimeSource.productionAssets.length,
  paletteMaps: nightShiftRuntimeSource.paletteMaps.maps.length,
  bitmapFonts: nightShiftRuntimeSource.bitmapFonts.fonts.length,
  uiSkins: nightShiftRuntimeSource.uiSkins.skins.length,
  audioCues: nightShiftRuntimeSource.audioMix.cues.length,
  lifecycleOutcomes: nightShiftRuntimeSource.lifecycle.outcomes.length,
} as const;
