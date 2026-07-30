import { describe, expect, it } from "vitest";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { createSaveGame } from "@evavo/adventure-save-game";
import {
  clearPlaytestArtifact,
  createPlaytestInspectorWorkspace,
  loadPlaytestArtifactText,
} from "../src/playtest-workspace.js";

const hash = "0".repeat(64);
const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.studio-canonical",
  title: "Studio Canonical Audit",
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

const saveWithRandomState = (randomState: number) =>
  createSaveGame(
    bundle,
    {
      story: {
        schemaVersion: 1,
        projectId: bundle.projectId,
        tick: 12,
        currentSceneId: bundle.startSceneId,
        currentEntranceId: bundle.startEntranceId,
        flags: {},
        variables: {},
        inventory: [],
        awardedScoreIds: [],
        consumedInteractionIds: [],
        consumedDialogueChoiceIds: [],
        activeDialogue: null,
        activeSequences: [],
        objectStates: {},
        randomStreams: { main: randomState },
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
      statusText: "READY",
      parser: { text: "", history: [] },
    },
  );

const json = (value: unknown): string => JSON.stringify(value);

describe("Studio canonical playtest audit", () => {
  it("reveals deterministic divergence hidden by the semantic summary", () => {
    const before = saveWithRandomState(1);
    const after = saveWithRandomState(2);
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

    expect(state.errors.afterSave).toBeNull();
    expect(state.diff).toMatchObject({ changed: false, entries: [] });
    expect(state.canonicalDiff).toMatchObject({
      comparisonVersion: 1,
      changed: true,
      truncated: false,
      beforeFingerprint: before.saveFingerprint,
      afterFingerprint: after.saveFingerprint,
      entries: [
        {
          kind: "changed",
          path: "world.story.randomStreams.main",
          before: 1,
          after: 2,
        },
      ],
    });
  });

  it("clears the canonical result when either comparison save is removed", () => {
    const save = saveWithRandomState(1);
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
      json(save),
      "before.save.json",
    );
    state = loadPlaytestArtifactText(
      state,
      "after-save",
      json(save),
      "after.save.json",
    );
    expect(state.canonicalDiff).toMatchObject({ changed: false, entries: [] });

    state = clearPlaytestArtifact(state, "after-save");

    expect(state.afterSaveInput).toBeNull();
    expect(state.diff).toBeNull();
    expect(state.canonicalDiff).toBeNull();
  });
});
