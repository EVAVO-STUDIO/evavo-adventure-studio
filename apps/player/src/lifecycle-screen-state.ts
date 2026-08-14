import type { GameLifecycleOutcome } from "@evavo/adventure-project-schema/lifecycle";
import type { SaveGameSlotSnapshot } from "./save-storage.js";

export type GameLifecycleScreen = "root" | "load";

export interface GameLifecycleScreenState {
  readonly screen: GameLifecycleScreen;
  readonly selectedIndex: number;
}

export interface GameLifecycleScreenItem {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly detail?: string;
  readonly slot?: number;
}

export type GameLifecycleScreenCommand =
  | { readonly kind: "move-selection"; readonly delta: -1 | 1 }
  | { readonly kind: "set-selection"; readonly index: number }
  | { readonly kind: "activate" }
  | { readonly kind: "back" };

export type GameLifecycleScreenEffect =
  | { readonly kind: "load-slot"; readonly slot: number }
  | { readonly kind: "restart" }
  | { readonly kind: "title" }
  | null;

export interface GameLifecycleScreenTransition {
  readonly state: GameLifecycleScreenState;
  readonly effect: GameLifecycleScreenEffect;
}

export const createGameLifecycleScreenState = (): GameLifecycleScreenState => ({
  screen: "root",
  selectedIndex: 0,
});

const validSlot = (snapshots: readonly SaveGameSlotSnapshot[], slot: number): boolean =>
  snapshots.some((snapshot) => snapshot.slot === slot && snapshot.status === "valid");

const anyValidSlot = (snapshots: readonly SaveGameSlotSnapshot[]): boolean =>
  snapshots.some((snapshot) => snapshot.status === "valid");

const slotLabel = (slot: number): string =>
  slot === 0 ? "QUICK SAVE" : `SAVE SLOT ${slot.toString().padStart(2, "0")}`;

const slotDetail = (snapshot: SaveGameSlotSnapshot): string => {
  switch (snapshot.status) {
    case "empty":
      return "EMPTY";
    case "invalid":
      return "DAMAGED SAVE";
    case "valid":
      return `${snapshot.sceneName} • TICK ${snapshot.tick} • SCORE ${snapshot.score} • ${snapshot.inventoryCount} ITEM${snapshot.inventoryCount === 1 ? "" : "S"}`;
  }
};

export const gameLifecycleScreenItems = (
  state: GameLifecycleScreenState,
  outcome: GameLifecycleOutcome,
  snapshots: readonly SaveGameSlotSnapshot[],
): readonly GameLifecycleScreenItem[] => {
  if (state.screen === "load") {
    return [
      ...[...snapshots]
        .sort((left, right) => left.slot - right.slot)
        .map(
          (snapshot): GameLifecycleScreenItem => ({
            id: `save-slot-${snapshot.slot}`,
            label: slotLabel(snapshot.slot),
            enabled: snapshot.status === "valid",
            detail: slotDetail(snapshot),
            slot: snapshot.slot,
          }),
        ),
      { id: "back", label: outcome.menu.labels.back, enabled: true },
    ];
  }

  const items: GameLifecycleScreenItem[] = [];
  if (outcome.menu.allowQuickRetry) {
    items.push({
      id: "quick-retry",
      label: outcome.menu.labels.quickRetry,
      enabled: validSlot(snapshots, 0),
    });
  }
  if (outcome.menu.allowLoad) {
    items.push({
      id: "load",
      label: outcome.menu.labels.loadGame,
      enabled: anyValidSlot(snapshots),
    });
  }
  if (outcome.menu.allowRestart) {
    items.push({ id: "restart", label: outcome.menu.labels.restartGame, enabled: true });
  }
  if (outcome.menu.allowTitle) {
    items.push({ id: "title", label: outcome.menu.labels.returnToTitle, enabled: true });
  }
  return items;
};

const firstEnabledIndex = (items: readonly GameLifecycleScreenItem[]): number => {
  const index = items.findIndex((item) => item.enabled);
  return index < 0 ? 0 : index;
};

const normalizeSelection = (
  state: GameLifecycleScreenState,
  outcome: GameLifecycleOutcome,
  snapshots: readonly SaveGameSlotSnapshot[],
): GameLifecycleScreenState => {
  const items = gameLifecycleScreenItems(state, outcome, snapshots);
  return items[state.selectedIndex]?.enabled
    ? state
    : { ...state, selectedIndex: firstEnabledIndex(items) };
};

const openScreen = (
  screen: GameLifecycleScreen,
  outcome: GameLifecycleOutcome,
  snapshots: readonly SaveGameSlotSnapshot[],
): GameLifecycleScreenState => {
  const state: GameLifecycleScreenState = { screen, selectedIndex: 0 };
  return normalizeSelection(state, outcome, snapshots);
};

const moveSelection = (
  state: GameLifecycleScreenState,
  delta: -1 | 1,
  outcome: GameLifecycleOutcome,
  snapshots: readonly SaveGameSlotSnapshot[],
): GameLifecycleScreenState => {
  const items = gameLifecycleScreenItems(state, outcome, snapshots);
  if (items.length === 0) return state;
  let index = state.selectedIndex;
  for (let attempts = 0; attempts < items.length; attempts += 1) {
    index = (index + delta + items.length) % items.length;
    if (items[index]?.enabled) return { ...state, selectedIndex: index };
  }
  return state;
};

export const transitionGameLifecycleScreen = (
  state: GameLifecycleScreenState,
  command: GameLifecycleScreenCommand,
  outcome: GameLifecycleOutcome,
  snapshots: readonly SaveGameSlotSnapshot[],
): GameLifecycleScreenTransition => {
  const current = normalizeSelection(state, outcome, snapshots);
  if (command.kind === "move-selection") {
    return {
      state: moveSelection(current, command.delta, outcome, snapshots),
      effect: null,
    };
  }
  if (command.kind === "set-selection") {
    const item = gameLifecycleScreenItems(current, outcome, snapshots)[command.index];
    return item?.enabled
      ? { state: { ...current, selectedIndex: command.index }, effect: null }
      : { state: current, effect: null };
  }
  if (command.kind === "back") {
    return current.screen === "load"
      ? { state: openScreen("root", outcome, snapshots), effect: null }
      : { state: current, effect: null };
  }

  const item = gameLifecycleScreenItems(current, outcome, snapshots)[current.selectedIndex];
  if (!item?.enabled) return { state: current, effect: null };
  if (current.screen === "load") {
    return item.id === "back" || item.slot === undefined
      ? { state: openScreen("root", outcome, snapshots), effect: null }
      : { state: current, effect: { kind: "load-slot", slot: item.slot } };
  }

  switch (item.id) {
    case "quick-retry":
      return { state: current, effect: { kind: "load-slot", slot: 0 } };
    case "load":
      return { state: openScreen("load", outcome, snapshots), effect: null };
    case "restart":
      return { state: current, effect: { kind: "restart" } };
    case "title":
      return { state: current, effect: { kind: "title" } };
    default:
      return { state: current, effect: null };
  }
};