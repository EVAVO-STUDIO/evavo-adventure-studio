import { bitmapFontManifestSchema, validateBitmapFontManifest } from "@evavo/adventure-bitmap-font";
import { uiSkinManifestSchema, validateUiSkinManifest } from "@evavo/adventure-ui-skin";
import { nightShiftRuntimeProject } from "./night-shift-runtime-contracts.js";

const printableCodePoints = Array.from({ length: 94 }, (_, index) => index + 33);

export const nightShiftBitmapFonts = bitmapFontManifestSchema.parse({
  manifestVersion: 1,
  projectId: nightShiftRuntimeProject.id,
  fonts: [
    {
      id: "bitmap-font.night-shift.system",
      name: "Night Shift System 5x7",
      atlasAssetId: "asset.night-shift.font.system",
      lineHeight: 8,
      baseline: 7,
      spaceAdvance: 4,
      letterSpacing: 1,
      fallbackCodePoint: 63,
      glyphs: printableCodePoints.map((codePoint, index) => ({
        id: `font-glyph.night-shift.${codePoint.toString(16).padStart(2, "0")}`,
        codePoint,
        sourceRect: {
          x: (index % 16) * 6,
          y: Math.floor(index / 16) * 8,
          width: 5,
          height: 7,
        },
        bearing: { x: 0, y: -7 },
        advance: 6,
      })),
      kernings: [],
    },
  ],
});

const panel = (fill: number, border: number, accent?: number) => ({
  fill,
  border,
  borderWidth: 1,
  ...(accent !== undefined ? { accent } : {}),
});

const region = (
  id: string,
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  fill = 0x11161b,
) => ({
  id,
  rect,
  padding: 2,
  panel: panel(fill, 0xb8b3a7, 0x6f7d86),
});

export const nightShiftUiSkins = uiSkinManifestSchema.parse({
  manifestVersion: 1,
  projectId: nightShiftRuntimeProject.id,
  defaultSkinId: "ui-skin.night-shift.early-procedural",
  skins: [
    {
      id: "ui-skin.night-shift.early-procedural",
      name: "Night Shift Early Procedural Icon Bar",
      interactionMode: "icon-bar",
      nativeSize: { width: 320, height: 200 },
      status: region("ui-region.night-shift.status", { x: 0, y: 0, width: 230, height: 11 }, 0x0b1015),
      score: region("ui-region.night-shift.score", { x: 230, y: 0, width: 90, height: 11 }, 0x0b1015),
      verbs: [
        {
          id: "ui-verb.night-shift.walk",
          verb: "walk",
          label: "WALK",
          cursorId: "walk",
          shortcut: "W",
          iconAssetId: "asset.night-shift.ui.walk",
          primary: true,
        },
        {
          id: "ui-verb.night-shift.look",
          verb: "look",
          label: "LOOK",
          cursorId: "look",
          shortcut: "L",
          iconAssetId: "asset.night-shift.ui.look",
          primary: false,
        },
        {
          id: "ui-verb.night-shift.use",
          verb: "use",
          label: "USE",
          cursorId: "use",
          shortcut: "U",
          iconAssetId: "asset.night-shift.ui.use",
          primary: false,
        },
        {
          id: "ui-verb.night-shift.talk",
          verb: "talk",
          label: "TALK",
          cursorId: "talk",
          shortcut: "T",
          iconAssetId: "asset.night-shift.ui.talk",
          primary: false,
        },
      ],
      verbBar: {
        region: region("ui-region.night-shift.verbs", { x: 0, y: 11, width: 104, height: 27 }, 0x151b20),
        orientation: "horizontal",
        gap: 2,
        buttonHeight: 23,
        normal: panel(0x252d33, 0xb8b3a7),
        hover: panel(0x35424a, 0xd9d4c8),
        pressed: panel(0x0c1115, 0xe5dfd3),
        disabled: panel(0x171b1e, 0x555a5d),
      },
      inventory: {
        region: region("ui-region.night-shift.inventory", { x: 104, y: 11, width: 216, height: 27 }, 0x10161a),
        slotWidth: 20,
        slotHeight: 20,
        gap: 2,
        visibleSlots: 8,
        slot: panel(0x1d252a, 0x777d7f),
        selected: panel(0x34434b, 0xd8d4c8),
      },
      fonts: {
        status: {
          fontId: "bitmap-font.night-shift.system",
          color: 0xe3dfd6,
          align: "left",
        },
        verb: {
          fontId: "bitmap-font.night-shift.system",
          color: 0xe3dfd6,
          align: "center",
        },
        inventory: {
          fontId: "bitmap-font.night-shift.system",
          color: 0xd5d2ca,
          align: "center",
        },
        score: {
          fontId: "bitmap-font.night-shift.system",
          color: 0xe3dfd6,
          align: "right",
        },
      },
    },
  ],
});

export const validateNightShiftUiContracts = (): readonly string[] => [
  ...validateBitmapFontManifest(nightShiftRuntimeProject, nightShiftBitmapFonts).map(
    (issue) => `${issue.code}: ${issue.message}`,
  ),
  ...validateUiSkinManifest(nightShiftRuntimeProject, nightShiftBitmapFonts, nightShiftUiSkins).map(
    (issue) => `${issue.code}: ${issue.message}`,
  ),
];

export const nightShiftUiProductionRules = [
  "Keep the top interface compact enough that the room still reads as a 320×200 scene, not a modern HUD.",
  "Icons must read as hand-authored 16×16 VGA symbols with hard pixel edges and no vector antialiasing.",
  "Use the bitmap font at native scale only; never substitute a browser/system font in packaged play.",
  "Score remains visible because procedural performance is part of the early-SCI1 feedback language.",
  "Status text is terse narration/feedback, not modern mission or objective copy.",
] as const;
