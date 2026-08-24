import { adventureProjectSchema, type AdventureProject } from "@evavo/adventure-project-schema";
import {
  sceneInstanceManifestSchema,
  type SceneInstanceManifest,
} from "@evavo/adventure-scene-instances";
import {
  sceneStagingManifestSchema,
  type SceneStagingManifest,
} from "@evavo/adventure-scene-instances/staging";
import type { SceneDirectorDocuments } from "./scene-director-documents.js";

const safeFileStem = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return normalized || "adventure";
};

const serializeJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export const sceneDirectorStagingFileName = (sampleId: string): string =>
  `${safeFileStem(sampleId)}.scene-staging.json`;

export const sceneDirectorProjectFileName = (sampleId: string): string =>
  `${safeFileStem(sampleId)}.project.json`;

export const sceneDirectorSceneInstancesFileName = (sampleId: string): string =>
  `${safeFileStem(sampleId)}.scene-instances.json`;

export const serializeSceneDirectorStaging = (
  manifest: SceneStagingManifest,
): string => serializeJson(sceneStagingManifestSchema.parse(manifest));

export const serializeSceneDirectorProject = (project: AdventureProject): string =>
  serializeJson(adventureProjectSchema.parse(project));

export const serializeSceneDirectorSceneInstances = (
  manifest: SceneInstanceManifest,
): string => serializeJson(sceneInstanceManifestSchema.parse(manifest));

export interface SceneDirectorExportFile {
  readonly fileName: string;
  readonly data: string;
}

export const serializeSceneDirectorDocuments = (
  documents: SceneDirectorDocuments,
  sampleId: string,
): readonly SceneDirectorExportFile[] => [
  {
    fileName: sceneDirectorProjectFileName(sampleId),
    data: serializeSceneDirectorProject(documents.project),
  },
  {
    fileName: sceneDirectorSceneInstancesFileName(sampleId),
    data: serializeSceneDirectorSceneInstances(documents.sceneInstances),
  },
  {
    fileName: sceneDirectorStagingFileName(sampleId),
    data: serializeSceneDirectorStaging(documents.staging),
  },
];

const downloadJson = (file: SceneDirectorExportFile): void => {
  const url = URL.createObjectURL(
    new Blob([file.data], { type: "application/json;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const downloadSceneDirectorStaging = (
  manifest: SceneStagingManifest,
  sampleId: string,
): void => {
  downloadJson({
    fileName: sceneDirectorStagingFileName(sampleId),
    data: serializeSceneDirectorStaging(manifest),
  });
};

export const downloadSceneDirectorDocuments = (
  documents: SceneDirectorDocuments,
  sampleId: string,
): void => {
  for (const file of serializeSceneDirectorDocuments(documents, sampleId)) {
    downloadJson(file);
  }
};
