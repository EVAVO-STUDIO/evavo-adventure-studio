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

export interface ClassicFrontEndLabels {
  readonly newGame: string;
  readonly continueGame: string;
  readonly loadGame: string;
  readonly options: string;
  readonly credits: string;
  readonly quit: string;
  readonly quickSave: string;
  readonly back: string;
  readonly fullscreen: string;
}

export interface ClassicFrontEndPolicy {
  readonly splashDurationTicks: number;
  readonly splashSkipAfterTicks: number;
  readonly labels: ClassicFrontEndLabels;
  readonly showContinue: boolean;
  readonly showLoad: boolean;
  readonly showOptions: boolean;
  readonly showCredits: boolean;
  readonly showQuit: boolean;
  readonly allowFullscreen: boolean;
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
  labels: {
    newGame: "NEW GAME",
    continueGame: "CONTINUE",
    loadGame: "LOAD GAME",
    options: "OPTIONS",
    credits: "CREDITS",
    quit: "QUIT",
    quickSave: "QUICK SAVE",
    back: "BACK",
    fullscreen: "TOGGLE FULLSCREEN",
  },
  showContinue: true,
  showLoad: true,
  showOptions: true,
  showCredits: true,
  showQuit: true,
  allowFullscreen: true,
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
  policy: ClassicFrontEndPolicy = DEFAULT_CLASSIC_FRONT_END_POLICY,
): readonly ClassicFrontEndMenuItem[] => {
  switch (state.screen) {
    case "title-menu": {
      const items: ClassicFrontEndMenuItem[] = [
        { id: "new", label: policy.labels.newGame, enabled: true },
      ];
      if (policy.showContinue) {
        items.push({ id: "continue", label: policy.labels.continueGame, enabled: state.hasSave });
      }
      if (policy.showLoad) {
        items.push({ id: "load", label: policy.labels.loadGame, enabled: state.hasSave });
      }
      if (policy.showOptions) {
        items.push({ id: "options", label: policy.labels.options, enabled: true });
      }
      if (policy.showCredits) {
        items.push({ id: "credits", label: policy.labels.credits, enabled: true });
      }
      if (policy.showQuit) {
        items.push({ id: "quit", label: policy.labels.quit, enabled: true });
      }
      return items;
    }
    case "load-menu":
      return [
        { id: "quick-save", label: policy.labels.quickSave, enabled: state.hasSave },
        { id: "back", label: policy.labels.back, enabled: true },
      ];
    case "options":
      return [
        ...(policy.allowFullscreen
          ? [{ id: "fullscreen", label: policy.labels.fullscreen, enabled: true }]
          : []),
        { id: "back", label: policy.labels.back, enabled: true },
      ];
    case "credits":
    case "quit":
      return [{ id: "back", label: policy.labels.back, enabled: true }];
    case "publisher-splash":
      return [];
  }
};

const firstEnabledIndex = (items: readonly ClassicFrontEndMenuItem[]): number => {
  const index = items.findIndex((item) => item.enabled);
  return index < 0 ? 0 : index;
};

const selectedItem = (
  state: ClassicFrontEndState,
  policy: ClassicFrontEndPolicy,
): ClassicFrontEndMenuItem | null => classicFrontEndMenuItems(state, policy)[state.selectedIndex] ?? null;

const moveSelection = (
  state: ClassicFrontEndState,
  delta: -1 | 1,
  policy: ClassicFrontEndPolicy,
): ClassicFrontEndState => {
  const items = classicFrontEndMenuItems(state, policy);
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
  policy: ClassicFrontEndPolicy,
): ClassicFrontEndState => {
  const candidate = { ...state, screen, selectedIndex: 0 };
  return {
    ...candidate,
    selectedIndex: firstEnabledIndex(classicFrontEndMenuItems(candidate, policy)),
  };
};

const activate = (
  state: ClassicFrontEndState,
  policy: ClassicFrontEndPolicy,
): ClassicFrontEndTransition => {
  const item = selectedItem(state, policy);
  if (!item?.enabled) return { state, effect: null };
  switch (state.screen) {
    case "title-menu":
      switch (item.id) {
        case "new":
          return { state, effect: { kind: "start", mode: "new" } };
        case "continue":
          return { state, effect: { kind: "start", mode: "continue" } };
        case "load":
          return { state: enterScreen(state, "load-menu", policy), effect: null };
        case "options":
          return { state: enterScreen(state, "options", policy), effect: null };
        case "credits":
          return { state: enterScreen(state, "credits", policy), effect: null };
        case "quit":
          return { state: enterScreen(state, "quit", policy), effect: null };
        default:
          return { state, effect: null };
      }
    case "load-menu":
      return item.id === "quick-save"
        ? { state, effect: { kind: "start", mode: "continue" } }
        : { state: enterScreen(state, "title-menu", policy), effect: null };
    case "options":
      return item.id === "fullscreen"
        ? { state, effect: { kind: "request-fullscreen" } }
        : { state: enterScreen(state, "title-menu", policy), effect: null };
    case "credits":
    case "quit":
      return { state: enterScreen(state, "title-menu", policy), effect: null };
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
        ? { state: enterScreen(next, "title-menu", policy), effect: null }
        : { state: next, effect: null };
    }
    case "skip-splash":
      return state.screen === "publisher-splash" &&
        state.splashTick >= policy.splashSkipAfterTicks
        ? { state: enterScreen(state, "title-menu", policy), effect: null }
        : { state, effect: null };
    case "move-selection":
      return { state: moveSelection(state, command.delta, policy), effect: null };
    case "set-selection": {
      const items = classicFrontEndMenuItems(state, policy);
      const item = items[command.index];
      return item?.enabled
        ? { state: { ...state, selectedIndex: command.index }, effect: null }
        : { state, effect: null };
    }
    case "activate":
      return activate(state, policy);
    case "back":
      return state.screen === "publisher-splash"
        ? transitionClassicFrontEnd(state, { kind: "skip-splash" }, policy)
        : state.screen === "title-menu"
          ? policy.showQuit
            ? { state: enterScreen(state, "quit", policy), effect: null }
            : { state, effect: null }
          : { state: enterScreen(state, "title-menu", policy), effect: null };
    case "set-save-available": {
      const next = { ...state, hasSave: command.available };
      const items = classicFrontEndMenuItems(next, policy);
      const selected = items[next.selectedIndex];
      return selected?.enabled
        ? { state: next, effect: null }
        : { state: { ...next, selectedIndex: firstEnabledIndex(items) }, effect: null };
    }
  }
};