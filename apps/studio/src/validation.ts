import type { AdventureProject, Id } from "@evavo/adventure-project-schema";
import {
  type SceneInstanceIssue,
  type SceneInstanceManifest,
  validateSceneInstanceManifest,
} from "@evavo/adventure-scene-instances";

export type StudioValidationGroupKind = "scene" | "object-definition" | "document";

export interface StudioValidationGroup {
  readonly kind: StudioValidationGroupKind;
  readonly id: string;
  readonly label: string;
  readonly issues: readonly SceneInstanceIssue[];
}

export interface StudioValidationSummary {
  readonly valid: boolean;
  readonly issueCount: number;
  readonly groups: readonly StudioValidationGroup[];
  readonly issues: readonly SceneInstanceIssue[];
}

const issueIndex = (path: string, segment: string): number | null => {
  const match = new RegExp(`(?:^|\\.)${segment}\\[(\\d+)\\]`).exec(path);
  if (!match?.[1]) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isSafeInteger(value) ? value : null;
};

const groupForIssue = (
  project: AdventureProject,
  manifest: SceneInstanceManifest,
  issue: SceneInstanceIssue,
): Omit<StudioValidationGroup, "issues"> => {
  const sceneIndex = issueIndex(issue.path, "scenes");
  if (sceneIndex !== null) {
    const sceneId = manifest.scenes[sceneIndex]?.sceneId;
    const scene = project.scenes.find((candidate) => candidate.id === sceneId);
    return {
      kind: "scene",
      id: sceneId ?? `scene-index-${sceneIndex}`,
      label: scene?.name ?? sceneId ?? `Scene ${sceneIndex + 1}`,
    };
  }

  const definitionIndex = issueIndex(issue.path, "objectDefinitions");
  if (definitionIndex !== null) {
    const definition = manifest.objectDefinitions[definitionIndex];
    return {
      kind: "object-definition",
      id: definition?.id ?? `definition-index-${definitionIndex}`,
      label: definition?.name ?? `Object definition ${definitionIndex + 1}`,
    };
  }

  return {
    kind: "document",
    id: manifest.projectId,
    label: "Scene composition document",
  };
};

export const validateStudioManifest = (
  project: AdventureProject,
  manifest: SceneInstanceManifest,
): StudioValidationSummary => {
  const issues = [
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
      manifest,
    ),
  ].sort((left, right) => {
    const pathDifference = left.path.localeCompare(right.path);
    return pathDifference !== 0 ? pathDifference : left.code.localeCompare(right.code);
  });

  const groups = new Map<string, StudioValidationGroup>();
  for (const issue of issues) {
    const group = groupForIssue(project, manifest, issue);
    const key = `${group.kind}:${group.id}`;
    const existing = groups.get(key);
    groups.set(key, {
      ...group,
      issues: [...(existing?.issues ?? []), issue],
    });
  }

  return {
    valid: issues.length === 0,
    issueCount: issues.length,
    issues,
    groups: [...groups.values()].sort((left, right) => {
      const kindDifference = left.kind.localeCompare(right.kind);
      return kindDifference !== 0 ? kindDifference : left.label.localeCompare(right.label);
    }),
  };
};

export const sceneIdForValidationGroup = (group: StudioValidationGroup): Id<"scene"> | null =>
  group.kind === "scene" ? (group.id as Id<"scene">) : null;
