import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { validateProjectSemantics } from "../src/index.js";

const baseProject = {
  schemaVersion: 1,
  id: "project.narrative-validation",
  title: "Narrative Validation",
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
      backgroundAssetId: "asset.background",
      navigationAreas: [
        {
          id: "navigation.office",
          shape: {
            points: [
              { x: 20, y: 120 },
              { x: 300, y: 120 },
              { x: 300, y: 190 },
              { x: 20, y: 190 },
            ],
          },
          elevation: 0,
        },
      ],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.office",
          position: { x: 40, y: 160 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing useful happens.",
    },
  ],
  actors: [],
  assets: [{ id: "asset.background", path: "office.png", kind: "image" }],
  inventoryItems: [],
} as const;

describe("narrative validation", () => {
  it("accepts a valid dialogue and camera-only sequence", () => {
    const project = parseAdventureProject({
      ...baseProject,
      dialogues: [
        {
          id: "dialogue.introduction",
          name: "Introduction",
          startNodeId: "node.introduction",
          nodes: [
            {
              id: "node.introduction",
              lines: [
                {
                  id: "line.introduction",
                  text: "The office is quiet.",
                },
              ],
              choices: [
                {
                  id: "choice.leave",
                  text: "Leave",
                  closeDialogue: true,
                },
              ],
            },
          ],
        },
      ],
      sequences: [
        {
          id: "sequence.pan-office",
          name: "Office pan",
          mode: "cutscene",
          durationTicks: 30,
          skip: { allowed: true, safeAfterTick: 0 },
          tracks: [
            {
              id: "track.camera",
              kind: "camera",
              cues: [
                {
                  kind: "camera-shot",
                  atTick: 0,
                  durationTicks: 30,
                  position: { x: 40, y: 0 },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(validateProjectSemantics(project).filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("reports broken graph, actor, palette, timing, and skip references", () => {
    const project = parseAdventureProject({
      ...baseProject,
      dialogues: [
        {
          id: "dialogue.broken",
          name: "Broken dialogue",
          startNodeId: "node.missing-start",
          nodes: [
            {
              id: "node.only",
              lines: [
                {
                  id: "line.bad-speaker",
                  speakerId: "actor.missing",
                  text: "This speaker does not exist.",
                },
              ],
              choices: [
                {
                  id: "choice.bad-next",
                  text: "Continue",
                  nextNodeId: "node.missing-next",
                },
              ],
            },
          ],
        },
      ],
      sequences: [
        {
          id: "sequence.broken",
          name: "Broken sequence",
          mode: "cutscene",
          durationTicks: 10,
          skip: { allowed: true, safeAfterTick: 20 },
          tracks: [
            {
              id: "track.actor",
              kind: "actor",
              cues: [
                {
                  kind: "actor-move",
                  atTick: 8,
                  durationTicks: 5,
                  actorId: "actor.missing",
                  destination: { x: 100, y: 160 },
                },
              ],
            },
            {
              id: "track.palette",
              kind: "effects",
              cues: [
                {
                  kind: "palette-cycle",
                  atTick: 0,
                  paletteAssetId: "asset.missing-palette",
                  rangeStart: 12,
                  rangeEnd: 4,
                  ticksPerStep: 2,
                  direction: "forward",
                  enabled: true,
                },
              ],
            },
          ],
        },
      ],
    });

    const codes = validateProjectSemantics(project).map((issue) => issue.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "missing-dialogue-node",
        "missing-actor",
        "invalid-sequence-timing",
        "invalid-skip-boundary",
        "missing-asset",
        "invalid-palette-range",
      ]),
    );
  });
});
