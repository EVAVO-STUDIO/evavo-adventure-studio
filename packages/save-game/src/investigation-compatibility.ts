import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "./schema.js";
import { addSaveGameIssue, type SaveGameCompatibilityIssue } from "./errors.js";

export const validateSavedInvestigation = (
  bundle: RuntimeBundle,
  save: SaveGame,
): readonly SaveGameCompatibilityIssue[] => {
  const issues: SaveGameCompatibilityIssue[] = [];
  const state = save.investigation;
  const manifest = bundle.investigation;

  // Investigation was introduced as an optional companion to saveVersion 1.
  // A save that predates the companion remains structurally loadable; an
  // investigation-aware controller may initialize fresh semantic state after
  // restore. When state is present, however, it must be strictly compatible.
  if (!state) return issues;

  if (!manifest) {
    addSaveGameIssue(
      issues,
      "investigation-state-without-runtime-manifest",
      "investigation",
      "Save contains investigation state but the runtime bundle has no investigation manifest.",
    );
    return issues;
  }

  const chapterIds = new Set(manifest.chapters.map((chapter) => chapter.id as string));
  const factIds = new Set(manifest.facts.map((fact) => fact.id as string));
  const topicIds = new Set(manifest.topics.map((topic) => topic.id as string));
  const sourceIds = new Set(manifest.researchSources.map((source) => source.id as string));
  const objectiveIds = new Set(
    manifest.chapters.flatMap((chapter) => chapter.objectives.map((objective) => objective.id as string)),
  );

  if (!chapterIds.has(state.chapterId)) {
    addSaveGameIssue(
      issues,
      "investigation-chapter-missing",
      "investigation.chapterId",
      `Saved investigation chapter '${state.chapterId}' does not exist in the runtime manifest.`,
    );
  }

  state.discoveredFactIds.forEach((factId, index) => {
    if (!factIds.has(factId)) {
      addSaveGameIssue(
        issues,
        "investigation-fact-missing",
        `investigation.discoveredFactIds[${index}]`,
        `Saved investigation fact '${factId}' does not exist in the runtime manifest.`,
      );
    }
  });

  state.availableTopicIds.forEach((topicId, index) => {
    if (!topicIds.has(topicId)) {
      addSaveGameIssue(
        issues,
        "investigation-topic-missing",
        `investigation.availableTopicIds[${index}]`,
        `Saved available topic '${topicId}' does not exist in the runtime manifest.`,
      );
    }
  });

  state.usedTopicIds.forEach((topicId, index) => {
    if (!topicIds.has(topicId)) {
      addSaveGameIssue(
        issues,
        "investigation-topic-missing",
        `investigation.usedTopicIds[${index}]`,
        `Saved used topic '${topicId}' does not exist in the runtime manifest.`,
      );
    }
  });

  state.usedSourceIds.forEach((sourceId, index) => {
    if (!sourceIds.has(sourceId)) {
      addSaveGameIssue(
        issues,
        "investigation-source-missing",
        `investigation.usedSourceIds[${index}]`,
        `Saved research source '${sourceId}' does not exist in the runtime manifest.`,
      );
    }
  });

  state.awardedObjectiveIds.forEach((objectiveId, index) => {
    if (!objectiveIds.has(objectiveId)) {
      addSaveGameIssue(
        issues,
        "investigation-objective-missing",
        `investigation.awardedObjectiveIds[${index}]`,
        `Saved investigation objective '${objectiveId}' does not exist in the runtime manifest.`,
      );
    }
  });

  for (const [factId, discoveries] of Object.entries(state.discovery)) {
    if (!factIds.has(factId)) {
      addSaveGameIssue(
        issues,
        "investigation-fact-missing",
        `investigation.discovery.${factId}`,
        `Saved discovery provenance references missing fact '${factId}'.`,
      );
    }
    discoveries.forEach((discovery, index) => {
      if (!chapterIds.has(discovery.chapterId)) {
        addSaveGameIssue(
          issues,
          "investigation-provenance-chapter-missing",
          `investigation.discovery.${factId}[${index}].chapterId`,
          `Saved investigation provenance chapter '${discovery.chapterId}' does not exist.`,
        );
      }
    });
  }

  return issues;
};
