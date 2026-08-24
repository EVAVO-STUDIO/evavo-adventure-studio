import type { SceneStagingManifest } from "@evavo/adventure-scene-instances/staging";
import { sceneStagingManifestSchema } from "@evavo/adventure-scene-instances/staging";

const safeFileStem = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return normalized || "adventure";
};

export const sceneDirectorStagingFileName = (sampleId: string): string =>
  `${safeFileStem(sampleId)}.scene-staging.json`;

export const serializeSceneDirectorStaging = (
  manifest: SceneStagingManifest,
): string => `${JSON.stringify(sceneStagingManifestSchema.parse(manifest), null, 2)}\n`;

export const downloadSceneDirectorStaging = (
  manifest: SceneStagingManifest,
  sampleId: string,
): void => {
  const data = serializeSceneDirectorStaging(manifest);
  const url = URL.createObjectURL(
    new Blob([data], { type: "application/json;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = sceneDirectorStagingFileName(sampleId);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
