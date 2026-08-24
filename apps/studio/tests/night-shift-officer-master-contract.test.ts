import { describe, expect, it } from "vitest";
import {
  nightShiftOfficerMasterContract,
  nightShiftOfficerMasterSlots,
  nightShiftOfficerReviewGuide,
  nightShiftOfficerReviewGuidePngBytes,
  validateNightShiftOfficerMasterContract,
} from "../src/night-shift-officer-master-contract.js";

const pngDimensions = (bytes: Uint8Array): { width: number; height: number } => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

describe("Night Shift officer master contract", () => {
  it("locks the exact 264x50 twelve-slot production strip", () => {
    expect(validateNightShiftOfficerMasterContract()).toEqual([]);
    expect(nightShiftOfficerMasterContract).toMatchObject({
      masterSize: { width: 264, height: 50 },
      horizontalStride: 22,
      horizontalGutter: 2,
      frameCount: 12,
    });
    expect(nightShiftOfficerMasterSlots.map((slot) => slot.x)).toEqual([
      0, 22, 44, 66, 88, 110, 132, 154, 176, 198, 220, 242,
    ]);
    expect(nightShiftOfficerMasterSlots.filter((slot) => slot.role === "walk")).toHaveLength(8);
  });

  it("retains left/right planted-foot contact markers and stable native anchors", () => {
    const contacts = nightShiftOfficerMasterSlots.filter((slot) => slot.footContact !== null);
    expect(contacts.map((slot) => slot.footContact)).toEqual(["left", "right"]);
    expect(nightShiftOfficerMasterSlots.every((slot) => slot.footPoint.x === 12 && slot.footPoint.y === 49)).toBe(true);
    expect(nightShiftOfficerMasterSlots.every((slot) => slot.pivot.x === 12 && slot.pivot.y === 49)).toBe(true);
    expect(nightShiftOfficerMasterSlots.every((slot) => slot.shadowAnchor?.x === 12 && slot.shadowAnchor?.y === 48)).toBe(true);
  });

  it("produces a deterministic native review guide that is never a runtime asset", () => {
    const first = nightShiftOfficerReviewGuidePngBytes();
    const second = nightShiftOfficerReviewGuidePngBytes();
    expect(first).toEqual(second);
    expect(pngDimensions(first)).toEqual({ width: 264, height: 50 });
    expect(nightShiftOfficerReviewGuide.fileName).toBe("night-shift.officer-master-guide.png");
    expect(nightShiftOfficerReviewGuide.purpose).toContain("Non-runtime");
  });
});
