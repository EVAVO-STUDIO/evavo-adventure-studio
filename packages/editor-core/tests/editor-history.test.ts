import { describe, expect, it } from "vitest";
import type { Id } from "@evavo/adventure-project-schema";
import { parseSceneInstanceManifest } from "@evavo/adventure-scene-instances";
import {
  EditorCommandError,
  applyEditorCommand,
  canonicalEditorJson,
  createEditorHistory,
  executeEditorCommand,
  isEditorDocumentDirty,
  markEditorHistorySaved,
  redoEditorCommand,
  undoEditorCommand,
  type EditorCommand,
} from "../src/index.js";

const id = <T extends string>(value: string) => value as Id<T>;

const manifest = parseSceneInstanceManifest({
  manifestVersion: 1,
  projectId: "project.editor",
  objectDefinitions: [
    {
      id: "object-definition.door",
      name: "Door",
      initialStateId: "object-state.door.closed",
      states: [
        {
          id: "object-state.door.closed",
          visible: false,
          interactions: [],
        },
      ],
    },
  ],
  scenes: [
    {
      sceneId: "scene.office",
      actorInstances: [],
      objectInstances: [],
      navigationPortals: [],
    },
  ],
});

const actor = {
  id: id<"actor-instance">("actor-instance.detective"),
  actorId: id<"actor">("actor.detective"),
  position: { x: 40, y: 160 },
  facing: "east",
  animationState: "idle",
  mobility: "walkable" as const,
  elevation: 0,
  zOffset: 0,
  scaleMultiplier: 1,
};

const object = {
  id: id<"object">("object.office.door"),
  definitionId: id<"object-definition">("object-definition.door"),
  position: { x: 220, y: 150 },
  layer: "world" as const,
  elevation: 0,
  zOffset: 0,
  scaleMultiplier: 1,
  mirrored: false,
};

const portal = {
  id: id<"navigation-portal">("portal.office.stairs"),
  fromAreaId: id<"navigation-area">("navigation.floor"),
  toAreaId: id<"navigation-area">("navigation.mezzanine"),
  fromPoint: { x: 200, y: 160 },
  toPoint: { x: 230, y: 110 },
  bidirectional: true,
  traversalCost: 0,
};

describe("scene editor history", () => {
  it("inserts, replaces, undoes and redoes actor placement", () => {
    let history = createEditorHistory(manifest);
    history = executeEditorCommand(history, {
      kind: "insert-actor-instance",
      sceneId: id<"scene">("scene.office"),
      index: 0,
      instance: actor,
    });
    history = executeEditorCommand(history, {
      kind: "replace-actor-instance",
      sceneId: id<"scene">("scene.office"),
      instanceId: actor.id,
      instance: { ...actor, position: { x: 120, y: 166 } },
    });

    expect(
      history.document.manifest.scenes[0]?.actorInstances[0]?.position,
    ).toEqual({ x: 120, y: 166 });
    expect(history.document.operationRevision).toBe(2);
    expect(isEditorDocumentDirty(history.document)).toBe(true);

    history = undoEditorCommand(history);
    expect(
      history.document.manifest.scenes[0]?.actorInstances[0]?.position,
    ).toEqual({ x: 40, y: 160 });
    history = undoEditorCommand(history);
    expect(history.document.manifest.scenes[0]?.actorInstances).toEqual([]);
    expect(isEditorDocumentDirty(history.document)).toBe(false);

    history = redoEditorCommand(history);
    history = redoEditorCommand(history);
    expect(
      history.document.manifest.scenes[0]?.actorInstances[0]?.position,
    ).toEqual({ x: 120, y: 166 });
  });

  it("applies multi-entity scene edits as one reversible batch", () => {
    const command: EditorCommand = {
      kind: "batch",
      commands: [
        {
          kind: "insert-actor-instance",
          sceneId: id<"scene">("scene.office"),
          index: 0,
          instance: actor,
        },
        {
          kind: "insert-object-instance",
          sceneId: id<"scene">("scene.office"),
          index: 0,
          instance: object,
        },
        {
          kind: "insert-navigation-portal",
          sceneId: id<"scene">("scene.office"),
          index: 0,
          portal,
        },
      ],
    };
    let history = executeEditorCommand(createEditorHistory(manifest), command);
    const composition = history.document.manifest.scenes[0];
    expect(composition?.actorInstances.map((instance) => instance.id)).toEqual([
      "actor-instance.detective",
    ]);
    expect(composition?.objectInstances.map((instance) => instance.id)).toEqual([
      "object.office.door",
    ]);
    expect(composition?.navigationPortals.map((entry) => entry.id)).toEqual([
      "portal.office.stairs",
    ]);
    expect(history.undoStack).toHaveLength(1);

    history = undoEditorCommand(history);
    expect(history.document.manifest).toEqual(manifest);
    history = redoEditorCommand(history);
    expect(history.document.manifest.scenes[0]?.objectInstances).toHaveLength(1);
  });

  it("keeps a batch atomic when a later child command fails", () => {
    const command: EditorCommand = {
      kind: "batch",
      commands: [
        {
          kind: "insert-actor-instance",
          sceneId: id<"scene">("scene.office"),
          index: 0,
          instance: actor,
        },
        {
          kind: "insert-object-instance",
          sceneId: id<"scene">("scene.missing"),
          index: 0,
          instance: object,
        },
      ],
    };

    expect(() => applyEditorCommand(manifest, command)).toThrow(
      EditorCommandError,
    );
    expect(manifest.scenes[0]?.actorInstances).toEqual([]);
  });

  it("rejects duplicate global instance IDs and identity changes", () => {
    const withActor = applyEditorCommand(manifest, {
      kind: "insert-actor-instance",
      sceneId: id<"scene">("scene.office"),
      index: 0,
      instance: actor,
    }).manifest;

    expect(() =>
      applyEditorCommand(withActor, {
        kind: "insert-object-instance",
        sceneId: id<"scene">("scene.office"),
        index: 0,
        instance: {
          ...object,
          id: actor.id as unknown as Id<"object">,
        },
      }),
    ).toThrow(/already exists/);
    expect(() =>
      applyEditorCommand(withActor, {
        kind: "replace-actor-instance",
        sceneId: id<"scene">("scene.office"),
        instanceId: actor.id,
        instance: {
          ...actor,
          id: id<"actor-instance">("actor-instance.renamed"),
        },
      }),
    ).toThrow(/cannot change ID/);
  });

  it("clears redo history after a divergent command", () => {
    let history = executeEditorCommand(createEditorHistory(manifest), {
      kind: "insert-actor-instance",
      sceneId: id<"scene">("scene.office"),
      index: 0,
      instance: actor,
    });
    history = undoEditorCommand(history);
    expect(history.redoStack).toHaveLength(1);

    history = executeEditorCommand(history, {
      kind: "insert-object-instance",
      sceneId: id<"scene">("scene.office"),
      index: 0,
      instance: object,
    });
    expect(history.redoStack).toEqual([]);
  });

  it("marks the current document clean and becomes clean again after undo", () => {
    let history = executeEditorCommand(createEditorHistory(manifest), {
      kind: "insert-actor-instance",
      sceneId: id<"scene">("scene.office"),
      index: 0,
      instance: actor,
    });
    history = markEditorHistorySaved(history);
    expect(isEditorDocumentDirty(history.document)).toBe(false);

    history = executeEditorCommand(history, {
      kind: "replace-actor-instance",
      sceneId: id<"scene">("scene.office"),
      instanceId: actor.id,
      instance: { ...actor, position: { x: 90, y: 160 } },
    });
    expect(isEditorDocumentDirty(history.document)).toBe(true);
    history = undoEditorCommand(history);
    expect(isEditorDocumentDirty(history.document)).toBe(false);
  });

  it("keeps commands and manifests JSON serializable", () => {
    const command: EditorCommand = {
      kind: "insert-actor-instance",
      sceneId: id<"scene">("scene.office"),
      index: 0,
      instance: actor,
    };
    expect(JSON.parse(JSON.stringify(command))).toEqual(command);
    expect(canonicalEditorJson(manifest)).toBe(
      canonicalEditorJson(parseSceneInstanceManifest(JSON.parse(JSON.stringify(manifest)))),
    );
  });
});
