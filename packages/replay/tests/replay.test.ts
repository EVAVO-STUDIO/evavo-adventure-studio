import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { createSaveGame, loadSaveGame, type SaveGame } from "@evavo/adventure-save-game";
import { createInitialInteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import { describe, expect, it } from "vitest";
import {
  createReplayLog,
  executeReplay,
  parseReplayLog,
  ReplayCompatibilityError,
  ReplayDivergenceError,
  type ReplayEvent,
  ReplayExecutionError,
  ReplayIntegrityError,
  type ReplayParserInput,
  type ReplayRuntimeAdapter,
  serializeReplayLog,
} from "../src/index.js";

const hash = "0".repeat(64);
const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.replay",
  title: "Replay",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "parser-assisted",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: false,
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
  ],
  inventoryItems: [],
  actors: [],
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

const initialSave = createSaveGame(bundle, createInitialInteractiveRuntimeWorldState(bundle), {
  controlledActorInstanceId: null,
  selectedVerbId: null,
  selectedItemId: null,
  statusText: "READY",
  parser: { text: "", history: [] },
});

class FixtureRuntime implements ReplayRuntimeAdapter {
  private save: SaveGame = initialSave;
  private parserText = "";
  private parserHistory: string[] = [];

  restoreSaveGame(input: unknown): number {
    this.save = loadSaveGame(bundle, input);
    this.parserText = this.save.interface.parser.text;
    this.parserHistory = [...this.save.interface.parser.history];
    return this.save.world.story.tick;
  }

  createFrame(tick: number): void {
    this.save = createSaveGame(
      bundle,
      {
        ...this.save.world,
        story: { ...this.save.world.story, tick },
      },
      {
        ...this.save.interface,
        parser: { text: this.parserText, history: this.parserHistory },
      },
    );
  }

  activate(position: { readonly x: number; readonly y: number }): void {
    const activations = Number(this.save.world.story.variables["activations"] ?? 0) + 1;
    this.save = createSaveGame(
      bundle,
      {
        ...this.save.world,
        story: {
          ...this.save.world.story,
          variables: {
            ...this.save.world.story.variables,
            activations,
            lastX: position.x,
            lastY: position.y,
          },
        },
      },
      {
        ...this.save.interface,
        statusText: `ACTIVATE ${position.x},${position.y}`,
        parser: { text: this.parserText, history: this.parserHistory },
      },
    );
  }

  handleKey(input: ReplayParserInput): boolean {
    switch (input.kind) {
      case "focus":
      case "blur":
        return true;
      case "text":
        this.parserText += input.text;
        return true;
      case "backspace":
        this.parserText = [...this.parserText].slice(0, -1).join("");
        return true;
      case "clear":
        this.parserText = "";
        return true;
      case "submit": {
        const submitted = this.parserText.trim();
        if (submitted) this.parserHistory.push(submitted);
        this.parserText = "";
        return true;
      }
      case "delete-word":
        this.parserText = this.parserText.trimEnd().replace(/\S+\s*$/u, "");
        return true;
      case "history-previous":
      case "history-next":
        return true;
    }
  }

  createSaveGame(): SaveGame {
    return createSaveGame(bundle, this.save.world, {
      ...this.save.interface,
      parser: { text: this.parserText, history: this.parserHistory },
    });
  }
}

const events: readonly ReplayEvent[] = [
  { kind: "parser-key", tick: 2, sequence: 0, input: { kind: "focus" } },
  {
    kind: "parser-key",
    tick: 2,
    sequence: 1,
    input: { kind: "text", text: "look desk" },
  },
  { kind: "parser-key", tick: 3, sequence: 2, input: { kind: "submit" } },
  { kind: "activate", tick: 7, sequence: 3, position: { x: 42, y: 90 } },
];

const executeInputs = (runtime: FixtureRuntime, finalTick: number): SaveGame => {
  runtime.restoreSaveGame(initialSave);
  for (const event of events) {
    runtime.createFrame(event.tick);
    if (event.kind === "activate") runtime.activate(event.position);
    else runtime.handleKey(event.input);
  }
  runtime.createFrame(finalTick);
  return runtime.createSaveGame();
};

describe("deterministic replay", () => {
  it("matches uninterrupted execution at an explicit final tick", () => {
    const expected = executeInputs(new FixtureRuntime(), 20);
    const replay = createReplayLog(bundle, initialSave, {
      events,
      finalTick: 20,
      expectedFinalSaveFingerprint: expected.saveFingerprint,
    });

    const result = executeReplay(bundle, replay, new FixtureRuntime());

    expect(result.finalTick).toBe(20);
    expect(result.eventCount).toBe(events.length);
    expect(result.finalSaveFingerprint).toBe(expected.saveFingerprint);
    expect(result.finalSave).toEqual(expected);
    expect(parseReplayLog(JSON.parse(serializeReplayLog(replay)))).toEqual(replay);
  });

  it("detects replay payload tampering", () => {
    const replay = createReplayLog(bundle, initialSave, {
      events,
      finalTick: 20,
    });

    expect(() =>
      parseReplayLog({
        ...replay,
        events: replay.events.map((event, index) =>
          index === 0 ? { ...event, tick: event.tick + 1 } : event,
        ),
      }),
    ).toThrow(ReplayIntegrityError);
  });

  it("rejects invalid event ordering and final checkpoints", () => {
    expect(() =>
      createReplayLog(bundle, initialSave, {
        events: [
          { kind: "activate", tick: 5, sequence: 1, position: { x: 1, y: 1 } },
          { kind: "activate", tick: 4, sequence: 2, position: { x: 2, y: 2 } },
        ],
        finalTick: 4,
      }),
    ).toThrow(ReplayCompatibilityError);
  });

  it("reports divergence from the expected final state", () => {
    const replay = createReplayLog(bundle, initialSave, {
      events,
      finalTick: 20,
      expectedFinalSaveFingerprint: initialSave.saveFingerprint,
    });

    expect(() => executeReplay(bundle, replay, new FixtureRuntime())).toThrow(ReplayDivergenceError);
  });

  it("rejects parser events that the runtime cannot handle", () => {
    const replay = createReplayLog(bundle, initialSave, {
      events: [
        {
          kind: "parser-key",
          tick: 1,
          sequence: 0,
          input: { kind: "focus" },
        },
      ],
      finalTick: 1,
    });
    const runtime = new FixtureRuntime();
    const rejecting: ReplayRuntimeAdapter = {
      ...runtime,
      restoreSaveGame: runtime.restoreSaveGame.bind(runtime),
      createFrame: runtime.createFrame.bind(runtime),
      activate: runtime.activate.bind(runtime),
      createSaveGame: runtime.createSaveGame.bind(runtime),
      handleKey: () => false,
    };

    expect(() => executeReplay(bundle, replay, rejecting)).toThrow(ReplayExecutionError);
  });
});
