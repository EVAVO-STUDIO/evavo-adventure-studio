import type { AdventureProject } from "@evavo/adventure-project-schema";
import type { SceneInstanceManifest } from "@evavo/adventure-scene-instances";
import type { SceneStagingManifest } from "@evavo/adventure-scene-instances/staging";
import { studioProject, studioSceneInstances } from "./fixture.js";
import {
  nightShiftDirectorInstances,
  nightShiftDirectorProject,
  nightShiftDirectorStaging,
} from "./night-shift-director-fixture.js";
import { studioSceneStaging } from "./scene-staging-fixture.js";

export interface SceneDirectorSample {
  readonly id: string;
  readonly label: string;
  readonly productionLanguage: string;
  readonly project: AdventureProject;
  readonly sceneInstances: SceneInstanceManifest;
  readonly staging: SceneStagingManifest;
}

export const sceneDirectorSamples: readonly SceneDirectorSample[] = [
  {
    id: "red-ledger",
    label: "The Red Ledger",
    productionLanguage: "Gothic investigation VGA",
    project: studioProject,
    sceneInstances: studioSceneInstances,
    staging: studioSceneStaging,
  },
  {
    id: "night-shift",
    label: "Night Shift",
    productionLanguage: "Early procedural icon VGA",
    project: nightShiftDirectorProject,
    sceneInstances: nightShiftDirectorInstances,
    staging: nightShiftDirectorStaging,
  },
] as const;
