import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "./schema.js";
import { addSaveGameIssue, type SaveGameCompatibilityIssue } from "./errors.js";

export const validateSavedRoomScripts = (
  bundle: RuntimeBundle,
  save: SaveGame,
): readonly SaveGameCompatibilityIssue[] => {
  const state = save.roomScripts;
  if (!state) return [];
  const issues: SaveGameCompatibilityIssue[] = [];
  const manifest = bundle.roomScripts;
  if (!manifest) {
    addSaveGameIssue(
      issues,
      "room-script-state-without-runtime-manifest",
      "roomScripts",
      "Save contains room-script state but the runtime bundle has no room-script manifest.",
    );
    return issues;
  }
  const sceneIds = new Set(bundle.scenes.map((scene) => scene.id as string));
  const sequenceIds = new Set(bundle.sequences.map((sequence) => sequence.id as string));
  const scriptIds = new Set(manifest.scripts.map((script) => script.id));
  const entranceExists = (sceneId: string, entranceId: string): boolean =>
    bundle.scenes
      .find((scene) => scene.id === sceneId)
      ?.entrances.some((entrance) => entrance.id === entranceId) ?? false;

  if (!sceneIds.has(state.sceneId)) {
    addSaveGameIssue(issues, "room-script-scene-missing", "roomScripts.sceneId", `Saved room-script scene '${state.sceneId}' is missing.`);
  }
  state.visitedSceneIds.forEach((sceneId, index) => {
    if (!sceneIds.has(sceneId)) {
      addSaveGameIssue(issues, "room-script-scene-missing", `roomScripts.visitedSceneIds[${index}]`, `Visited room-script scene '${sceneId}' is missing.`);
    }
  });
  state.firedScriptIds.forEach((scriptId, index) => {
    if (!scriptIds.has(scriptId)) {
      addSaveGameIssue(issues, "room-script-id-missing", `roomScripts.firedScriptIds[${index}]`, `Saved room script '${scriptId}' is missing.`);
    }
  });
  if (state.activeCutaway) {
    const cutaway = state.activeCutaway;
    if (!scriptIds.has(cutaway.scriptId)) {
      addSaveGameIssue(issues, "room-script-id-missing", "roomScripts.activeCutaway.scriptId", `Active cutaway room script '${cutaway.scriptId}' is missing.`);
    }
    if (!sequenceIds.has(cutaway.sequenceId)) {
      addSaveGameIssue(issues, "room-script-sequence-missing", "roomScripts.activeCutaway.sequenceId", `Active cutaway sequence '${cutaway.sequenceId}' is missing.`);
    }
    if (!sceneIds.has(cutaway.returnSceneId) || !entranceExists(cutaway.returnSceneId, cutaway.returnEntranceId)) {
      addSaveGameIssue(
        issues,
        "room-script-return-location-invalid",
        "roomScripts.activeCutaway",
        `Saved cutaway return '${cutaway.returnSceneId}/${cutaway.returnEntranceId}' is invalid.`,
      );
    }
  }
  return issues;
};
