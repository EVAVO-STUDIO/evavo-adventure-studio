import {
  canonicalPlayerSystemText,
  type PlayerSystemTextResolver,
} from "@evavo/adventure-project-schema/localisation";
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

const slotTitle = (slot: number, text: PlayerSystemTextResolver): string =>
  slot === 0
    ? text("slot.quick")
    : text("slot.numbered", { slot: slot.toString().padStart(2, "0") });

export const classicSystemMenuSlotLabel = (
  snapshot: SaveGameSlotSnapshot,
  text: PlayerSystemTextResolver = canonicalPlayerSystemText,
): string => {
  const title = slotTitle(snapshot.slot, text);
  if (snapshot.status === "empty") return text("slot.empty", { title });
  if (snapshot.status === "invalid") return text("slot.damaged", { title });
  return text("slot.valid", {
    title,
    scene: snapshot.sceneName,
    tick: snapshot.tick,
  });
};

const rootItems = (
  snapshots: readonly SaveGameSlotSnapshot[],
  text: PlayerSystemTextResolver,
): readonly ClassicSystemMenuItem[] => [
  { id: "resume", label: text("menu.resume"), enabled: true },
  { id: "save", label: text("menu.save"), enabled: true },
  {
    id: "load",
    label: text("menu.load"),
    enabled: snapshots.some((snapshot) => snapshot.status === "valid"),
  },
  { id: "options", label: text("menu.options"), enabled: true },
  { id: "title", label: text("menu.returnToTitle"), enabled: true },
];

const slotItems = (
  snapshots: readonly SaveGameSlotSnapshot[],
  mode: "save" | "load",
  text: PlayerSystemTextResolver,
): readonly ClassicSystemMenuItem[] => [
  ...snapshots.map((snapshot) => ({
    id: `${mode}-slot-${snapshot.slot}`,
    label: classicSystemMenuSlotLabel(snapshot, text),
    enabled: mode === "save" || snapshot.status === "valid",
    slot: snapshot.slot,
    ...(snapshot.status === "valid"
      ? {
          detail: text("slot.detail", {
            score: snapshot.score,
            count: snapshot.inventoryCount,
            itemLabel: text(
              snapshot.inventoryCount === 1 ? "slot.itemSingular" : "slot.itemPlural",
            ),
          }),
        }
      : snapshot.status === "invalid"
        ? { detail: snapshot.message }
        : {}),
  })),
  { id: "back", label: text("menu.back"), enabled: true },
];

export const classicSystemMenuItems = (
  state: ClassicSystemMenuState,
  snapshots: readonly SaveGameSlotSnapshot[],
  text: PlayerSystemTextResolver = canonicalPlayerSystemText,
): readonly ClassicSystemMenuItem[] => {
  switch (state.screen) {
    case "root":
      return rootItems(snapshots, text);
    case "save":
      return slotItems(snapshots, "save", text);
    case "load":
      return slotItems(snapshots, "load", text);
    case "options":
      return [
        { id: "fullscreen", label: text("menu.fullscreen"), enabled: true },
        { id: "back", label: text("menu.back"), enabled: true },
      ];
    case "title-confirm":
      return [
        {
          id: "confirm-title",
          label: text("menu.confirmReturnToTitle"),
          enabled: true,
        },
        {
          id: "back",
          label: text("menu.cancelReturnToTitle"),
          enabled: true,
        },
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
  text: PlayerSystemTextResolver,
): ClassicSystemMenuState => {
  const items = classicSystemMenuItems(state, snapshots, text);
  if (items[state.selectedIndex]?.enabled) return state;
  return { ...state, selectedIndex: firstEnabledIndex(items) };
};

const moveSelection = (
  state: ClassicSystemMenuState,
  snapshots: readonly SaveGameSlotSnapshot[],
  delta: -1 | 1,
  text: PlayerSystemTextResolver,
): ClassicSystemMenuState => {
  const items = classicSystemMenuItems(state, snapshots, text);
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
  text: PlayerSystemTextResolver,
): ClassicSystemMenuState => normalizedSelection(openScreen(screen), snapshots, text);

export const transitionClassicSystemMenu = (
  state: ClassicSystemMenuState,
  command: ClassicSystemMenuCommand,
  snapshots: readonly SaveGameSlotSnapshot[],
  text: PlayerSystemTextResolver = canonicalPlayerSystemText,
): ClassicSystemMenuTransition => {
  const current = normalizedSelection(state, snapshots, text);
  if (command.kind === "move-selection") {
    return { state: moveSelection(current, snapshots, command.delta, text), effect: null };
  }
  if (command.kind === "set-selection") {
    const items = classicSystemMenuItems(current, snapshots, text);
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

  const item = classicSystemMenuItems(current, snapshots, text)[current.selectedIndex];
  if (!item?.enabled) return { state: current, effect: null };

  switch (current.screen) {
    case "root":
      switch (item.id) {
        case "resume":
          return { state: current, effect: { kind: "resume" } };
        case "save":
          return { state: openNormalizedScreen("save", snapshots, text), effect: null };
        case "load":
          return { state: openNormalizedScreen("load", snapshots, text), effect: null };
        case "options":
          return { state: openNormalizedScreen("options", snapshots, text), effect: null };
        case "title":
          return {
            state: openNormalizedScreen("title-confirm", snapshots, text),
            effect: null,
          };
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
