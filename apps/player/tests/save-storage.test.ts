import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { createSaveGame } from "@evavo/adventure-save-game";
import { createInitialInteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import { describe, expect, it } from "vitest";
import {
  hasSaveGameSlot,
  inspectSaveGameSlot,
  listSaveGameSlots,
  readSaveGameSlot,
  removeSaveGameSlot,
  SaveGameSlotMissingError,
  type SaveGameStorage,
  saveGameStorageKey,
  writeSaveGameSlot,
} from "../src/save-storage.js";

const hash = "0".repeat(64);
const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.storage",
  title: "Storage",
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

class MemoryStorage implements SaveGameStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const save = () =>
  createSaveGame(bundle, createInitialInteractiveRuntimeWorldState(bundle), {
    controlledActorInstanceId: null,
    selectedVerbId: null,
    selectedItemId: null,
    statusText: "READY",
    parser: { text: "", history: [] },
  });

describe("browser save slots", () => {
  it("writes, validates, reads and removes a bundle-scoped slot", () => {
    const storage = new MemoryStorage();
    const created = save();

    writeSaveGameSlot(storage, bundle, created, 3);

    expect(hasSaveGameSlot(storage, bundle, 3)).toBe(true);
    expect(readSaveGameSlot(storage, bundle, 3)).toEqual(created);
    expect(saveGameStorageKey(bundle, 3)).toContain("slot-03");

    removeSaveGameSlot(storage, bundle, 3);
    expect(hasSaveGameSlot(storage, bundle, 3)).toBe(false);
    expect(() => readSaveGameSlot(storage, bundle, 3)).toThrow(SaveGameSlotMissingError);
  });

  it("lists deterministic slot summaries without adding wall-clock metadata", () => {
    const storage = new MemoryStorage();
    const created = save();
    writeSaveGameSlot(storage, bundle, created, 2);

    expect(listSaveGameSlots(storage, bundle, 4)).toEqual([
      { slot: 0, status: "empty" },
      { slot: 1, status: "empty" },
      {
        slot: 2,
        status: "valid",
        tick: 0,
        sceneId: "scene.office",
        sceneName: "Office",
        score: 0,
        inventoryCount: 0,
        saveFingerprint: created.saveFingerprint,
      },
      { slot: 3, status: "empty" },
    ]);
  });

  it("reports malformed or incompatible slots as damaged without throwing from inspection", () => {
    const storage = new MemoryStorage();
    storage.setItem(saveGameStorageKey(bundle, 4), "not json");

    expect(inspectSaveGameSlot(storage, bundle, 4)).toMatchObject({
      slot: 4,
      status: "invalid",
    });
    expect(() => readSaveGameSlot(storage, bundle, 4)).toThrow(SyntaxError);
  });

  it("rejects invalid slots, counts and malformed stored JSON", () => {
    const storage = new MemoryStorage();
    expect(() => saveGameStorageKey(bundle, -1)).toThrow(RangeError);
    expect(() => saveGameStorageKey(bundle, 100)).toThrow(RangeError);
    expect(() => listSaveGameSlots(storage, bundle, 0)).toThrow(RangeError);
    expect(() => listSaveGameSlots(storage, bundle, 101)).toThrow(RangeError);

    storage.setItem(saveGameStorageKey(bundle), "not json");
    expect(() => readSaveGameSlot(storage, bundle)).toThrow(SyntaxError);
  });

  it("scopes keys to the exact runtime bundle compatibility fingerprint", () => {
    const changed = parseRuntimeBundle({ ...bundle, title: "Storage Changed" });
    expect(saveGameStorageKey(changed)).not.toBe(saveGameStorageKey(bundle));
  });
});
