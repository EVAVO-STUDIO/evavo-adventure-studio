import { describe, expect, it } from "vitest";
import type { SaveGameSlotSnapshot } from "../src/save-storage.js";
import {
  classicSystemMenuItems,
  createClassicSystemMenuState,
  transitionClassicSystemMenu,
} from "../src/system-menu-state.js";

const emptySlots = (): readonly SaveGameSlotSnapshot[] =>
  Array.from({ length: 10 }, (_, slot) => ({
    slot,
    status: "empty" as const,
  }));

const validSlot = (slot: number): SaveGameSlotSnapshot => ({
  slot,
  status: "valid",
  tick: 3600,
  sceneId: "scene.office",
  sceneName: "Office",
  score: 25,
  inventoryCount: 2,
  saveFingerprint: "fnv1a64:0123456789abcdef",
});

describe("classic system menu state", () => {
  it("disables Load Game when no compatible slot exists", () => {
    const state = createClassicSystemMenuState();
    const items = classicSystemMenuItems(state, emptySlots());

    expect(items.map((item) => [item.id, item.enabled])).toEqual([
      ["resume", true],
      ["save", true],
      ["load", false],
      ["options", true],
      ["title", true],
    ]);
  });

  it("opens save slots and emits the selected slot without closing the state machine", () => {
    const slots = emptySlots();
    let state = createClassicSystemMenuState();
    state = transitionClassicSystemMenu(state, { kind: "set-selection", index: 1 }, slots).state;
    state = transitionClassicSystemMenu(state, { kind: "activate" }, slots).state;
    expect(state.screen).toBe("save");

    state = transitionClassicSystemMenu(state, { kind: "set-selection", index: 4 }, slots).state;
    expect(transitionClassicSystemMenu(state, { kind: "activate" }, slots).effect).toEqual({
      kind: "save-slot",
      slot: 4,
    });
  });

  it("skips invalid load slots while preserving wraparound navigation", () => {
    const slots = [...emptySlots()];
    slots[3] = validSlot(3);
    let state = createClassicSystemMenuState();
    state = transitionClassicSystemMenu(state, { kind: "set-selection", index: 2 }, slots).state;
    state = transitionClassicSystemMenu(state, { kind: "activate" }, slots).state;
    expect(state.screen).toBe("load");
    expect(state.selectedIndex).toBe(3);

    expect(transitionClassicSystemMenu(state, { kind: "activate" }, slots).effect).toEqual({
      kind: "load-slot",
      slot: 3,
    });

    state = transitionClassicSystemMenu(state, { kind: "move-selection", delta: 1 }, slots).state;
    expect(classicSystemMenuItems(state, slots)[state.selectedIndex]?.id).toBe("back");
    state = transitionClassicSystemMenu(state, { kind: "move-selection", delta: 1 }, slots).state;
    expect(state.selectedIndex).toBe(3);
  });

  it("uses Escape as Back inside submenus and Resume at the root", () => {
    const slots = emptySlots();
    let state = createClassicSystemMenuState();
    state = transitionClassicSystemMenu(state, { kind: "set-selection", index: 3 }, slots).state;
    state = transitionClassicSystemMenu(state, { kind: "activate" }, slots).state;
    expect(state.screen).toBe("options");

    state = transitionClassicSystemMenu(state, { kind: "back" }, slots).state;
    expect(state.screen).toBe("root");
    expect(transitionClassicSystemMenu(state, { kind: "back" }, slots).effect).toEqual({
      kind: "resume",
    });
  });

  it("requires confirmation before returning to the title screen", () => {
    const slots = emptySlots();
    let state = createClassicSystemMenuState();
    state = transitionClassicSystemMenu(state, { kind: "set-selection", index: 4 }, slots).state;
    state = transitionClassicSystemMenu(state, { kind: "activate" }, slots).state;
    expect(state.screen).toBe("title-confirm");
    expect(transitionClassicSystemMenu(state, { kind: "activate" }, slots).effect).toEqual({
      kind: "return-to-title",
    });
  });
});
