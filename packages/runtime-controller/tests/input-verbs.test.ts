import { describe, expect, it } from "vitest";
import { verbForCursorId } from "../src/input.js";

describe("cursor-to-verb fallback", () => {
  it("preserves semantic and custom action cursors", () => {
    expect(verbForCursorId("look")).toBe("look");
    expect(verbForCursorId("talk")).toBe("talk");
    expect(verbForCursorId("open")).toBe("open");
    expect(verbForCursorId("repair")).toBe("repair");
  });

  it("maps non-command cursor states to the safe use fallback", () => {
    for (const cursorId of [
      "default",
      "pointer",
      "walk",
      "inventory",
      "inventory-item",
      "invalid",
      "busy",
      "waiting",
    ]) {
      expect(verbForCursorId(cursorId)).toBe("use");
    }
  });
});
