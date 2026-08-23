import { describe, expect, it } from "vitest";
import {
  nightShiftActorLightingPalette,
  redLedgerActorLightingPalette,
  sceneDirectorPaletteBankAtOffset,
  validateSceneDirectorPaletteSpec,
} from "../src/scene-director-palette-specs.js";

describe("Scene Director VGA palette specifications", () => {
  it("keeps Red Ledger banks non-overlapping and inside its 128-entry palette", () => {
    expect(validateSceneDirectorPaletteSpec(redLedgerActorLightingPalette)).toEqual([]);
    expect(redLedgerActorLightingPalette.banks.map((bank) => bank.offset)).toEqual([0, 64, 96]);
    expect(redLedgerActorLightingPalette.banks.every((bank) => bank.colours.length === 16)).toBe(true);
  });

  it("keeps Night Shift neutral, fluorescent and headlamp banks distinct", () => {
    expect(validateSceneDirectorPaletteSpec(nightShiftActorLightingPalette)).toEqual([]);
    expect(nightShiftActorLightingPalette.banks.map((bank) => bank.offset)).toEqual([0, 32, 64]);
    expect(sceneDirectorPaletteBankAtOffset(nightShiftActorLightingPalette, 32)?.label).toBe(
      "Station fluorescent",
    );
    expect(sceneDirectorPaletteBankAtOffset(nightShiftActorLightingPalette, 64)?.label).toBe(
      "Roadside headlamp",
    );
  });

  it("does not reuse the exact same authored bank for different production languages", () => {
    expect(redLedgerActorLightingPalette.banks[0]?.colours).not.toEqual(
      nightShiftActorLightingPalette.banks[0]?.colours,
    );
  });
});
