import { describe, expect, it } from "vitest";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  createNarrativeLibraryHistory,
  executeNarrativeLibraryCommand,
  isNarrativeLibraryDocumentDirty,
  markNarrativeLibraryHistorySaved,
  NarrativeLibraryCommandError,
  redoNarrativeLibraryCommand,
  undoNarrativeLibraryCommand,
} from "../src/index.js";
import { parseNarrativeLibraryCommand } from "../src/command-schema.js";

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.narrative-library",
  title: "Narrative Library Fixture",
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
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [
        {
          id: "hotspot.office.receptionist",
          name: "Receptionist",
          shape: {
            points: [
              { x: 220, y: 80 },
              { x: 270, y: 80 },
              { x: 270, y: 170 },
              { x: 220, y: 170 },
            ],
          },
          interactions: [
            {
              id: "interaction.office.receptionist.talk",
              verb: "talk",
              actions: [
                {
                  kind: "start-dialogue",
                  dialogueId: "dialogue.receptionist",
                },
              ],
            },
            {
              id: "interaction.office.lights.use",
              verb: "use",
              actions: [
                {
                  kind: "play-sequence",
                  sequenceId: "sequence.office.blackout",
                },
              ],
            },
          ],
        },
      ],
      entrances: [
        {
          id: "entrance.office",
          position: { x: 20, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  actors: [],
  dialogues: [
    {
      id: "dialogue.receptionist",
      name: "Receptionist interview",
      startNodeId: "dialogue-node.receptionist.opening",
      nodes: [
        {
          id: "dialogue-node.receptionist.opening",
          lines: [
            {
              id: "dialogue-line.receptionist.opening",
              text: "You are late.",
            },
          ],
          choices: [
            {
              id: "dialogue-choice.receptionist.close",
              text: "Leave.",
              closeDialogue: true,
            },
          ],
        },
      ],
    },
  ],
  sequences: [
    {
      id: "sequence.office.blackout",
      name: "Office blackout",
      mode: "cutscene",
      durationTicks: 120,
      skip: {
        allowed: true,
        safeAfterTick: 10,
        completionActions: [],
      },
      tracks: [
        {
          id: "sequence-track.office.story",
          kind: "story",
          cues: [
            {
              kind: "story-action",
              atTick: 100,
              action: {
                kind: "set-flag",
                flag: "office.blackout-finished",
                value: true,
              },
            },
          ],
        },
      ],
    },
  ],
  assets: [{ id: "asset.office", path: "art/office.png", kind: "image" }],
  inventoryItems: [],
});

describe("narrative library history", () => {
  it("replaces dialogue graphs through project undo and redo", () => {
    let history = createNarrativeLibraryHistory(project);
    const dialogue = project.dialogues[0]!;
    history = executeNarrativeLibraryCommand(history, {
      kind: "replace-dialogue",
      dialogueId: dialogue.id,
      dialogue: {
        ...dialogue,
        name: "Receptionist interrogation",
      },
    });

    expect(history.document.project.dialogues[0]?.name).toBe(
      "Receptionist interrogation",
    );
    expect(isNarrativeLibraryDocumentDirty(history.document)).toBe(true);

    history = undoNarrativeLibraryCommand(history);
    expect(history.document.project.dialogues[0]?.name).toBe(
      "Receptionist interview",
    );
    expect(isNarrativeLibraryDocumentDirty(history.document)).toBe(false);

    history = redoNarrativeLibraryCommand(history);
    expect(history.document.project.dialogues[0]?.name).toBe(
      "Receptionist interrogation",
    );

    history = markNarrativeLibraryHistorySaved(history);
    expect(isNarrativeLibraryDocumentDirty(history.document)).toBe(false);
  });

  it("protects dialogue and sequence assets referenced by typed actions", () => {
    const history = createNarrativeLibraryHistory(project);

    expect(() =>
      executeNarrativeLibraryCommand(history, {
        kind: "remove-dialogue",
        dialogueId: project.dialogues[0]!.id,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<NarrativeLibraryCommandError>>({
        code: "protected-entity",
      }),
    );

    expect(() =>
      executeNarrativeLibraryCommand(history, {
        kind: "remove-sequence",
        sequenceId: project.sequences[0]!.id,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<NarrativeLibraryCommandError>>({
        code: "protected-entity",
      }),
    );
  });

  it("allows a narrative asset to be removed after its caller is removed", () => {
    const detached = parseAdventureProject({
      ...project,
      scenes: project.scenes.map((scene) => ({
        ...scene,
        hotspots: scene.hotspots.map((hotspot) => ({
          ...hotspot,
          interactions: [],
        })),
      })),
    });
    const history = executeNarrativeLibraryCommand(
      createNarrativeLibraryHistory(detached),
      {
        kind: "batch",
        commands: [
          {
            kind: "remove-dialogue",
            dialogueId: detached.dialogues[0]!.id,
          },
          {
            kind: "remove-sequence",
            sequenceId: detached.sequences[0]!.id,
          },
        ],
      },
    );

    expect(history.document.project.dialogues).toEqual([]);
    expect(history.document.project.sequences).toEqual([]);
    expect(history.undoStack).toHaveLength(1);
  });

  it("rejects nested ID collisions with the wider project", () => {
    const history = createNarrativeLibraryHistory(project);

    expect(() =>
      executeNarrativeLibraryCommand(history, {
        kind: "insert-dialogue",
        index: 1,
        dialogue: {
          id: "dialogue.porter",
          name: "Porter interview",
          startNodeId: "dialogue-node.porter.opening",
          nodes: [
            {
              id: "dialogue-node.porter.opening",
              lines: [
                {
                  id: project.dialogues[0]!.nodes[0]!.lines[0]!.id,
                  text: "Duplicate nested line ID.",
                },
              ],
              choices: [],
            },
          ],
        },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<NarrativeLibraryCommandError>>({
        code: "duplicate-id",
      }),
    );
  });
});

describe("narrative library command schema", () => {
  it("parses recursive narrative batches", () => {
    expect(
      parseNarrativeLibraryCommand({
        kind: "batch",
        commands: [
          {
            kind: "replace-dialogue",
            dialogueId: project.dialogues[0]!.id,
            dialogue: project.dialogues[0]!,
          },
          {
            kind: "replace-sequence",
            sequenceId: project.sequences[0]!.id,
            sequence: project.sequences[0]!,
          },
        ],
      }),
    ).toMatchObject({ kind: "batch" });
  });

  it("rejects empty narrative batches", () => {
    expect(() =>
      parseNarrativeLibraryCommand({ kind: "batch", commands: [] }),
    ).toThrow();
  });
});
