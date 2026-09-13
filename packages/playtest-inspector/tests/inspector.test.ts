import type { Id } from "@evavo/adventure-project-schema";
import { createReplayLog } from "@evavo/adventure-replay";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { createSaveGame } from "@evavo/adventure-save-game";
import { describe, expect, it } from "vitest";
import { diffSaveGames, inspectReplay, inspectSaveGame } from "../src/index.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const hash = "0".repeat(64);
const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.inspector",
  title: "Inspector",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: true,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.office",
  startEntranceId: "entrance.office",
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [
    {
      assetId: "asset.office",
      kind: "image",
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/office.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image",
        width: 320,
        height: 200,
        palette: true,
        colourCount: 16,
      },
    },
    {
      assetId: "asset.item.key",
      kind: "image",
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/key.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image",
        width: 12,
        height: 8,
        palette: true,
        colourCount: 4,
      },
    },
  ],
  inventoryItems: [
    {
      id: "item.key",
      name: "Brass Key",
      description: "A small brass key.",
      iconAssetId: "asset.item.key",
    },
  ],
  actors: [],
  scenes: [
    {
      id: "scene.office",
      name: "Rainy Office",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.office",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
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
  dialogues: [],
  sequences: [],
});

const worldAt = (
  tick: number,
  options: {
    readonly hasKey?: boolean;
    readonly score?: number;
    readonly rainFlag?: boolean;
    readonly visits?: number;
  } = {},
): Parameters<typeof createSaveGame>[1] => ({
  story: {
    schemaVersion: 1,
    projectId: bundle.projectId,
    tick,
    currentSceneId: bundle.startSceneId,
    currentEntranceId: bundle.startEntranceId,
    flags: { raining: options.rainFlag ?? false },
    variables: { visits: options.visits ?? 1 },
    inventory: options.hasKey ? [id<"item">("item.key")] : [],
    awardedScoreIds: [],
    consumedInteractionIds: [],
    consumedDialogueChoiceIds: [],
    activeDialogue: null,
    activeSequences: [],
    objectStates: {},
    randomStreams: { main: 1 },
    score: options.score ?? 0,
  },
  actorInstances: {},
  movements: {},
  pendingObjectCommands: {},
});

const saveAt = (tick: number, options: Parameters<typeof worldAt>[1] = {}) =>
  createSaveGame(bundle, worldAt(tick, options), {
    controlledActorInstanceId: null,
    selectedVerbId: null,
    selectedItemId: options.hasKey ? id<"item">("item.key") : null,
    statusText: options.hasKey ? "KEY ACQUIRED" : "READY",
    parser: {
      text: "",
      history: options.hasKey ? ["take key"] : [],
    },
  });

describe("save inspection", () => {
  it("produces a deterministic semantic summary", () => {
    const save = saveAt(18, {
      hasKey: true,
      score: 5,
      rainFlag: true,
      visits: 3,
    });

    expect(inspectSaveGame(bundle, save)).toMatchObject({
      projectId: "project.inspector",
      saveFingerprint: save.saveFingerprint,
      tick: 18,
      sceneId: "scene.office",
      sceneName: "Rainy Office",
      score: 5,
      inventory: [{ id: "item.key", name: "Brass Key" }],
      trueFlags: ["raining"],
      falseFlags: [],
      variables: [{ name: "visits", value: 3 }],
      statusText: "KEY ACQUIRED",
      parserHistory: ["take key"],
    });
  });

  it("reports stable semantic changes between two saves", () => {
    const before = saveAt(2);
    const after = saveAt(12, {
      hasKey: true,
      score: 5,
      rainFlag: true,
      visits: 2,
    });
    const diff = diffSaveGames(bundle, before, after);

    expect(diff.changed).toBe(true);
    expect(diff.beforeFingerprint).toBe(before.saveFingerprint);
    expect(diff.afterFingerprint).toBe(after.saveFingerprint);
    expect(diff.entries.map((entry) => `${entry.code}:${entry.path}`)).toEqual(
      expect.arrayContaining([
        "tick:world.story.tick",
        "score:world.story.score",
        "inventory:world.story.inventory",
        "flag:world.story.flags.raining",
        "variable:world.story.variables.visits",
        "interface-selection:interface.selectedItemId",
        "status:interface.statusText",
        "parser:interface.parser",
      ]),
    );
    expect(diff.entries).toEqual(
      [...diff.entries].sort((left, right) => left.path.localeCompare(right.path)),
    );
  });

  it("returns no entries for identical saves", () => {
    const save = saveAt(4);
    expect(diffSaveGames(bundle, save, save)).toMatchObject({
      changed: false,
      entries: [],
    });
  });
});

describe("replay inspection", () => {
  it("groups ordered events into a deterministic tick timeline", () => {
    const initial = saveAt(4);
    const replay = createReplayLog(bundle, initial, {
      events: [
        {
          kind: "parser-key",
          tick: 4,
          sequence: 0,
          input: { kind: "text", text: "look" },
        },
        {
          kind: "parser-key",
          tick: 4,
          sequence: 1,
          input: { kind: "submit" },
        },
        {
          kind: "activate",
          tick: 9,
          sequence: 2,
          position: { x: 40, y: 80 },
        },
      ],
      finalTick: 20,
    });

    expect(inspectReplay(bundle, replay)).toMatchObject({
      replayFingerprint: replay.replayFingerprint,
      initialTick: 4,
      finalTick: 20,
      durationTicks: 16,
      eventCount: 3,
      timeline: [
        {
          tick: 4,
          events: [
            { sequence: 0, label: "Parser text: look" },
            { sequence: 1, label: "Parser: submit" },
          ],
        },
        {
          tick: 9,
          events: [{ sequence: 2, label: "Activate 40, 80" }],
        },
      ],
    });
  });
});
