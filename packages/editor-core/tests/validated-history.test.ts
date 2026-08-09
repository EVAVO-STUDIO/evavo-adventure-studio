import { parseSceneInstanceManifest } from "@evavo/adventure-scene-instances";
import { describe, expect, it } from "vitest";
import { createEditorHistory, EditorCommandError, executeEditorCommand } from "../src/public.js";

const manifest = parseSceneInstanceManifest({
  manifestVersion: 1,
  projectId: "project.editor-validation",
  objectDefinitions: [],
  scenes: [
    {
      sceneId: "scene.office",
      actorInstances: [],
      objectInstances: [],
      navigationPortals: [],
    },
  ],
});

const duplicateComposition = {
  sceneId: manifest.scenes[0]!.sceneId,
  actorInstances: [],
  objectInstances: [],
  navigationPortals: [],
};

describe("validated editor history", () => {
  it("rejects a second composition for the same scene", () => {
    const history = createEditorHistory(manifest);

    expect(() =>
      executeEditorCommand(history, {
        kind: "insert-scene-composition",
        index: 1,
        composition: duplicateComposition,
      }),
    ).toThrow(EditorCommandError);
  });

  it("preflights the evolving document inside command batches", () => {
    const empty = parseSceneInstanceManifest({
      manifestVersion: 1,
      projectId: "project.editor-validation",
      objectDefinitions: [],
      scenes: [],
    });
    const history = createEditorHistory(empty);

    expect(() =>
      executeEditorCommand(history, {
        kind: "batch",
        commands: [
          {
            kind: "insert-scene-composition",
            index: 0,
            composition: duplicateComposition,
          },
          {
            kind: "insert-scene-composition",
            index: 1,
            composition: duplicateComposition,
          },
        ],
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "duplicate-id",
        path: "composition.sceneId",
      }),
    );
  });
});
