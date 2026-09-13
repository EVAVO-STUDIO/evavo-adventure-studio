import { readFileSync } from "node:fs";
import { parseClassicFrontEndManifest } from "@evavo/adventure-project-schema/front-end";
import { describe, expect, it } from "vitest";
import {
  classicFrontEndMenuItems,
  createClassicFrontEndState,
  transitionClassicFrontEnd,
  type ClassicFrontEndPolicy,
  type ClassicFrontEndSaveSlot,
} from "../src/classic-front-end-state.js";

const frontEndUrl = new URL("../public/demos/the-red-ledger/front-end.json", import.meta.url);
const manifest = parseClassicFrontEndManifest(JSON.parse(readFileSync(frontEndUrl, "utf8")));
const policy: ClassicFrontEndPolicy = {
  splashDurationTicks: manifest.publisher.splashDurationTicks,
  splashSkipAfterTicks: manifest.publisher.splashSkipAfterTicks,
  labels: manifest.menu.labels,
  showContinue: manifest.menu.showContinue,
  showLoad: manifest.menu.showLoad,
  showOptions: manifest.menu.showOptions,
  showCredits: manifest.menu.showCredits,
  showQuit: manifest.menu.showQuit,
  allowFullscreen: manifest.options.allowFullscreen,
};

const titleState = (saves: readonly ClassicFrontEndSaveSlot[] = []) =>
  transitionClassicFrontEnd(
    createClassicFrontEndState(),
    { kind: "tick", ticks: policy.splashDurationTicks },
    policy,
    saves,
  ).state;

describe("The Red Ledger classic front end", () => {
  it("enforces the authored splash timing and exposes an honest no-save menu", () => {
    const early = transitionClassicFrontEnd(
      createClassicFrontEndState(),
      { kind: "tick", ticks: policy.splashSkipAfterTicks - 1 },
      policy,
    ).state;
    expect(transitionClassicFrontEnd(early, { kind: "skip-splash" }, policy).state.screen).toBe(
      "publisher-splash",
    );

    const skippable = transitionClassicFrontEnd(early, { kind: "tick", ticks: 1 }, policy).state;
    const title = transitionClassicFrontEnd(skippable, { kind: "skip-splash" }, policy).state;
    expect(title.screen).toBe("title-menu");

    const items = classicFrontEndMenuItems(title, policy);
    expect(items.map((item) => item.label)).toEqual([
      "OPEN THE CASE",
      "CONTINUE INVESTIGATION",
      "CASE FILES",
      "OPTIONS",
      "CREDITS",
      "QUIT",
    ]);
    expect(items.map((item) => item.enabled)).toEqual([true, false, false, true, true, true]);
    expect(transitionClassicFrontEnd(title, { kind: "activate" }, policy).effect).toEqual({
      kind: "start",
      request: { kind: "new" },
    });
  });

  it("resumes the quick save and opens compatible case files deterministically", () => {
    const saves: readonly ClassicFrontEndSaveSlot[] = [
      {
        slot: 0,
        status: "valid",
        tick: 480,
        sceneName: "The River Chapel",
        score: 50,
        inventoryCount: 2,
      },
      { slot: 2, status: "invalid", message: "Fingerprint mismatch." },
      {
        slot: 3,
        status: "valid",
        tick: 720,
        sceneName: "Black Alley",
        score: 100,
        inventoryCount: 2,
      },
    ];
    const title = titleState(saves);
    const items = classicFrontEndMenuItems(title, policy, saves);
    expect(items.find((item) => item.id === "continue")?.enabled).toBe(true);
    expect(items.find((item) => item.id === "load")?.enabled).toBe(true);

    const continueState = transitionClassicFrontEnd(
      title,
      { kind: "set-selection", index: 1 },
      policy,
      saves,
    ).state;
    expect(transitionClassicFrontEnd(continueState, { kind: "activate" }, policy, saves).effect).toEqual({
      kind: "start",
      request: { kind: "load", slot: 0 },
    });

    const loadState = transitionClassicFrontEnd(
      title,
      { kind: "set-selection", index: 2 },
      policy,
      saves,
    ).state;
    const loadMenu = transitionClassicFrontEnd(
      loadState,
      { kind: "activate" },
      policy,
      saves,
    ).state;
    expect(loadMenu.screen).toBe("load-menu");
    expect(classicFrontEndMenuItems(loadMenu, policy, saves)).toEqual([
      expect.objectContaining({ id: "save-slot-0", label: "QUICK SAVE", enabled: true, slot: 0 }),
      expect.objectContaining({ id: "save-slot-2", label: "SAVE SLOT 02", enabled: false, slot: 2 }),
      expect.objectContaining({ id: "save-slot-3", label: "SAVE SLOT 03", enabled: true, slot: 3 }),
      expect.objectContaining({ id: "back", label: "BACK", enabled: true }),
    ]);
  });
});
