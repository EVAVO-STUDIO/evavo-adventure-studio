import type { SceneInstanceManifest } from "@evavo/adventure-scene-instances";
import {
  applyEditorCommand,
  type EditorCommand,
  EditorCommandError,
  type EditorHistoryState,
  executeEditorCommand,
} from "./index.js";

const assertCommandValid = (
  manifest: SceneInstanceManifest,
  command: EditorCommand,
): SceneInstanceManifest => {
  if (command.kind === "batch") {
    let next = manifest;
    for (const child of command.commands) {
      next = assertCommandValid(next, child);
    }
    return next;
  }

  if (
    command.kind === "insert-scene-composition" &&
    manifest.scenes.some((composition) => composition.sceneId === command.composition.sceneId)
  ) {
    throw new EditorCommandError(
      "duplicate-id",
      "composition.sceneId",
      `Scene composition '${command.composition.sceneId}' already exists.`,
    );
  }

  return applyEditorCommand(manifest, command).manifest;
};

export const validateEditorCommand = (manifest: SceneInstanceManifest, command: EditorCommand): void => {
  assertCommandValid(manifest, command);
};

export const executeValidatedEditorCommand = (
  history: EditorHistoryState,
  command: EditorCommand,
): EditorHistoryState => {
  validateEditorCommand(history.document.manifest, command);
  return executeEditorCommand(history, command);
};
