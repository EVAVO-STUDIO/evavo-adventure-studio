import { describe, expect, it } from "vitest";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  createProjectEditorHistory,
  executeProjectEditorCommand,
  isProjectEditorDocumentDirty,
  markProjectEditorHistorySaved,
  ProjectEditorCommandError,
  redoProjectEditorCommand,
  undoProjectEditorCommand,
} from "../src/index.js";
import { parseProjectEditorCommand } from "../src/command-schema.js";

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.project-editor",
  title: "Project Editor Fixture",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: false,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.office",
  startEntranceId: "entrance.office",
  scenes: [
    {
      id: "scene.office",
      name: "Office",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.office",
      navigationAreas: [
        {
          id: "navigation.office.main",
          shape: {
            points: [
              { x: 10, y: 110 },
              { x: 310, y: 110 },
              { x: 310, y: 190 },
              { x: 10, y: 190 },
            ],
          },
          elevation: 0,
        },
      ],
      depthBands: [
        {
          id: "depth.office.floor",
          farY: 110,
          nearY: 190,
          farScale: 0.7,
          nearScale: 1,
        },
      ],
      occluders: [],
      hotspots: [
        {
          id: "hotspot.office.desk",
          name: "Desk",
          shape: {
            points: [
              { x: 80, y: 90 },
              { x: 220, y: 90 },
              { x: 220, y: 150 },
              { x: 80, y: 150 },
            ],
          },
          interactions: [
            {
              id: "interaction.office.desk.look",
              verb: "look",
              actions: [{ kind: "say", text: "A disciplined desk." }],
            },
          ],
        },
      ],
      entrances: [
        {
          id: "entrance.office",
          position: { x: 30, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
    {
      id: "scene.alley",
      name: "Alley",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.alley",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.alley",
          position: { x: 280, y: 170 },
          facing: "west",
        },
      ],
      fallbackText: "Rain answers.",
    },
  ],
  actors: [],
  dialogues: [],
  sequences: [],
  assets: [
    { id: "asset.office", path: "art/office.png", kind: "image" },
    { id: "asset.alley", path: "art/alley.png", kind: "image" },
  ],
  inventoryItems: [],
});

describe("project editor history", () => {
  it("replaces walkmesh geometry with undo and redo", () => {
    let history = createProjectEditorHistory(project);
    const area = project.scenes[0]!.navigationAreas[0]!;
    history = executeProjectEditorCommand(history, {
      kind: "replace-navigation-area",
      sceneId: project.scenes[0]!.id,
      areaId: area.id,
      area: {
        ...area,
        shape: {
          points: [
            { x: 18, y: 118 },
            { x: 302, y: 118 },
            { x: 302, y: 188 },
            { x: 18, y: 188 },
          ],
        },
      },
    });

    expect(
      history.document.project.scenes[0]?.navigationAreas[0]?.shape.points[0],
    ).toEqual({ x: 18, y: 118 });
    expect(isProjectEditorDocumentDirty(history.document)).toBe(true);

    history = undoProjectEditorCommand(history);
    expect(
      history.document.project.scenes[0]?.navigationAreas[0]?.shape.points[0],
    ).toEqual({ x: 10, y: 110 });
    expect(isProjectEditorDocumentDirty(history.document)).toBe(false);

    history = redoProjectEditorCommand(history);
    expect(
      history.document.project.scenes[0]?.navigationAreas[0]?.shape.points[0],
    ).toEqual({ x: 18, y: 118 });

    history = markProjectEditorHistorySaved(history);
    expect(isProjectEditorDocumentDirty(history.document)).toBe(false);
  });

  it("protects the start scene and entrance", () => {
    const history = createProjectEditorHistory(project);

    expect(() =>
      executeProjectEditorCommand(history, {
        kind: "remove-scene",
        sceneId: project.startSceneId,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ProjectEditorCommandError>>({
        code: "protected-entity",
      }),
    );

    expect(() =>
      executeProjectEditorCommand(history, {
        kind: "remove-entrance",
        sceneId: project.startSceneId,
        entranceId: project.startEntranceId,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ProjectEditorCommandError>>({
        code: "protected-entity",
      }),
    );
  });

  it("rejects nested hotspot interaction ID collisions", () => {
    const history = createProjectEditorHistory(project);
    const existing = project.scenes[0]!.hotspots[0]!;

    expect(() =>
      executeProjectEditorCommand(history, {
        kind: "insert-hotspot",
        sceneId: project.scenes[0]!.id,
        index: 1,
        hotspot: {
          id: "hotspot.office.cabinet",
          name: "Cabinet",
          shape: {
            points: [
              { x: 230, y: 70 },
              { x: 280, y: 70 },
              { x: 280, y: 150 },
              { x: 230, y: 150 },
            ],
          },
          interactions: [
            {
              id: existing.interactions[0]!.id,
              verb: "look",
              actions: [{ kind: "say", text: "A locked cabinet." }],
            },
          ],
        },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ProjectEditorCommandError>>({
        code: "duplicate-id",
      }),
    );
  });

  it("applies valid command batches atomically", () => {
    const history = executeProjectEditorCommand(createProjectEditorHistory(project), {
      kind: "batch",
      commands: [
        {
          kind: "insert-depth-band",
          sceneId: "scene.alley",
          index: 0,
          band: {
            id: "depth.alley.floor",
            farY: 105,
            nearY: 190,
            farScale: 0.66,
            nearScale: 1,
          },
        },
        {
          kind: "insert-navigation-area",
          sceneId: "scene.alley",
          index: 0,
          area: {
            id: "navigation.alley.main",
            shape: {
              points: [
                { x: 8, y: 105 },
                { x: 312, y: 105 },
                { x: 308, y: 192 },
                { x: 12, y: 192 },
              ],
            },
            elevation: 0,
          },
        },
      ],
    });

    expect(history.document.project.scenes[1]?.depthBands).toHaveLength(1);
    expect(history.document.project.scenes[1]?.navigationAreas).toHaveLength(1);
    expect(history.undoStack).toHaveLength(1);
  });
});

describe("project editor command schema", () => {
  it("parses recursive project edit batches", () => {
    expect(
      parseProjectEditorCommand({
        kind: "batch",
        commands: [
          {
            kind: "replace-presentation",
            presentation: { ...project.presentation, showScore: true },
          },
          {
            kind: "remove-scene",
            sceneId: "scene.alley",
          },
        ],
      }),
    ).toMatchObject({ kind: "batch" });
  });

  it("rejects empty batches", () => {
    expect(() =>
      parseProjectEditorCommand({ kind: "batch", commands: [] }),
    ).toThrow();
  });
});
