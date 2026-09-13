import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { localisationManifestSchema } from "@evavo/adventure-project-schema/localisation";
import { describe, expect, it } from "vitest";
import { bitmapFontManifestSchema } from "../src/index.js";
import {
  auditLocalisedTextFit,
  localisationTextFitProfileSchema,
} from "../src/localisation.js";

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.text-fit",
  title: "Ledger",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: false,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.office",
  startEntranceId: "entrance.office",
  scenes: [
    {
      id: "scene.office",
      name: "Office",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.office",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        { id: "entrance.office", position: { x: 10, y: 170 }, facing: "east" },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  actors: [],
  dialogues: [],
  sequences: [],
  assets: [
    { id: "asset.office", path: "art/office.png", kind: "image" },
    { id: "asset.font", path: "art/font.png", kind: "image" },
  ],
  inventoryItems: [],
});

const localisation = localisationManifestSchema.parse({
  manifestVersion: 1,
  projectId: project.id,
  sourceLocale: "en-AU",
  locales: [
    {
      locale: "fr-FR",
      status: "release",
      entries: [
        { key: "project.title", text: "Le grand registre rouge" },
        { key: "scene.office.name", text: "Bureau fermé" },
        { key: "scene.office.fallback", text: "Rien ne se passe ici." },
      ],
    },
  ],
});

const fonts = bitmapFontManifestSchema.parse({
  manifestVersion: 1,
  projectId: project.id,
  fonts: [
    {
      id: "bitmap-font.ui",
      name: "UI 5px",
      atlasAssetId: "asset.font",
      lineHeight: 8,
      baseline: 7,
      spaceAdvance: 3,
      letterSpacing: 0,
      fallbackCodePoint: 63,
      glyphs: [
        {
          id: "font-glyph.question",
          codePoint: 63,
          sourceRect: { x: 0, y: 0, width: 4, height: 7 },
          bearing: { x: 0, y: -7 },
          advance: 5,
        },
        ...[..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz."].map((character, index) => ({
          id: `font-glyph.${character}.${index}`,
          codePoint: character.codePointAt(0),
          sourceRect: { x: index + 4, y: 0, width: 4, height: 7 },
          bearing: { x: 0, y: -7 },
          advance: 5,
        })),
      ],
      kernings: [],
    },
  ],
});

const profile = localisationTextFitProfileSchema.parse({
  profileVersion: 1,
  projectId: project.id,
  rules: [
    {
      id: "rule.all",
      roles: ["project-title", "scene-name", "scene-fallback"],
      fontId: "bitmap-font.ui",
      maxWidth: 20,
      maxHeight: 8,
      maxLines: 1,
      overflowSeverity: "error",
      glyphSeverity: "error",
    },
  ],
});

describe("native localisation text-fit audit", () => {
  it("reports low-resolution overflow and missing accented glyphs", () => {
    const report = auditLocalisedTextFit(project, localisation, fonts, profile);
    const codes = report.issues.map((issue) => issue.code);

    expect(codes).toContain("localised-text-overflow");
    expect(codes).toContain("localised-text-missing-glyph");
    expect(report.verified).toBe(false);
    expect(report.fitResults.every((result) => Number.isInteger(result.contentWidth))).toBe(true);
  });
});
