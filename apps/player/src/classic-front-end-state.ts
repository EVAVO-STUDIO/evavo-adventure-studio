export type ClassicFrontEndScreen =
  | "publisher-splash"
  | "title-menu"
  | "load-menu"
  | "options"
  | "credits"
  | "quit";

export interface ClassicFrontEndSaveSlot {
  readonly slot: number;
  readonly status: "empty" | "invalid" | "valid";
  readonly tick?: number;
  readonly sceneName?: string;
  readonly score?: number;
  readonly inventoryCount?: number;
  readonly message?: string;
}

export type ClassicFrontEndStartRequest =
  | { readonly kind: "new" }
  | { readonly kind: "load"; readonly slot: number };

export interface ClassicFrontEndState {
  readonly screen: ClassicFrontEndScreen;
  readonly splashTick: number;
  readonly selectedIndex: number;
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
  | { readonly kind: "back" };

export type ClassicFrontEndEffect =
  | { readonly kind: "start"; readonly request: ClassicFrontEndStartRequest }
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
  readonly detail?: string;
  readonly slot?: number;
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

export const createClassicFrontEndState = (): ClassicFrontEndState => ({
  screen: "publisher-splash",
  splashTick: 0,
  selectedIndex: 0,
});

const validSaveSlots = (slots: readonly ClassicFrontEndSaveSlot[]): readonly ClassicFrontEndSaveSlot[] =>
  slots.filter((slot) => slot.status === "valid");

const quickSaveAvailable = (slots: readonly ClassicFrontEndSaveSlot[]): boolean =>
  slots.some((slot) => slot.slot === 0 && slot.status === "valid");

const slotLabel = (slot: number, policy: ClassicFrontEndPolicy): string =>
  slot === 0 ? policy.labels.quickSave : `SAVE SLOT ${slot.toString().padStart(2, "0")}`;

const slotDetail = (slot: ClassicFrontEndSaveSlot): string => {
  switch (slot.status) {
    case "empty":
      return "EMPTY";
    case "invalid":
      return "DAMAGED SAVE";
    case "valid": {
      const scene = slot.sceneName ?? "UNKNOWN SCENE";
      const tick = slot.tick ?? 0;
      const score = slot.score ?? 0;
      const inventory = slot.inventoryCount ?? 0;
      return `${scene} • TICK ${tick} • SCORE ${score} • ${inventory} ITEM${inventory === 1 ? "" : "S"}`;
    }
  }
};

export const classicFrontEndMenuItems = (
  state: ClassicFrontEndState,
  policy: ClassicFrontEndPolicy = DEFAULT_CLASSIC_FRONT_END_POLICY,
  saveSlots: readonly ClassicFrontEndSaveSlot[] = [],
): readonly ClassicFrontEndMenuItem[] => {
  switch (state.screen) {
    case "title-menu": {
      const items: ClassicFrontEndMenuItem[] = [
        { id: "new", label: policy.labels.newGame, enabled: true },
      ];
      if (policy.showContinue) {
        items.push({
          id: "continue",
          label: policy.labels.continueGame,
          enabled: quickSaveAvailable(saveSlots),
        });
      }
      if (policy.showLoad) {
        items.push({
          id: "load",
          label: policy.labels.loadGame,
          enabled: validSaveSlots(saveSlots).length > 0,
        });
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
        ...[...saveSlots]
          .sort((left, right) => left.slot - right.slot)
          .map(
            (slot): ClassicFrontEndMenuItem => ({
              id: `save-slot-${slot.slot}`,
              label: slotLabel(slot.slot, policy),
              enabled: slot.status === "valid",
              detail: slotDetail(slot),
              slot: slot.slot,
            }),
          ),
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
  saveSlots: readonly ClassicFrontEndSaveSlot[],
): ClassicFrontEndMenuItem | null =>
  classicFrontEndMenuItems(state, policy, saveSlots)[state.selectedIndex] ?? null;

const moveSelection = (
  state: ClassicFrontEndState,
  delta: -1 | 1,
  policy: ClassicFrontEndPolicy,
  saveSlots: readonly ClassicFrontEndSaveSlot[],
): ClassicFrontEndState => {
  const items = classicFrontEndMenuItems(state, policy, saveSlots);
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
  saveSlots: readonly ClassicFrontEndSaveSlot[],
): ClassicFrontEndState => {
  const candidate = { ...state, screen, selectedIndex: 0 };
  return {
    ...candidate,
    selectedIndex: firstEnabledIndex(classicFrontEndMenuItems(candidate, policy, saveSlots)),
  };
};

const activate = (
  state: ClassicFrontEndState,
  policy: ClassicFrontEndPolicy,
  saveSlots: readonly ClassicFrontEndSaveSlot[],
): ClassicFrontEndTransition => {
  const item = selectedItem(state, policy, saveSlots);
  if (!item?.enabled) return { state, effect: null };
  switch (state.screen) {
    case "title-menu":
      switch (item.id) {
        case "new":
          return { state, effect: { kind: "start", request: { kind: "new" } } };
        case "continue":
          return { state, effect: { kind: "start", request: { kind: "load", slot: 0 } } };
        case "load":
          return { state: enterScreen(state, "load-menu", policy, saveSlots), effect: null };
        case "options":
          return { state: enterScreen(state, "options", policy, saveSlots), effect: null };
        case "credits":
          return { state: enterScreen(state, "credits", policy, saveSlots), effect: null };
        case "quit":
          return { state: enterScreen(state, "quit", policy, saveSlots), effect: null };
        default:
          return { state, effect: null };
      }
    case "load-menu":
      return item.id === "back" || item.slot === undefined
        ? { state: enterScreen(state, "title-menu", policy, saveSlots), effect: null }
        : { state, effect: { kind: "start", request: { kind: "load", slot: item.slot } } };
    case "options":
      return item.id === "fullscreen"
        ? { state, effect: { kind: "request-fullscreen" } }
        : { state: enterScreen(state, "title-menu", policy, saveSlots), effect: null };
    case "credits":
    case "quit":
      return { state: enterScreen(state, "title-menu", policy, saveSlots), effect: null };
    case "publisher-splash":
      return { state, effect: null };
  }
};

const normalizeSelection = (
  state: ClassicFrontEndState,
  policy: ClassicFrontEndPolicy,
  saveSlots: readonly ClassicFrontEndSaveSlot[],
): ClassicFrontEndState => {
  const items = classicFrontEndMenuItems(state, policy, saveSlots);
  const selected = items[state.selectedIndex];
  return selected?.enabled
    ? state
    : { ...state, selectedIndex: firstEnabledIndex(items) };
};

export const transitionClassicFrontEnd = (
  state: ClassicFrontEndState,
  command: ClassicFrontEndCommand,
  policy: ClassicFrontEndPolicy = DEFAULT_CLASSIC_FRONT_END_POLICY,
  saveSlots: readonly ClassicFrontEndSaveSlot[] = [],
): ClassicFrontEndTransition => {
  const current = normalizeSelection(state, policy, saveSlots);
  switch (command.kind) {
    case "tick": {
      if (current.screen !== "publisher-splash") return { state: current, effect: null };
      const ticks = command.ticks ?? 1;
      if (!Number.isSafeInteger(ticks) || ticks < 0) {
        throw new RangeError("Front-end tick increments must be non-negative safe integers.");
      }
      const splashTick = Math.min(policy.splashDurationTicks, current.splashTick + ticks);
      const next = { ...current, splashTick };
      return splashTick >= policy.splashDurationTicks
        ? { state: enterScreen(next, "title-menu", policy, saveSlots), effect: null }
        : { state: next, effect: null };
    }
    case "skip-splash":
      return current.screen === "publisher-splash" &&
        current.splashTick >= policy.splashSkipAfterTicks
        ? { state: enterScreen(current, "title-menu", policy, saveSlots), effect: null }
        : { state: current, effect: null };
    case "move-selection":
      return {
        state: moveSelection(current, command.delta, policy, saveSlots),
        effect: null,
      };
    case "set-selection": {
      const items = classicFrontEndMenuItems(current, policy, saveSlots);
      const item = items[command.index];
      return item?.enabled
        ? { state: { ...current, selectedIndex: command.index }, effect: null }
        : { state: current, effect: null };
    }
    case "activate":
      return activate(current, policy, saveSlots);
    case "back":
      return current.screen === "publisher-splash"
        ? transitionClassicFrontEnd(current, { kind: "skip-splash" }, policy, saveSlots)
        : current.screen === "title-menu"
          ? policy.showQuit
            ? { state: enterScreen(current, "quit", policy, saveSlots), effect: null }
            : { state: current, effect: null }
          : { state: enterScreen(current, "title-menu", policy, saveSlots), effect: null };
  }
};
