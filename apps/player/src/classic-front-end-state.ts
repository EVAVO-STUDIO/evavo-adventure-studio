export type ClassicFrontEndScreen =
  | "publisher-splash"
  | "title-menu"
  | "load-menu"
  | "options"
  | "credits"
  | "quit";

export type ClassicFrontEndStartMode = "new" | "continue";

export interface ClassicFrontEndState {
  readonly screen: ClassicFrontEndScreen;
  readonly splashTick: number;
  readonly selectedIndex: number;
  readonly hasSave: boolean;
}

export interface ClassicFrontEndPolicy {
  readonly splashDurationTicks: number;
  readonly splashSkipAfterTicks: number;
}

export type ClassicFrontEndCommand =
  | { readonly kind: "tick"; readonly ticks?: number }
  | { readonly kind: "skip-splash" }
  | { readonly kind: "move-selection"; readonly delta: -1 | 1 }
  | { readonly kind: "set-selection"; readonly index: number }
  | { readonly kind: "activate" }
  | { readonly kind: "back" }
  | { readonly kind: "set-save-available"; readonly available: boolean };

export type ClassicFrontEndEffect =
  | { readonly kind: "start"; readonly mode: ClassicFrontEndStartMode }
  | { readonly kind: "request-fullscreen" }
  | null;

export interface ClassicFrontEndTransition {
  readonly state: ClassicFrontEndState;
  readonly effect: ClassicFrontEndEffect;
}

export interface ClassicFrontEndMenuItem {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
}

export const DEFAULT_CLASSIC_FRONT_END_POLICY: ClassicFrontEndPolicy = {
  splashDurationTicks: 96,
  splashSkipAfterTicks: 18,
};

export const createClassicFrontEndState = (
  hasSave: boolean,
): ClassicFrontEndState => ({
  screen: "publisher-splash",
  splashTick: 0,
  selectedIndex: 0,
  hasSave,
});

export const classicFrontEndMenuItems = (
  state: ClassicFrontEndState,
): readonly ClassicFrontEndMenuItem[] => {
  switch (state.screen) {
    case "title-menu":
      return [
        { id: "new", label: "NEW GAME", enabled: true },
        { id: "continue", label: "CONTINUE", enabled: state.hasSave },
        { id: "load", label: "LOAD GAME", enabled: state.hasSave },
        { id: "options", label: "OPTIONS", enabled: true },
        { id: "credits", label: "CREDITS", enabled: true },
        { id: "quit", label: "QUIT", enabled: true },
      ];
    case "load-menu":
      return [
        { id: "quick-save", label: "QUICK SAVE", enabled: state.hasSave },
        { id: "back", label: "BACK", enabled: true },
      ];
    case "options":
      return [
        { id: "fullscreen", label: "TOGGLE FULLSCREEN", enabled: true },
        { id: "back", label: "BACK", enabled: true },
      ];
    case "credits":
    case "quit":
      return [{ id: "back", label: "RETURN TO TITLE", enabled: true }];
    case "publisher-splash":
      return [];
  }
};

const firstEnabledIndex = (items: readonly ClassicFrontEndMenuItem[]): number => {
  const index = items.findIndex((item) => item.enabled);
  return index < 0 ? 0 : index;
};

const selectedItem = (state: ClassicFrontEndState): ClassicFrontEndMenuItem | null =>
  classicFrontEndMenuItems(state)[state.selectedIndex] ?? null;

const moveSelection = (
  state: ClassicFrontEndState,
  delta: -1 | 1,
): ClassicFrontEndState => {
  const items = classicFrontEndMenuItems(state);
  if (items.length === 0) return state;
  let index = state.selectedIndex;
  for (let attempts = 0; attempts < items.length; attempts += 1) {
    index = (index + delta + items.length) % items.length;
    if (items[index]?.enabled) return { ...state, selectedIndex: index };
  }
  return state;
};

const enterScreen = (
  state: ClassicFrontEndState,
  screen: ClassicFrontEndScreen,
): ClassicFrontEndState => {
  const candidate = { ...state, screen, selectedIndex: 0 };
  return {
    ...candidate,
    selectedIndex: firstEnabledIndex(classicFrontEndMenuItems(candidate)),
  };
};

const activate = (state: ClassicFrontEndState): ClassicFrontEndTransition => {
  const item = selectedItem(state);
  if (!item?.enabled) return { state, effect: null };
  switch (state.screen) {
    case "title-menu":
      switch (item.id) {
        case "new":
          return { state, effect: { kind: "start", mode: "new" } };
        case "continue":
          return { state, effect: { kind: "start", mode: "continue" } };
        case "load":
          return { state: enterScreen(state, "load-menu"), effect: null };
        case "options":
          return { state: enterScreen(state, "options"), effect: null };
        case "credits":
          return { state: enterScreen(state, "credits"), effect: null };
        case "quit":
          return { state: enterScreen(state, "quit"), effect: null };
        default:
          return { state, effect: null };
      }
    case "load-menu":
      return item.id === "quick-save"
        ? { state, effect: { kind: "start", mode: "continue" } }
        : { state: enterScreen(state, "title-menu"), effect: null };
    case "options":
      return item.id === "fullscreen"
        ? { state, effect: { kind: "request-fullscreen" } }
        : { state: enterScreen(state, "title-menu"), effect: null };
    case "credits":
    case "quit":
      return { state: enterScreen(state, "title-menu"), effect: null };
    case "publisher-splash":
      return { state, effect: null };
  }
};

export const transitionClassicFrontEnd = (
  state: ClassicFrontEndState,
  command: ClassicFrontEndCommand,
  policy: ClassicFrontEndPolicy = DEFAULT_CLASSIC_FRONT_END_POLICY,
): ClassicFrontEndTransition => {
  switch (command.kind) {
    case "tick": {
      if (state.screen !== "publisher-splash") return { state, effect: null };
      const ticks = command.ticks ?? 1;
      if (!Number.isSafeInteger(ticks) || ticks < 0) {
        throw new RangeError("Front-end tick increments must be non-negative safe integers.");
      }
      const splashTick = Math.min(policy.splashDurationTicks, state.splashTick + ticks);
      const next = { ...state, splashTick };
      return splashTick >= policy.splashDurationTicks
        ? { state: enterScreen(next, "title-menu"), effect: null }
        : { state: next, effect: null };
    }
    case "skip-splash":
      return state.screen === "publisher-splash" &&
        state.splashTick >= policy.splashSkipAfterTicks
        ? { state: enterScreen(state, "title-menu"), effect: null }
        : { state, effect: null };
    case "move-selection":
      return { state: moveSelection(state, command.delta), effect: null };
    case "set-selection": {
      const items = classicFrontEndMenuItems(state);
      const item = items[command.index];
      return item?.enabled
        ? { state: { ...state, selectedIndex: command.index }, effect: null }
        : { state, effect: null };
    }
    case "activate":
      return activate(state);
    case "back":
      return state.screen === "publisher-splash"
        ? transitionClassicFrontEnd(state, { kind: "skip-splash" }, policy)
        : state.screen === "title-menu"
          ? { state: enterScreen(state, "quit"), effect: null }
          : { state: enterScreen(state, "title-menu"), effect: null };
    case "set-save-available": {
      const next = { ...state, hasSave: command.available };
      const items = classicFrontEndMenuItems(next);
      const selected = items[next.selectedIndex];
      return selected?.enabled
        ? { state: next, effect: null }
        : { state: { ...next, selectedIndex: firstEnabledIndex(items) }, effect: null };
    }
  }
};