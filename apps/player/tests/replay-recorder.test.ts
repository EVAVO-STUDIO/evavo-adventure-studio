import { describe, expect, it } from "vitest";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { createSaveGame } from "@evavo/adventure-save-game";
import { createInitialInteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import {
  createPlayerReplayRecorder,
  ReplayRecordingStateError,
} from "../src/replay-recorder.js";

const hash = "0".repeat(64);
const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.recorder",
  title: "Recorder",
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
      interactionIndex: {},
    },
  ],
  dialogues: [],
  sequences: [],
});

const saveAt = (tick: number) => {
  const initial = createInitialInteractiveRuntimeWorldState(bundle);
  return createSaveGame(
    bundle,
    { ...initial, story: { ...initial.story, tick } },
    {
      controlledActorInstanceId: null,
      selectedVerbId: null,
      selectedItemId: null,
      statusText: "READY",
      parser: { text: "", history: [] },
    },
  );
};

describe("player replay recorder", () => {
  it("records deliberate events and finalizes with a state checkpoint", () => {
    const recorder = createPlayerReplayRecorder(bundle);
    recorder.start(saveAt(4));
    recorder.recordParserInput(4, { kind: "focus" });
    recorder.recordParserInput(5, { kind: "text", text: "look" });
    recorder.recordActivation(8, { x: 40, y: 80 });

    const replay = recorder.finish(saveAt(12));

    expect(replay).toMatchObject({
      replayVersion: 1,
      finalTick: 12,
      expectedFinalSaveFingerprint: saveAt(12).saveFingerprint,
      events: [
        { kind: "parser-key", tick: 4, sequence: 0 },
        { kind: "parser-key", tick: 5, sequence: 1 },
        { kind: "activate", tick: 8, sequence: 2, position: { x: 40, y: 80 } },
      ],
    });
    expect(recorder.latestReplay()).toEqual(replay);
    expect(recorder.latestReplayJson()).toContain('"replayVersion":1');
    expect(recorder.status()).toEqual({
      recording: false,
      eventCount: 0,
      initialTick: null,
      lastEventTick: null,
      hasCompletedReplay: true,
    });
  });

  it("ignores player input outside an active recording session", () => {
    const recorder = createPlayerReplayRecorder(bundle);
    recorder.recordActivation(0, { x: 1, y: 1 });
    recorder.recordParserInput(0, { kind: "focus" });

    expect(recorder.status()).toEqual({
      recording: false,
      eventCount: 0,
      initialTick: null,
      lastEventTick: null,
      hasCompletedReplay: false,
    });

    recorder.start(saveAt(2));
    recorder.recordActivation(3, { x: 2, y: 2 });
    const completed = recorder.finish(saveAt(4));
    recorder.recordActivation(5, { x: 3, y: 3 });
    recorder.recordParserInput(5, { kind: "blur" });

    expect(recorder.latestReplay()).toEqual(completed);
    expect(recorder.status()).toEqual({
      recording: false,
      eventCount: 0,
      initialTick: null,
      lastEventTick: null,
      hasCompletedReplay: true,
    });
  });

  it("refuses to replace an active recording session", () => {
    const recorder = createPlayerReplayRecorder(bundle);
    recorder.start(saveAt(6));
    recorder.recordActivation(7, { x: 4, y: 5 });

    expect(() => recorder.start(saveAt(20))).toThrow(
      new ReplayRecordingStateError("Replay recording has already started."),
    );
    expect(recorder.status()).toEqual({
      recording: true,
      eventCount: 1,
      initialTick: 6,
      lastEventTick: 7,
      hasCompletedReplay: false,
    });
    expect(recorder.finish(saveAt(8)).events).toEqual([
      {
        kind: "activate",
        tick: 7,
        sequence: 0,
        position: { x: 4, y: 5 },
      },
    ]);
  });

  it("rejects events before the recording start or previous event", () => {
    const recorder = createPlayerReplayRecorder(bundle);
    recorder.start(saveAt(10));
    expect(() => recorder.recordActivation(9, { x: 0, y: 0 })).toThrow(
      ReplayRecordingStateError,
    );
    recorder.recordActivation(12, { x: 0, y: 0 });
    expect(() => recorder.recordActivation(11, { x: 1, y: 1 })).toThrow(
      ReplayRecordingStateError,
    );
  });

  it("cancels an in-progress recording without discarding the latest replay", () => {
    const recorder = createPlayerReplayRecorder(bundle);
    recorder.start(saveAt(0));
    recorder.recordActivation(1, { x: 1, y: 1 });
    const completed = recorder.finish(saveAt(2));

    recorder.start(saveAt(3));
    recorder.recordActivation(4, { x: 2, y: 2 });
    recorder.cancel();

    expect(recorder.latestReplay()).toEqual(completed);
    expect(recorder.status().recording).toBe(false);
    expect(() => recorder.finish(saveAt(5))).toThrow(ReplayRecordingStateError);
  });
});
