import { describe, expect, it } from "vitest";
import { parseSceneInstanceManifest } from "@evavo/adventure-scene-instances";
import {
  parseEditorCommand,
  parseEditorOperationLog,
} from "../src/command-schema.js";
import {
  EditorOperationLogError,
  replayEditorOperationLog,
} from "../src/operation-log.js";

const manifest = parseSceneInstanceManifest({
  manifestVersion: 1,
  projectId: "project.operation-log",
  objectDefinitions: [],
  scenes: [
    {
      sceneId: "scene.office",
      actorInstances: [
        {
          id: "actor-instance.office.detective",
          actorId: "actor.detective",
          position: { x: 20, y: 160 },
          facing: "east",
          animationState: "idle",
        },
      ],
      objectInstances: [],
      navigationPortals: [],
    },
  ],
});

describe("editor command schemas", () => {
  it("parses complete serializable commands", () => {
    expect(
      parseEditorCommand({
        kind: "replace-actor-instance",
        sceneId: "scene.office",
        instanceId: "actor-instance.office.detective",
        instance: {
          ...manifest.scenes[0]!.actorInstances[0],
          position: { x: 90, y: 170 },
        },
      }),
    ).toMatchObject({
      kind: "replace-actor-instance",
      sceneId: "scene.office",
    });
  });

  it("rejects malformed recursive batches", () => {
    expect(() =>
      parseEditorCommand({ kind: "batch", commands: [] }),
    ).toThrow();
  });
});

describe("editor operation logs", () => {
  it("replays operations in deterministic order", () => {
    const actor = manifest.scenes[0]!.actorInstances[0]!;
    const log = parseEditorOperationLog({
      logVersion: 1,
      projectId: manifest.projectId,
      baseRevision: 0,
      operations: [
        {
          operationId: "operation.move-detective",
          command: {
            kind: "replace-actor-instance",
            sceneId: "scene.office",
            instanceId: actor.id,
            instance: { ...actor, position: { x: 120, y: 172 } },
          },
        },
        {
          operationId: "operation.fix-detective",
          command: {
            kind: "replace-actor-instance",
            sceneId: "scene.office",
            instanceId: actor.id,
            instance: { ...actor, position: { x: 118, y: 170 } },
          },
        },
      ],
    });

    const replayed = replayEditorOperationLog(manifest, log);

    expect(replayed.appliedOperationIds).toEqual([
      "operation.move-detective",
      "operation.fix-detective",
    ]);
    expect(
      replayed.history.document.manifest.scenes[0]?.actorInstances[0]?.position,
    ).toEqual({ x: 118, y: 170 });
    expect(replayed.history.undoStack).toHaveLength(2);
  });

  it("rejects duplicate operation IDs and revision mismatches", () => {
    const actor = manifest.scenes[0]!.actorInstances[0]!;
    const command = {
      kind: "replace-actor-instance" as const,
      sceneId: manifest.scenes[0]!.sceneId,
      instanceId: actor.id,
      instance: { ...actor, position: { x: 80, y: 165 } },
    };
    const duplicated = parseEditorOperationLog({
      logVersion: 1,
      projectId: manifest.projectId,
      baseRevision: 0,
      operations: [
        { operationId: "operation.same", command },
        { operationId: "operation.same", command },
      ],
    });

    expect(() => replayEditorOperationLog(manifest, duplicated)).toThrowError(
      expect.objectContaining<Partial<EditorOperationLogError>>({
        code: "duplicate-operation",
      }),
    );

    expect(() =>
      replayEditorOperationLog(
        manifest,
        { ...duplicated, operations: duplicated.operations.slice(0, 1) },
        { initialRevision: 4 },
      ),
    ).toThrowError(
      expect.objectContaining<Partial<EditorOperationLogError>>({
        code: "revision-mismatch",
      }),
    );
  });
});
