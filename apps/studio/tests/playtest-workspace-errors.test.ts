import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  clearPlaytestArtifact,
  createPlaytestInspectorWorkspace,
  loadPlaytestArtifactText,
} from "../src/playtest-workspace.js";

const hash = "0".repeat(64);
const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.workspace-errors",
  title: "Workspace Errors",
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
    },
  ],
  dialogues: [],
  sequences: [],
});

const json = (value: unknown): string => JSON.stringify(value);

describe("Studio playtest workspace error lifecycle", () => {
  it("clears a stale parse error when valid JSON replaces it before a bundle", () => {
    let state = loadPlaytestArtifactText(
      createPlaytestInspectorWorkspace(),
      "before-save",
      "not json",
      "broken.save.json",
    );
    expect(state.errors.beforeSave).toContain("not valid JSON");

    state = loadPlaytestArtifactText(state, "before-save", "{}", "replacement.save.json");

    expect(state.beforeSaveInput).toEqual({});
    expect(state.beforeSaveName).toBe("replacement.save.json");
    expect(state.beforeInspection).toBeNull();
    expect(state.errors.beforeSave).toBeNull();
  });

  it("preserves an artifact parse error while an unrelated bundle is loaded", () => {
    let state = loadPlaytestArtifactText(
      createPlaytestInspectorWorkspace(),
      "before-save",
      "not json",
      "broken.save.json",
    );

    state = loadPlaytestArtifactText(state, "bundle", json(bundle), "game.bundle.json");

    expect(state.bundle?.projectId).toBe("project.workspace-errors");
    expect(state.beforeSaveInput).toBeNull();
    expect(state.beforeSaveName).toBe("broken.save.json");
    expect(state.errors.beforeSave).toContain("not valid JSON");

    state = loadPlaytestArtifactText(state, "before-save", "{}", "invalid.save.json");
    expect(state.errors.beforeSave).not.toContain("not valid JSON");
    expect(state.errors.beforeSave).not.toBeNull();
  });

  it("clears the artifact error together with the artifact", () => {
    let state = loadPlaytestArtifactText(
      createPlaytestInspectorWorkspace(),
      "replay",
      "not json",
      "broken.replay.json",
    );
    expect(state.errors.replay).toContain("not valid JSON");

    state = clearPlaytestArtifact(state, "replay");

    expect(state.replayInput).toBeNull();
    expect(state.replayName).toBeNull();
    expect(state.replayInspection).toBeNull();
    expect(state.errors.replay).toBeNull();
  });
});
