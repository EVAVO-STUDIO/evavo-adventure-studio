import type { AdventureProject } from "@evavo/adventure-project-schema";
import type { SceneInstanceManifest } from "@evavo/adventure-scene-instances";
import type { PaletteMapManifest } from "@evavo/adventure-scene-instances/palette-maps";
import type { SceneStagingManifest } from "@evavo/adventure-scene-instances/staging";
import { studioProject, studioSceneInstances } from "./fixture.js";
import {
  nightShiftCompleteInstances,
  nightShiftCompleteProject,
  nightShiftCompleteStaging,
} from "./night-shift-complete-proof.js";
import {
  nightShiftDirectorPaletteMaps,
  redLedgerDirectorPaletteMaps,
} from "./scene-director-palette-maps.js";
import { studioSceneStaging } from "./scene-staging-fixture.js";

const withPaletteAsset = (
  project: AdventureProject,
  assetId: string,
  path: string,
): AdventureProject =>
  ({
    ...project,
    assets: [
      ...project.assets,
      {
        id: assetId,
        path,
        kind: "palette",
      },
    ],
  }) as AdventureProject;

export interface SceneDirectorSample {
  readonly id: string;
  readonly label: string;
  readonly productionLanguage: string;
  readonly project: AdventureProject;
  readonly sceneInstances: SceneInstanceManifest;
  readonly staging: SceneStagingManifest;
  readonly paletteMaps: PaletteMapManifest;
}

export const sceneDirectorSamples: readonly SceneDirectorSample[] = [
  {
    id: "red-ledger",
    label: "The Red Ledger",
    productionLanguage: "Gothic investigation VGA",
    project: withPaletteAsset(
      studioProject,
      "asset.palette.red-ledger.actor-lighting",
      "palettes/red-ledger-actor-lighting.pal",
    ),
    sceneInstances: studioSceneInstances,
    staging: studioSceneStaging,
    paletteMaps: redLedgerDirectorPaletteMaps,
  },
  {
    id: "night-shift",
    label: "Night Shift",
    productionLanguage: "Early procedural icon VGA",
    project: withPaletteAsset(
      nightShiftCompleteProject,
      "asset.palette.night-shift.actor-lighting",
      "palettes/night-shift-actor-lighting.pal",
    ),
    sceneInstances: nightShiftCompleteInstances,
    staging: nightShiftCompleteStaging,
    paletteMaps: nightShiftDirectorPaletteMaps,
  },
] as const;
