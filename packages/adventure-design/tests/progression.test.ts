import type { AdventureProject } from "@evavo/adventure-project-schema";
import type { SceneInstanceManifest } from "@evavo/adventure-scene-instances";
import { describe, expect, it } from "vitest";
import { evaluateAdventureProgression } from "../src/progression-analysis.js";
import type { AdventureDesignDocument } from "../src/types.js";

interface ProjectOptions {
  readonly loopingSequence?: boolean;
  readonly recursiveSequence?: boolean;
  readonly recursiveDialogue?: boolean;
  readonly memoryGate?: boolean;
}

const projectFixture = (options: ProjectOptions = {}): AdventureProject =>
  ({
    schemaVersion: 1,
    id: "project.flow",
    title: "Flow Fixture",
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
    startSceneId: "scene.archive",
    startEntranceId: "entrance.archive",
    scenes: [
      {
        id: "scene.archive",
        name: "Archive",
        width: 320,
        height: 200,
        backgroundAssetId: "asset.archive",
        navigationAreas: [
          {
            id: "navigation.archive",
            shape: {
              points: [
                { x: 0, y: 100 },
                { x: 320, y: 100 },
                { x: 320, y: 200 },
                { x: 0, y: 200 },
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
            id: "entrance.archive",
            position: { x: 32, y: 170 },
            facing: "east",
          },
        ],
        fallbackText: "Nothing changes.",
      },
      {
        id: "scene.alley",
        name: "Alley",
        width: 320,
        height: 200,
        backgroundAssetId: "asset.alley",
        navigationAreas: [
          {
            id: "navigation.alley",
            shape: {
              points: [
                { x: 0, y: 100 },
                { x: 320, y: 100 },
                { x: 320, y: 200 },
                { x: 0, y: 200 },
              ],
            },
            elevation: 0,
          },
        ],
        depthBands: [],
        occluders: [],
        hotspots: [
          {
            id: "hotspot.witness",
            name: "Witness",
            shape: {
              points: [
                { x: 180, y: 100 },
                { x: 240, y: 100 },
                { x: 240, y: 180 },
                { x: 180, y: 180 },
              ],
            },
            interactions: [
              {
                id: "interaction.witness",
                verb: "talk",
                once: true,
                actions: [
                  {
                    kind: "start-dialogue",
                    dialogueId: "dialogue.witness",
                  },
                ],
              },
            ],
          },
        ],
        entrances: [
          {
            id: "entrance.alley",
            position: { x: 32, y: 170 },
            facing: "east",
          },
        ],
        fallbackText: "Rain drowns the attempt.",
      },
      {
        id: "scene.quay",
        name: "Quay",
        width: 320,
        height: 200,
        backgroundAssetId: "asset.quay",
        navigationAreas: [
          {
            id: "navigation.quay",
            shape: {
              points: [
                { x: 0, y: 100 },
                { x: 320, y: 100 },
                { x: 320, y: 200 },
                { x: 0, y: 200 },
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
            id: "entrance.quay",
            position: { x: 32, y: 170 },
            facing: "east",
          },
        ],
        fallbackText: "The harbour waits.",
      },
    ],
    actors: [],
    dialogues: [
      {
        id: "dialogue.witness",
        name: "Witness route",
        startNodeId: "dialogue-node.witness",
        nodes: [
          {
            id: "dialogue-node.witness",
            enterActions: options.recursiveDialogue
              ? [
                  {
                    kind: "start-dialogue",
                    dialogueId: "dialogue.witness",
                  },
                ]
              : [],
            lines: [],
            choices: [
              {
                id: "dialogue-choice.route",
                text: "Ask for the route",
                visibleWhen: options.memoryGate
                  ? {
                      kind: "interaction-used",
                      interactionId: "interaction.witness",
                    }
                  : undefined,
                once: true,
                actions: [
                  {
                    kind: "play-sequence",
                    sequenceId: "sequence.route",
                  },
                ],
                closeDialogue: true,
              },
            ],
            exitActions: [],
          },
        ],
      },
    ],
    sequences: [
      {
        id: "sequence.route",
        name: "Route reveal",
        mode: "cutscene",
        durationTicks: 10,
        loop: options.loopingSequence ?? false,
        blocking: true,
        savePolicy: "boundary-only",
        skip: {
          allowed: true,
          safeAfterTick: 0,
          completionActions: [
            {
              kind: "change-scene",
              sceneId: "scene.quay",
              entranceId: "entrance.quay",
            },
          ],
        },
        tracks: [
          {
            id: "sequence-track.story",
            kind: "story",
            cues: options.recursiveSequence
              ? [
                  {
                    kind: "story-action",
                    atTick: 2,
                    action: {
                      kind: "play-sequence",
                      sequenceId: "sequence.route",
                    },
                  },
                ]
              : [],
          },
        ],
      },
    ],
    assets: [
      { id: "asset.archive", path: "archive.png", kind: "image" },
      { id: "asset.alley", path: "alley.png", kind: "image" },
      { id: "asset.quay", path: "quay.png", kind: "image" },
      { id: "asset.key", path: "key.png", kind: "image" },
      { id: "asset.drawer", path: "drawer.aseprite", kind: "spritesheet" },
      { id: "asset.door", path: "door.aseprite", kind: "spritesheet" },
      { id: "asset.shredder", path: "shredder.aseprite", kind: "spritesheet" },
    ],
    inventoryItems: [
      {
        id: "item.key",
        name: "Service key",
        description: "A route key.",
        iconAssetId: "asset.key",
      },
    ],
  }) as unknown as AdventureProject;

interface ManifestOptions {
  readonly giveKey?: boolean;
  readonly discardBranch?: boolean;
  readonly drawerVisibleByDefaultFalseFlag?: boolean;
  readonly drawerHiddenByTrueFlag?: boolean;
}

const visual = (assetId: string, frameId: string) => ({
  kind: "sprite-frame",
  assetId,
  frameId,
  sourceRect: { x: 0, y: 0, width: 20, height: 20 },
  sourceSize: { width: 20, height: 20 },
  trimOffset: { x: 0, y: 0 },
  pivot: { x: 10, y: 19 },
});

const manifestFixture = (options: ManifestOptions = {}): SceneInstanceManifest =>
  ({
    manifestVersion: 1,
    projectId: "project.flow",
    objectDefinitions: [
      {
        id: "object-definition.drawer",
        name: "Drawer",
        initialStateId: "object-state.drawer.closed",
        states: [
          {
            id: "object-state.drawer.closed",
            visual: visual("asset.drawer", "frame.drawer.closed"),
            interactionShape: {
              points: [
                { x: 0, y: 0 },
                { x: 20, y: 0 },
                { x: 20, y: 20 },
                { x: 0, y: 20 },
              ],
            },
            interactions: [
              {
                id: "interaction.drawer.open",
                verb: "open",
                once: true,
                actions: [
                  ...(options.giveKey === false ? [] : [{ kind: "give-item", itemId: "item.key" }]),
                  {
                    kind: "set-object-state",
                    objectId: "object.drawer",
                    state: "object-state.drawer.open",
                  },
                ],
              },
            ],
          },
          {
            id: "object-state.drawer.open",
            visual: visual("asset.drawer", "frame.drawer.open"),
            interactions: [],
          },
        ],
      },
      {
        id: "object-definition.door",
        name: "Door",
        initialStateId: "object-state.door.locked",
        states: [
          {
            id: "object-state.door.locked",
            visual: visual("asset.door", "frame.door.locked"),
            interactionShape: {
              points: [
                { x: 0, y: 0 },
                { x: 20, y: 0 },
                { x: 20, y: 20 },
                { x: 0, y: 20 },
              ],
            },
            interactions: [
              {
                id: "interaction.door.unlock",
                verb: "use",
                itemId: "item.key",
                once: true,
                actions: [
                  {
                    kind: "change-scene",
                    sceneId: "scene.alley",
                    entranceId: "entrance.alley",
                  },
                ],
              },
            ],
          },
        ],
      },
      ...(options.discardBranch
        ? [
            {
              id: "object-definition.shredder",
              name: "Shredder",
              initialStateId: "object-state.shredder.ready",
              states: [
                {
                  id: "object-state.shredder.ready",
                  visual: visual("asset.shredder", "frame.shredder.ready"),
                  interactionShape: {
                    points: [
                      { x: 0, y: 0 },
                      { x: 20, y: 0 },
                      { x: 20, y: 20 },
                      { x: 0, y: 20 },
                    ],
                  },
                  interactions: [
                    {
                      id: "interaction.shredder.discard",
                      verb: "use",
                      itemId: "item.key",
                      once: true,
                      actions: [{ kind: "remove-item", itemId: "item.key" }],
                    },
                  ],
                },
              ],
            },
          ]
        : []),
    ],
    scenes: [
      {
        sceneId: "scene.archive",
        actorInstances: [],
        objectInstances: [
          {
            id: "object.drawer",
            definitionId: "object-definition.drawer",
            position: { x: 100, y: 150 },
            ...(options.drawerVisibleByDefaultFalseFlag
              ? {
                  visibleWhen: {
                    kind: "flag",
                    flag: "drawer.hidden",
                    equals: false,
                  },
                }
              : {}),
            ...(options.drawerHiddenByTrueFlag
              ? {
                  visibleWhen: {
                    kind: "flag",
                    flag: "drawer.hidden",
                    equals: true,
                  },
                }
              : {}),
          },
          {
            id: "object.door",
            definitionId: "object-definition.door",
            position: { x: 280, y: 150 },
          },
          ...(options.discardBranch
            ? [
                {
                  id: "object.shredder",
                  definitionId: "object-definition.shredder",
                  position: { x: 160, y: 150 },
                },
              ]
            : []),
        ],
        navigationPortals: [],
      },
    ],
  }) as unknown as SceneInstanceManifest;

const designFixture = (
  alternatives: readonly (readonly string[])[] = [["item.key"]],
): AdventureDesignDocument =>
  ({
    projectId: "project.flow",
    map: {
      locations: [{ sceneId: "scene.archive" }, { sceneId: "scene.alley" }, { sceneId: "scene.quay" }],
    },
    puzzles: [
      {
        id: "puzzle.route",
        name: "Open the route",
        optional: false,
        solutions: alternatives.map((items, solutionIndex) => ({
          id: `solution.${solutionIndex}`,
          steps: items.map((itemId, stepIndex) => ({
            id: `step.${solutionIndex}.${stepIndex}`,
            itemId,
          })),
        })),
      },
    ],
  }) as unknown as AdventureDesignDocument;

describe("adventure progression flow", () => {
  it("proves the complete object, inventory, dialogue and sequence route", () => {
    const report = evaluateAdventureProgression(projectFixture(), designFixture(), manifestFixture());

    expect(report.status).toBe("ready");
    expect(report.complete).toBe(true);
    expect(report.metrics.objectiveCoverage).toBe(4);
    expect(report.metrics.objectiveTotal).toBe(4);
    expect(report.reachableSceneIds).toEqual(["scene.archive", "scene.alley", "scene.quay"]);
    expect(report.obtainableItemIds).toEqual(["item.key"]);
    expect(report.reachableDialogueIds).toEqual(["dialogue.witness"]);
    expect(report.reachableSequenceIds).toEqual(["sequence.route"]);
  });

  it("is deterministic across repeated exploration", () => {
    const input = [projectFixture(), designFixture(), manifestFixture()] as const;
    expect(evaluateAdventureProgression(...input)).toEqual(evaluateAdventureProgression(...input));
  });

  it("blocks a required route when its key is never awarded", () => {
    const report = evaluateAdventureProgression(
      projectFixture(),
      designFixture(),
      manifestFixture({ giveKey: false }),
    );

    expect(report.status).toBe("blocked");
    expect(report.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(["required-item-unobtainable", "required-scene-unreachable"]),
    );
  });

  it("treats puzzle solutions as alternatives instead of cumulative item lists", () => {
    const report = evaluateAdventureProgression(
      projectFixture(),
      designFixture([["item.key"], ["item.alternative"]]),
      manifestFixture(),
    );

    expect(report.complete).toBe(true);
    expect(report.findings.some((finding) => finding.code === "required-item-unobtainable")).toBe(false);
  });

  it("detects a branch that consumes the one recoverable route key", () => {
    const report = evaluateAdventureProgression(
      projectFixture(),
      designFixture(),
      manifestFixture({ discardBranch: true }),
    );

    expect(report.findings.some((finding) => finding.code === "potential-soft-lock")).toBe(true);
  });

  it("uses runtime-default false flags for visibility conditions", () => {
    const visible = evaluateAdventureProgression(
      projectFixture(),
      designFixture(),
      manifestFixture({ drawerVisibleByDefaultFalseFlag: true }),
    );
    const hidden = evaluateAdventureProgression(
      projectFixture(),
      designFixture(),
      manifestFixture({ drawerHiddenByTrueFlag: true }),
    );

    expect(visible.obtainableItemIds).toContain("item.key");
    expect(hidden.obtainableItemIds).not.toContain("item.key");
  });

  it("marks one-shot interaction memory before dialogue choice conditions", () => {
    const report = evaluateAdventureProgression(
      projectFixture({ memoryGate: true }),
      designFixture(),
      manifestFixture(),
    );

    expect(report.reachableSequenceIds).toEqual(["sequence.route"]);
    expect(report.reachableSceneIds).toContain("scene.quay");
  });

  it("reports looping and recursive narrative boundaries", () => {
    const looping = evaluateAdventureProgression(
      projectFixture({ loopingSequence: true }),
      designFixture(),
      manifestFixture(),
    );
    const recursive = evaluateAdventureProgression(
      projectFixture({ recursiveSequence: true, recursiveDialogue: true }),
      designFixture(),
      manifestFixture(),
    );

    expect(looping.findings.map((finding) => finding.code)).toContain("analysis-looping-sequence");
    expect(recursive.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(["analysis-sequence-recursion", "analysis-dialogue-recursion"]),
    );
  });

  it("never claims exhaustive completion after state-space truncation", () => {
    const report = evaluateAdventureProgression(projectFixture(), designFixture(), manifestFixture(), {
      maximumStates: 1,
    });

    expect(report.truncated).toBe(true);
    expect(report.complete).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toContain("analysis-truncated");
  });

  it("rejects unsafe explorer limits", () => {
    expect(() =>
      evaluateAdventureProgression(projectFixture(), designFixture(), manifestFixture(), { maximumDepth: 0 }),
    ).toThrow(/positive safe integer/);
  });
});
