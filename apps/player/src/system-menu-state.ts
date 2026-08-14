import type { SaveGameSlotSnapshot } from "./save-storage.js";

export type ClassicSystemMenuScreen =
  | "root"
  | "save"
  | "load"
  | "options"
  | "title-confirm";

export interface ClassicSystemMenuState {
  readonly screen: ClassicSystemMenuScreen;
  readonly selectedIndex: number;
}

export type ClassicSystemMenuCommand =
  | { readonly kind: "move-selection"; readonly delta: -1 | 1 }
  | { readonly kind: "set-selection"; readonly index: number }
  | { readonly kind: "activate" }
  | { readonly kind: "back" };

export type ClassicSystemMenuEffect =
  | null
  | { readonly kind: "resume" }
  | { readonly kind: "save-slot"; readonly slot: number }
  | { readonly kind: "load-slot"; readonly slot: number }
  | { readonly kind: "request-fullscreen" }
  | { readonly kind: "return-to-title" };

export interface ClassicSystemMenuTransition {
  readonly state: ClassicSystemMenuState;
  readonly effect: ClassicSystemMenuEffect;
}

export interface ClassicSystemMenuItem {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly slot?: number;
  readonly detail?: string;
}

export const createClassicSystemMenuState = (): ClassicSystemMenuState => ({
  screen: "root",
  selectedIndex: 0,
});

const slotTitle = (slot: number): string =>
  slot === 0 ? "QUICK SAVE" : `SAVE SLOT ${slot.toString().padStart(2, "0")}`;

export const classicSystemMenuSlotLabel = (snapshot: SaveGameSlotSnapshot): string => {
  const title = slotTitle(snapshot.slot);
  if (snapshot.status === "empty") return `${title}  —  EMPTY`;
  if (snapshot.status === "invalid") return `${title}  —  DAMAGED SAVE`;
  return `${title}  —  ${snapshot.sceneName}  TICK ${snapshot.tick}`;
};

const rootItems = (snapshots: readonly SaveGameSlotSnapshot[]): readonly ClassicSystemMenuItem[] => [
  { id: "resume", label: "RESUME GAME", enabled: true },
  { id: "save", label: "SAVE GAME", enabled: true },
  {
    id: "load",
    label: "LOAD GAME",
    enabled: snapshots.some((snapshot) => snapshot.status === "valid"),
  },
  { id: "options", label: "OPTIONS", enabled: true },
  { id: "title", label: "RETURN TO TITLE", enabled: true },
];

const slotItems = (
  snapshots: readonly SaveGameSlotSnapshot[],
  mode: "save" | "load",
): readonly ClassicSystemMenuItem[] => [
  ...snapshots.map((snapshot) => ({
    id: `${mode}-slot-${snapshot.slot}`,
    label: classicSystemMenuSlotLabel(snapshot),
    enabled: mode === "save" || snapshot.status === "valid",
    slot: snapshot.slot,
    ...(snapshot.status === "valid"
      ? {
          detail: `SCORE ${snapshot.score}  •  ${snapshot.inventoryCount} ITEM${snapshot.inventoryCount === 1 ? "" : "S"}`,
        }
      : snapshot.status === "invalid"
        ? { detail: snapshot.message }
        : {}),
  })),
  { id: "back", label: "BACK", enabled: true },
];

export const classicSystemMenuItems = (
  state: ClassicSystemMenuState,
  snapshots: readonly SaveGameSlotSnapshot[],
): readonly ClassicSystemMenuItem[] => {
  switch (state.screen) {
    case "root":
      return rootItems(snapshots);
    case "save":
      return slotItems(snapshots, "save");
    case "load":
      return slotItems(snapshots, "load");
    case "options":
      return [
        { id: "fullscreen", label: "TOGGLE FULLSCREEN", enabled: true },
        { id: "back", label: "BACK", enabled: true },
      ];
    case "title-confirm":
      return [
        { id: "confirm-title", label: "YES — RETURN TO TITLE", enabled: true },
        { id: "back", label: "NO — KEEP PLAYING", enabled: true },
      ];
  }
};

const firstEnabledIndex = (items: readonly ClassicSystemMenuItem[]): number => {
  const index = items.findIndex((item) => item.enabled);
  return index < 0 ? 0 : index;
};

const normalizedSelection = (
  state: ClassicSystemMenuState,
  snapshots: readonly SaveGameSlotSnapshot[],
): ClassicSystemMenuState => {
  const items = classicSystemMenuItems(state, snapshots);
  if (items[state.selectedIndex]?.enabled) return state;
  return { ...state, selectedIndex: firstEnabledIndex(items) };
};

const moveSelection = (
  state: ClassicSystemMenuState,
  snapshots: readonly SaveGameSlotSnapshot[],
  delta: -1 | 1,
): ClassicSystemMenuState => {
  const items = classicSystemMenuItems(state, snapshots);
  if (items.length === 0) return state;
  let index = state.selectedIndex;
  for (let attempts = 0; attempts < items.length; attempts += 1) {
    index = (index + delta + items.length) % items.length;
    if (items[index]?.enabled) return { ...state, selectedIndex: index };
  }
  return state;
};

const openScreen = (screen: ClassicSystemMenuScreen): ClassicSystemMenuState => ({
  screen,
  selectedIndex: 0,
});

const openNormalizedScreen = (
  screen: ClassicSystemMenuScreen,
  snapshots: readonly SaveGameSlotSnapshot[],
): ClassicSystemMenuState => normalizedSelection(openScreen(screen), snapshots);

export const transitionClassicSystemMenu = (
  state: ClassicSystemMenuState,
  command: ClassicSystemMenuCommand,
  snapshots: readonly SaveGameSlotSnapshot[],
): ClassicSystemMenuTransition => {
  const current = normalizedSelection(state, snapshots);
  if (command.kind === "move-selection") {
    return { state: moveSelection(current, snapshots, command.delta), effect: null };
  }
  if (command.kind === "set-selection") {
    const items = classicSystemMenuItems(current, snapshots);
    const item = items[command.index];
    return item?.enabled
      ? { state: { ...current, selectedIndex: command.index }, effect: null }
      : { state: current, effect: null };
  }
  if (command.kind === "back") {
    return current.screen === "root"
      ? { state: current, effect: { kind: "resume" } }
      : { state: openScreen("root"), effect: null };
  }

  const item = classicSystemMenuItems(current, snapshots)[current.selectedIndex];
  if (!item?.enabled) return { state: current, effect: null };

  switch (current.screen) {
    case "root":
      switch (item.id) {
        case "resume":
          return { state: current, effect: { kind: "resume" } };
        case "save":
          return { state: openNormalizedScreen("save", snapshots), effect: null };
        case "load":
          return { state: openNormalizedScreen("load", snapshots), effect: null };
        case "options":
          return { state: openNormalizedScreen("options", snapshots), effect: null };
        case "title":
          return { state: openNormalizedScreen("title-confirm", snapshots), effect: null };
        default:
          return { state: current, effect: null };
      }
    case "save":
      return item.id === "back"
        ? { state: openScreen("root"), effect: null }
        : { state: current, effect: { kind: "save-slot", slot: item.slot ?? 0 } };
    case "load":
      return item.id === "back"
        ? { state: openScreen("root"), effect: null }
        : { state: current, effect: { kind: "load-slot", slot: item.slot ?? 0 } };
    case "options":
      return item.id === "back"
        ? { state: openScreen("root"), effect: null }
        : { state: current, effect: { kind: "request-fullscreen" } };
    case "title-confirm":
      return item.id === "confirm-title"
        ? { state: current, effect: { kind: "return-to-title" } }
        : { state: openScreen("root"), effect: null };
  }
};
