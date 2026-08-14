import { describe, expect, it } from "vitest";
import {
  classicFrontEndMenuItems,
  createClassicFrontEndState,
  DEFAULT_CLASSIC_FRONT_END_POLICY,
  transitionClassicFrontEnd,
  type ClassicFrontEndSaveSlot,
} from "../src/classic-front-end-state.js";

const emptySlots = (): readonly ClassicFrontEndSaveSlot[] =>
  Array.from({ length: 10 }, (_, slot) => ({ slot, status: "empty" as const }));

const withValidSlot = (
  slot: number,
  overrides: Partial<ClassicFrontEndSaveSlot> = {},
): readonly ClassicFrontEndSaveSlot[] =>
  emptySlots().map((candidate) =>
    candidate.slot === slot
      ? {
          slot,
          status: "valid" as const,
          tick: 480 + slot,
          sceneName: "Municipal Archive",
          score: 12,
          inventoryCount: 2,
          ...overrides,
        }
      : candidate,
  );

const titleState = (slots: readonly ClassicFrontEndSaveSlot[]) =>
  transitionClassicFrontEnd(
    createClassicFrontEndState(),
    { kind: "tick", ticks: 96 },
    DEFAULT_CLASSIC_FRONT_END_POLICY,
    slots,
  ).state;

describe("classic front-end state machine", () => {
  it("holds the publisher splash for the authored minimum and then opens the title menu", () => {
    const slots = emptySlots();
    let state = createClassicFrontEndState();
    state = transitionClassicFrontEnd(state, { kind: "tick", ticks: 17 }, undefined, slots).state;
    expect(
      transitionClassicFrontEnd(state, { kind: "skip-splash" }, undefined, slots).state.screen,
    ).toBe("publisher-splash");

    state = transitionClassicFrontEnd(state, { kind: "tick", ticks: 1 }, undefined, slots).state;
    state = transitionClassicFrontEnd(state, { kind: "skip-splash" }, undefined, slots).state;
    expect(state.screen).toBe("title-menu");
  });

  it("disables Continue and Load when there are no validated saves", () => {
    const slots = emptySlots();
    const state = titleState(slots);
    expect(classicFrontEndMenuItems(state, undefined, slots).map((item) => [item.id, item.enabled])).toEqual([
      ["new", true],
      ["continue", false],
      ["load", false],
      ["options", true],
      ["credits", true],
      ["quit", true],
    ]);
  });

  it("uses slot zero for Continue and does not accept a damaged quick save", () => {
    const validQuick = withValidSlot(0);
    let state = titleState(validQuick);
    state = transitionClassicFrontEnd(
      state,
      { kind: "set-selection", index: 1 },
      undefined,
      validQuick,
    ).state;
    expect(transitionClassicFrontEnd(state, { kind: "activate" }, undefined, validQuick).effect).toEqual({
      kind: "start",
      request: { kind: "load", slot: 0 },
    });

    const damagedQuick = emptySlots().map((slot) =>
      slot.slot === 0 ? { slot: 0, status: "invalid" as const, message: "bad checksum" } : slot,
    );
    state = titleState(damagedQuick);
    expect(classicFrontEndMenuItems(state, undefined, damagedQuick)[1]?.enabled).toBe(false);
  });

  it("opens Load for valid manual slots even when Quick Save is empty", () => {
    const slots = withValidSlot(7);
    let state = titleState(slots);
    const titleItems = classicFrontEndMenuItems(state, undefined, slots);
    expect(titleItems.find((item) => item.id === "continue")?.enabled).toBe(false);
    expect(titleItems.find((item) => item.id === "load")?.enabled).toBe(true);

    const loadIndex = titleItems.findIndex((item) => item.id === "load");
    state = transitionClassicFrontEnd(
      state,
      { kind: "set-selection", index: loadIndex },
      undefined,
      slots,
    ).state;
    state = transitionClassicFrontEnd(state, { kind: "activate" }, undefined, slots).state;
    expect(state.screen).toBe("load-menu");

    const items = classicFrontEndMenuItems(state, undefined, slots);
    expect(items).toHaveLength(11);
    expect(items[7]).toMatchObject({
      id: "save-slot-7",
      label: "SAVE SLOT 07",
      enabled: true,
      slot: 7,
    });
    expect(items[7]?.detail).toContain("Municipal Archive");

    state = transitionClassicFrontEnd(state, { kind: "set-selection", index: 7 }, undefined, slots).state;
    expect(transitionClassicFrontEnd(state, { kind: "activate" }, undefined, slots).effect).toEqual({
      kind: "start",
      request: { kind: "load", slot: 7 },
    });
  });

  it("keeps empty and damaged slots visible but non-loadable", () => {
    const slots = emptySlots().map((slot) =>
      slot.slot === 3 ? { slot: 3, status: "invalid" as const, message: "corrupt" } : slot,
    );
    let state = titleState(withValidSlot(1));
    const valid = withValidSlot(1);
    const loadIndex = classicFrontEndMenuItems(state, undefined, valid).findIndex((item) => item.id === "load");
    state = transitionClassicFrontEnd(state, { kind: "set-selection", index: loadIndex }, undefined, valid).state;
    state = transitionClassicFrontEnd(state, { kind: "activate" }, undefined, valid).state;

    const items = classicFrontEndMenuItems(state, undefined, slots);
    expect(items[0]).toMatchObject({ enabled: false, detail: "EMPTY" });
    expect(items[3]).toMatchObject({ enabled: false, detail: "DAMAGED SAVE" });
  });

  it("honours authored menu visibility, wording, timing and fullscreen policy", () => {
    const policy = {
      ...DEFAULT_CLASSIC_FRONT_END_POLICY,
      splashDurationTicks: 30,
      splashSkipAfterTicks: 4,
      labels: {
        ...DEFAULT_CLASSIC_FRONT_END_POLICY.labels,
        newGame: "BEGIN CASE",
        credits: "WHO MADE THIS",
      },
      showContinue: false,
      showLoad: false,
      showOptions: true,
      showCredits: true,
      showQuit: false,
      allowFullscreen: false,
    };
    const slots = withValidSlot(0);
    let state = createClassicFrontEndState();
    state = transitionClassicFrontEnd(state, { kind: "tick", ticks: 30 }, policy, slots).state;

    expect(classicFrontEndMenuItems(state, policy, slots).map((item) => [item.id, item.label])).toEqual([
      ["new", "BEGIN CASE"],
      ["options", "OPTIONS"],
      ["credits", "WHO MADE THIS"],
    ]);

    state = transitionClassicFrontEnd(state, { kind: "set-selection", index: 1 }, policy, slots).state;
    state = transitionClassicFrontEnd(state, { kind: "activate" }, policy, slots).state;
    expect(state.screen).toBe("options");
    expect(classicFrontEndMenuItems(state, policy, slots).map((item) => item.id)).toEqual(["back"]);
  });
});