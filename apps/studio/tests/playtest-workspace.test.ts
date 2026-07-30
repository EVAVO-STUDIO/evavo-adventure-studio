import { describe, expect, it } from "vitest";
import { createReplayLog } from "@evavo/adventure-replay";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { createSaveGame } from "@evavo/adventure-save-game";
import {
  createPlaytestInspectorWorkspace,
  loadPlaytestArtifactText,
} from "../src/playtest-workspace.js";

const hash = "0".repeat(64);
const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.studio-inspector",
  title: "Studio Inspector",
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

const saveAt = (tick: number, statusText: string) =>
  createSaveGame(
    bundle,
    {
      story: {
        schemaVersion: 1,
        projectId: bundle.projectId,
        tick,
        currentSceneId: bundle.startSceneId,
        currentEntranceId: bundle.startEntranceId,
        flags: { visited: tick > 0 },
        variables: {},
        inventory: [],
        awardedScoreIds: [],
        consumedInteractionIds: [],
        consumedDialogueChoiceIds: [],
        activeDialogue: null,
        activeSequences: [],
        objectStates: {},
        randomStreams: { main: 1 },
        score: 0,
      },
      actorInstances: {},
      movements: {},
      pendingObjectCommands: {},
    },
    {
      controlledActorInstanceId: null,
      selectedVerbId: null,
      selectedItemId: null,
      statusText,
      parser: { text: "", history: [] },
    },
  );

const before = saveAt(0, "READY");
const after = saveAt(20, "COMPLETE");
const replay = createReplayLog(bundle, before, {
  events: [
    { kind: "activate", tick: 4, sequence: 0, position: { x: 40, y: 80 } },
  ],
  finalTick: 20,
  expectedFinalSaveFingerprint: after.saveFingerprint,
});

const json = (value: unknown): string => JSON.stringify(value);

describe("Studio playtest inspector workspace", () => {
  it("loads a bundle, two saves and a replay into semantic views", () => {
    let state = createPlaytestInspectorWorkspace();
    state = loadPlaytestArtifactText(
      state,
      "bundle",
      json(bundle),
      "game.bundle.json",
    );
    state = loadPlaytestArtifactText(
      state,
      "before-save",
      json(before),
      "before.save.json",
    );
    state = loadPlaytestArtifactText(
      state,
      "after-save",
      json(after),
      "after.save.json",
    );
    state = loadPlaytestArtifactText(
      state,
      "replay",
      json(replay),
      "playtest.replay.json",
    );

    expect(state.errors).toEqual({
      bundle: null,
      beforeSave: null,
      afterSave: null,
      replay: null,
    });
    expect(state.beforeInspection).toMatchObject({ tick: 0, statusText: "READY" });
    expect(state.afterInspection).toMatchObject({ tick: 20, statusText: "COMPLETE" });
    expect(state.diff?.entries.map((entry) => entry.path)).toEqual(
      expect.arrayContaining([
        "interface.statusText",
        "world.story.flags.visited",
        "world.story.tick",
      ]),
    );
    expect(state.replayInspection).toMatchObject({
      eventCount: 1,
      initialTick: 0,
      finalTick: 20,
      timeline: [{ tick: 4 }],
    });
  });

  it("retains artifact inputs loaded before the bundle and recomputes later", () => {
    let state = createPlaytestInspectorWorkspace();
    state = loadPlaytestArtifactText(
      state,
      "before-save",
      json(before),
      "before.save.json",
    );
    expect(state.beforeInspection).toBeNull();

    state = loadPlaytestArtifactText(
      state,
      "bundle",
      json(bundle),
      "game.bundle.json",
    );
    expect(state.beforeInspection?.tick).toBe(0);
  });

  it("reports malformed and incompatible artifacts without discarding the bundle", () => {
    let state = loadPlaytestArtifactText(
      createPlaytestInspectorWorkspace(),
      "bundle",
      json(bundle),
      "game.bundle.json",
    );
    state = loadPlaytestArtifactText(
      state,
      "before-save",
      "not json",
      "broken.save.json",
    );

    expect(state.bundle?.projectId).toBe("project.studio-inspector");
    expect(state.errors.beforeSave).toContain("not valid JSON");
    expect(state.beforeInspection).toBeNull();

    state = loadPlaytestArtifactText(
      state,
      "replay",
      json({ ...replay, finalTick: 21 }),
      "tampered.replay.json",
    );
    expect(state.errors.replay).toContain("fingerprint");
    expect(state.replayInspection).toBeNull();
  });
});
