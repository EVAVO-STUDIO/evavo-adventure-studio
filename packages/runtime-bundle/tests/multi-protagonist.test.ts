import { describe, expect, it } from "vitest";
import { parseRuntimeBundle, RuntimeMultiProtagonistValidationError } from "../src/index.js";

const hash = "0".repeat(64);

const bundle = () => ({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.multi",
  title: "Cross State",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "verb-list",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: false,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.present",
  startEntranceId: "entrance.present",
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [],
  indexedAssets: undefined,
  inventoryItems: [
    { id: "item.plan", name: "Plan", description: "A folded plan." },
  ],
  actors: [
    { id: "actor.bernard", name: "Bernard", frames: [], animations: [], defaultAnimationState: "idle" },
    { id: "actor.laverne", name: "Laverne", frames: [], animations: [], defaultAnimationState: "idle" },
  ],
  scenes: [
    {
      id: "scene.present",
      name: "Present",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.none",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [{ id: "entrance.present", position: { x: 10, y: 170 }, facing: "east" }],
      fallbackText: "No.",
    },
    {
      id: "scene.future",
      name: "Future",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.none",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [{ id: "entrance.future", position: { x: 20, y: 170 }, facing: "west" }],
      fallbackText: "No.",
    },
  ],
  dialogues: [],
  sequences: [],
  multiProtagonist: {
    manifestVersion: 1,
    projectId: "project.multi",
    activeProtagonistId: "actor.bernard",
    protagonists: [
      {
        protagonistId: "actor.bernard",
        startSceneId: "scene.present",
        startEntranceId: "entrance.present",
        startingInventory: ["item.plan"],
      },
      {
        protagonistId: "actor.laverne",
        startSceneId: "scene.future",
        startEntranceId: "entrance.future",
        startingInventory: [],
      },
    ],
  },
});

describe("runtime multi-protagonist manifest", () => {
  it("accepts valid independent protagonist starts", () => {
    const parsed = parseRuntimeBundle(bundle());
    expect(parsed.multiProtagonist?.activeProtagonistId).toBe("actor.bernard");
    expect(parsed.multiProtagonist?.protagonists).toHaveLength(2);
  });

  it("rejects invalid actor, entrance and inventory references", () => {
    const invalid = bundle();
    invalid.multiProtagonist.protagonists[1] = {
      protagonistId: "actor.missing",
      startSceneId: "scene.future",
      startEntranceId: "entrance.missing",
      startingInventory: ["item.missing"],
    };
    expect(() => parseRuntimeBundle(invalid)).toThrow(RuntimeMultiProtagonistValidationError);
  });
});
