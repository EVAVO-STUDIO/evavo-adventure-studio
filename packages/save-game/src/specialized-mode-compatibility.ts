import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "./schema.js";
import { addSaveGameIssue, type SaveGameCompatibilityIssue } from "./errors.js";

export const validateSavedSpecializedModes = (
  bundle: RuntimeBundle,
  save: SaveGame,
): readonly SaveGameCompatibilityIssue[] => {
  const state = save.specializedModes;
  if (!state) return [];
  const issues: SaveGameCompatibilityIssue[] = [];
  const manifest = bundle.specializedModes;
  if (!manifest) {
    addSaveGameIssue(
      issues,
      "specialized-mode-state-without-runtime-manifest",
      "specializedModes",
      "Save contains specialized-mode state but the runtime bundle has no specializedModes manifest.",
    );
    return issues;
  }
  const modesById = new Map(manifest.modes.map((mode) => [mode.id, mode] as const));
  for (let index = 0; index < state.firedModeIds.length; index += 1) {
    const modeId = state.firedModeIds[index];
    if (!modesById.has(modeId)) {
      addSaveGameIssue(
        issues,
        "specialized-mode-id-missing",
        `specializedModes.firedModeIds[${index}]`,
        `Saved specialized mode '${modeId}' no longer exists.`,
      );
    }
  }
  const active = state.active;
  if (!active) return issues;
  const mode = modesById.get(active.modeId);
  if (!mode) {
    addSaveGameIssue(
      issues,
      "specialized-mode-id-missing",
      "specializedModes.active.modeId",
      `Active specialized mode '${active.modeId}' no longer exists.`,
    );
    return issues;
  }
  if (mode.kind !== active.kind) {
    addSaveGameIssue(
      issues,
      "specialized-mode-kind-mismatch",
      "specializedModes.active.kind",
      `Saved specialized mode '${active.modeId}' kind '${active.kind}' no longer matches '${mode.kind}'.`,
    );
  }
  if (!mode.states.some((stateDefinition) => stateDefinition.id === active.stateId)) {
    addSaveGameIssue(
      issues,
      "specialized-mode-state-missing",
      "specializedModes.active.stateId",
      `Saved specialized mode '${active.modeId}' state '${active.stateId}' no longer exists.`,
    );
  }
  const returnScene = bundle.scenes.find((scene) => scene.id === active.returnSceneId);
  if (
    !returnScene ||
    !returnScene.entrances.some((entrance) => entrance.id === active.returnEntranceId)
  ) {
    addSaveGameIssue(
      issues,
      "specialized-mode-return-location-invalid",
      "specializedModes.active",
      `Saved specialized mode return location '${active.returnSceneId}/${active.returnEntranceId}' no longer exists.`,
    );
  }
  return issues;
};
