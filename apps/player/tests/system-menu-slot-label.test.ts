import { describe, expect, it } from "vitest";
import type { SaveGameSlotSnapshot } from "../src/save-storage.js";
import { classicSystemMenuSlotLabel } from "../src/system-menu-state.js";

describe("classic system menu save labels", () => {
  it("keeps slot timing expressed in canonical logical ticks", () => {
    const snapshot: SaveGameSlotSnapshot = {
      slot: 7,
      status: "valid",
      tick: 9137,
      sceneId: "scene.archive",
      sceneName: "Municipal Archive",
      score: 42,
      inventoryCount: 3,
      saveFingerprint: "fnv1a64:0123456789abcdef",
    };

    expect(classicSystemMenuSlotLabel(snapshot)).toBe(
      "SAVE SLOT 07  —  Municipal Archive  TICK 9137",
    );
  });

  it("distinguishes empty, damaged and quick-save slots without inspecting wall-clock time", () => {
    expect(classicSystemMenuSlotLabel({ slot: 0, status: "empty" })).toBe("QUICK SAVE  —  EMPTY");
    expect(
      classicSystemMenuSlotLabel({
        slot: 2,
        status: "invalid",
        message: "fingerprint mismatch",
      }),
    ).toBe("SAVE SLOT 02  —  DAMAGED SAVE");
  });
});
