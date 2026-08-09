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

export const readSaveGameSlot = (storage: SaveGameStorage, bundle: RuntimeBundle, slot = 0): SaveGame => {
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

export const removeSaveGameSlot = (storage: SaveGameStorage, bundle: RuntimeBundle, slot = 0): void => {
  storage.removeItem(saveGameStorageKey(bundle, slot));
};

export const hasSaveGameSlot = (storage: SaveGameStorage, bundle: RuntimeBundle, slot = 0): boolean =>
  storage.getItem(saveGameStorageKey(bundle, slot)) !== null;
