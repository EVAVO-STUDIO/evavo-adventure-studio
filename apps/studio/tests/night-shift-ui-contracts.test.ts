import { validateBitmapFontManifest } from "@evavo/adventure-bitmap-font";
import { validateUiSkinManifest } from "@evavo/adventure-ui-skin";
import { describe, expect, it } from "vitest";
import { nightShiftRuntimeProject } from "../src/night-shift-runtime-contracts.js";
import {
  nightShiftBitmapFonts,
  nightShiftUiProductionRules,
  nightShiftUiSkins,
  validateNightShiftUiContracts,
} from "../src/night-shift-ui-contracts.js";

describe("Night Shift early-SCI1 UI contracts", () => {
  it("validates the bitmap font and icon-bar skin against the runtime project", () => {
    expect(validateBitmapFontManifest(nightShiftRuntimeProject, nightShiftBitmapFonts)).toEqual([]);
    expect(validateUiSkinManifest(nightShiftRuntimeProject, nightShiftBitmapFonts, nightShiftUiSkins)).toEqual([]);
    expect(validateNightShiftUiContracts()).toEqual([]);
  });

  it("keeps the top interface compact and score-visible", () => {
    const skin = nightShiftUiSkins.skins[0]!;
    expect(skin.interactionMode).toBe("icon-bar");
    expect(skin.nativeSize).toEqual({ width: 320, height: 200 });
    expect(skin.status.rect).toEqual({ x: 0, y: 0, width: 230, height: 11 });
    expect(skin.score?.rect).toEqual({ x: 230, y: 0, width: 90, height: 11 });
    expect(skin.verbBar?.region.rect).toEqual({ x: 0, y: 11, width: 104, height: 27 });
    expect(skin.inventory?.region.rect).toEqual({ x: 104, y: 11, width: 216, height: 27 });
  });

  it("requires hand-authored icon assets for all four period verbs", () => {
    const skin = nightShiftUiSkins.skins[0]!;
    expect(skin.verbs.map((verb) => [verb.verb, verb.iconAssetId])).toEqual([
      ["walk", "asset.night-shift.ui.walk"],
      ["look", "asset.night-shift.ui.look"],
      ["use", "asset.night-shift.ui.use"],
      ["talk", "asset.night-shift.ui.talk"],
    ]);
    expect(nightShiftUiProductionRules.join(" ")).toMatch(/16×16 VGA symbols/u);
  });

  it("defines a deterministic printable ASCII bitmap-font atlas contract", () => {
    const font = nightShiftBitmapFonts.fonts[0]!;
    expect(font.id).toBe("bitmap-font.night-shift.system");
    expect(font.lineHeight).toBe(8);
    expect(font.baseline).toBe(7);
    expect(font.glyphs).toHaveLength(94);
    expect(font.glyphs.find((glyph) => glyph.codePoint === 63)?.sourceRect).toBeDefined();
    expect(font.glyphs.every((glyph) => glyph.sourceRect.width === 5 && glyph.sourceRect.height === 7)).toBe(true);
  });
});
