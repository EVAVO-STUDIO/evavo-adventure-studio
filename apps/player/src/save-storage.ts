import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  loadSaveGame,
  runtimeBundleFingerprint,
  type SaveGame,
  serializeSaveGame,
} from "@evavo/adventure-save-game";

export interface SaveGameStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class SaveGameSlotMissingError extends Error {
  readonly slot: number;

  constructor(slot: number) {
    super(`Save-game slot ${slot} is empty.`);
    this.name = "SaveGameSlotMissingError";
    this.slot = slot;
  }
}

const assertSlot = (slot: number): number => {
  if (!Number.isSafeInteger(slot) || slot < 0 || slot > 99) {
    throw new RangeError("Save-game slot must be an integer from 0 to 99.");
  }
  return slot;
};

export const saveGameStorageKey = (bundle: RuntimeBundle, slot = 0): string =>
  [
    "evavo-adventure-save",
    bundle.projectId,
    runtimeBundleFingerprint(bundle),
    `slot-${assertSlot(slot).toString().padStart(2, "0")}`,
  ].join(":");

export const writeSaveGameSlot = (
  storage: SaveGameStorage,
  bundle: RuntimeBundle,
  save: SaveGame,
  slot = 0,
): void => {
  const validated = loadSaveGame(bundle, save);
  storage.setItem(saveGameStorageKey(bundle, slot), serializeSaveGame(validated));
};

export const readSaveGameSlot = (
  storage: SaveGameStorage,
  bundle: RuntimeBundle,
  slot = 0,
): SaveGame => {
  const serialized = storage.getItem(saveGameStorageKey(bundle, slot));
  if (serialized === null) throw new SaveGameSlotMissingError(slot);
  let input: unknown;
  try {
    input = JSON.parse(serialized) as unknown;
  } catch (error) {
    throw new SyntaxError(
      `Save-game slot ${slot} does not contain valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return loadSaveGame(bundle, input);
};

export const removeSaveGameSlot = (
  storage: SaveGameStorage,
  bundle: RuntimeBundle,
  slot = 0,
): void => {
  storage.removeItem(saveGameStorageKey(bundle, slot));
};

export const hasSaveGameSlot = (
  storage: SaveGameStorage,
  bundle: RuntimeBundle,
  slot = 0,
): boolean => storage.getItem(saveGameStorageKey(bundle, slot)) !== null;

export type SaveGameSlotSnapshot =
  | {
      readonly slot: number;
      readonly status: "empty";
    }
  | {
      readonly slot: number;
      readonly status: "invalid";
      readonly message: string;
    }
  | {
      readonly slot: number;
      readonly status: "valid";
      readonly tick: number;
      readonly sceneId: string;
      readonly sceneName: string;
      readonly score: number;
      readonly inventoryCount: number;
      readonly saveFingerprint: string;
    };

export const inspectSaveGameSlot = (
  storage: SaveGameStorage,
  bundle: RuntimeBundle,
  slot: number,
): SaveGameSlotSnapshot => {
  const normalizedSlot = assertSlot(slot);
  if (!hasSaveGameSlot(storage, bundle, normalizedSlot)) {
    return { slot: normalizedSlot, status: "empty" };
  }
  try {
    const save = readSaveGameSlot(storage, bundle, normalizedSlot);
    const sceneId = save.world.story.currentSceneId;
    const sceneName = bundle.scenes.find((scene) => scene.id === sceneId)?.name ?? sceneId;
    return {
      slot: normalizedSlot,
      status: "valid",
      tick: save.world.story.tick,
      sceneId,
      sceneName,
      score: save.world.story.score,
      inventoryCount: save.world.story.inventory.length,
      saveFingerprint: save.saveFingerprint,
    };
  } catch (error) {
    return {
      slot: normalizedSlot,
      status: "invalid",
      message: error instanceof Error ? error.message : String(error),
    };
  }
};

export const listSaveGameSlots = (
  storage: SaveGameStorage,
  bundle: RuntimeBundle,
  slotCount = 10,
): readonly SaveGameSlotSnapshot[] => {
  if (!Number.isSafeInteger(slotCount) || slotCount < 1 || slotCount > 100) {
    throw new RangeError("Save-game slot count must be an integer from 1 to 100.");
  }
  return Array.from({ length: slotCount }, (_, slot) => inspectSaveGameSlot(storage, bundle, slot));
};
