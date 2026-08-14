import { describe, expect, it } from "vitest";
import {
  classicFrontEndMenuItems,
  createClassicFrontEndState,
  transitionClassicFrontEnd,
} from "../src/classic-front-end-state.js";

describe("classic front-end state machine", () => {
  it("holds the publisher splash for the authored minimum and then opens the title menu", () => {
    let state = createClassicFrontEndState(false);
    state = transitionClassicFrontEnd(state, { kind: "tick", ticks: 17 }).state;
    expect(transitionClassicFrontEnd(state, { kind: "skip-splash" }).state.screen).toBe(
      "publisher-splash",
    );

    state = transitionClassicFrontEnd(state, { kind: "tick", ticks: 1 }).state;
    state = transitionClassicFrontEnd(state, { kind: "skip-splash" }).state;
    expect(state.screen).toBe("title-menu");

    state = createClassicFrontEndState(false);
    state = transitionClassicFrontEnd(state, { kind: "tick", ticks: 96 }).state;
    expect(state.screen).toBe("title-menu");
  });

  it("skips disabled save actions while preserving classic wraparound navigation", () => {
    let state = transitionClassicFrontEnd(
      createClassicFrontEndState(false),
      { kind: "tick", ticks: 96 },
    ).state;
    expect(classicFrontEndMenuItems(state).map((item) => [item.id, item.enabled])).toEqual([
      ["new", true],
      ["continue", false],
      ["load", false],
      ["options", true],
      ["credits", true],
      ["quit", true],
    ]);

    state = transitionClassicFrontEnd(state, { kind: "move-selection", delta: 1 }).state;
    expect(classicFrontEndMenuItems(state)[state.selectedIndex]?.id).toBe("options");
    state = transitionClassicFrontEnd(state, { kind: "move-selection", delta: -1 }).state;
    expect(classicFrontEndMenuItems(state)[state.selectedIndex]?.id).toBe("new");
  });

  it("offers Continue and a separate Load screen when a quick save exists", () => {
    let state = transitionClassicFrontEnd(
      createClassicFrontEndState(true),
      { kind: "tick", ticks: 96 },
    ).state;
    state = transitionClassicFrontEnd(state, { kind: "set-selection", index: 1 }).state;
    expect(transitionClassicFrontEnd(state, { kind: "activate" }).effect).toEqual({
      kind: "start",
      mode: "continue",
    });

    state = transitionClassicFrontEnd(state, { kind: "set-selection", index: 2 }).state;
    state = transitionClassicFrontEnd(state, { kind: "activate" }).state;
    expect(state.screen).toBe("load-menu");
    expect(transitionClassicFrontEnd(state, { kind: "activate" }).effect).toEqual({
      kind: "start",
      mode: "continue",
    });
  });

  it("keeps options, credits and quit inside the front-end instead of changing game state", () => {
    let state = transitionClassicFrontEnd(
      createClassicFrontEndState(false),
      { kind: "tick", ticks: 96 },
    ).state;
    state = transitionClassicFrontEnd(state, { kind: "set-selection", index: 3 }).state;
    state = transitionClassicFrontEnd(state, { kind: "activate" }).state;
    expect(state.screen).toBe("options");
    expect(transitionClassicFrontEnd(state, { kind: "activate" }).effect).toEqual({
      kind: "request-fullscreen",
    });

    state = transitionClassicFrontEnd(state, { kind: "back" }).state;
    state = transitionClassicFrontEnd(state, { kind: "set-selection", index: 4 }).state;
    state = transitionClassicFrontEnd(state, { kind: "activate" }).state;
    expect(state.screen).toBe("credits");
    state = transitionClassicFrontEnd(state, { kind: "back" }).state;
    state = transitionClassicFrontEnd(state, { kind: "set-selection", index: 5 }).state;
    state = transitionClassicFrontEnd(state, { kind: "activate" }).state;
    expect(state.screen).toBe("quit");
  });

  it("reselects a valid command if a save disappears", () => {
    let state = transitionClassicFrontEnd(
      createClassicFrontEndState(true),
      { kind: "tick", ticks: 96 },
    ).state;
    state = transitionClassicFrontEnd(state, { kind: "set-selection", index: 1 }).state;
    state = transitionClassicFrontEnd(state, {
      kind: "set-save-available",
      available: false,
    }).state;
    expect(state.selectedIndex).toBe(0);
  });
});