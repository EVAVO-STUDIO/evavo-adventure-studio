import { z } from "zod";
import {
  idSchema,
  rectangleSchema,
  type AdventureProject,
  type Id,
} from "@evavo/adventure-project-schema";

const metricPointSchema = z
  .object({
    x: z.number().int(),
    y: z.number().int(),
  })
  .strict();

export const bitmapGlyphSchema = z
  .object({
    id: idSchema("font-glyph"),
    codePoint: z.number().int().min(0).max(0x10ffff),
    frameId: idSchema("sprite-frame").optional(),
    sourceRect: rectangleSchema,
    bearing: metricPointSchema,
    advance: z.number().int().nonnegative(),
  })
  .strict();
export type BitmapGlyph = z.infer<typeof bitmapGlyphSchema>;

export const bitmapKerningSchema = z
  .object({
    leftCodePoint: z.number().int().min(0).max(0x10ffff),
    rightCodePoint: z.number().int().min(0).max(0x10ffff),
    adjustment: z.number().int(),
  })
  .strict();
export type BitmapKerning = z.infer<typeof bitmapKerningSchema>;

export const bitmapFontDefinitionSchema = z
  .object({
    id: idSchema("bitmap-font"),
    name: z.string().min(1),
    atlasAssetId: idSchema("asset"),
    lineHeight: z.number().int().positive(),
    baseline: z.number().int().nonnegative(),
    spaceAdvance: z.number().int().positive(),
    letterSpacing: z.number().int().default(0),
    fallbackCodePoint: z.number().int().min(0).max(0x10ffff),
    glyphs: z.array(bitmapGlyphSchema).min(1),
    kernings: z.array(bitmapKerningSchema).default([]),
  })
  .strict();
export type BitmapFontDefinition = z.infer<
  typeof bitmapFontDefinitionSchema
>;

export const bitmapFontManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    fonts: z.array(bitmapFontDefinitionSchema).min(1),
  })
  .strict();
export type BitmapFontManifest = z.infer<typeof bitmapFontManifestSchema>;

export const parseBitmapFontManifest = (input: unknown): BitmapFontManifest =>
  bitmapFontManifestSchema.parse(input);

export type BitmapFontIssueCode =
  | "font-project-mismatch"
  | "duplicate-font-id"
  | "duplicate-glyph-id"
  | "duplicate-code-point"
  | "duplicate-kerning-pair"
  | "missing-fallback-glyph"
  | "font-baseline-outside-line"
  | "missing-font-atlas"
  | "invalid-font-atlas-kind"
  | "missing-glyph-frame-id"
  | "unexpected-glyph-frame-id"
  | "kerning-glyph-missing";

export interface BitmapFontIssue {
  readonly severity: "error";
  readonly code: BitmapFontIssueCode;
  readonly path: string;
  readonly message: string;
}

const addIssue = (
  issues: BitmapFontIssue[],
  code: BitmapFontIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

const pairKey = (left: number, right: number): string =>
  `${left.toString(16)}:${right.toString(16)}`;

export const validateBitmapFontManifest = (
  project: Pick<AdventureProject, "id" | "assets">,
  manifest: BitmapFontManifest,
): readonly BitmapFontIssue[] => {
  const issues: BitmapFontIssue[] = [];
  if (manifest.projectId !== project.id) {
    addIssue(
      issues,
      "font-project-mismatch",
      "projectId",
      `Bitmap font project '${manifest.projectId}' does not match '${project.id}'.`,
    );
  }

  const assets = new Map(
    project.assets.map((asset) => [asset.id as string, asset] as const),
  );
  const fontIds = new Set<string>();
  const globalGlyphIds = new Set<string>();

  manifest.fonts.forEach((font, fontIndex) => {
    const fontPath = `fonts[${fontIndex}]`;
    if (fontIds.has(font.id)) {
      addIssue(
        issues,
        "duplicate-font-id",
        `${fontPath}.id`,
        `Bitmap font '${font.id}' is duplicated.`,
      );
    }
    fontIds.add(font.id);

    if (font.baseline > font.lineHeight) {
      addIssue(
        issues,
        "font-baseline-outside-line",
        `${fontPath}.baseline`,
        `Font baseline ${font.baseline} exceeds line height ${font.lineHeight}.`,
      );
    }

    const atlas = assets.get(font.atlasAssetId);
    if (!atlas) {
      addIssue(
        issues,
        "missing-font-atlas",
        `${fontPath}.atlasAssetId`,
        `Font '${font.id}' references missing atlas '${font.atlasAssetId}'.`,
      );
    } else if (atlas.kind !== "image" && atlas.kind !== "spritesheet") {
      addIssue(
        issues,
        "invalid-font-atlas-kind",
        `${fontPath}.atlasAssetId`,
        `Font atlas '${atlas.id}' is '${atlas.kind}', not an image or spritesheet.`,
      );
    }

    const codePoints = new Set<number>();
    font.glyphs.forEach((glyph, glyphIndex) => {
      const glyphPath = `${fontPath}.glyphs[${glyphIndex}]`;
      if (globalGlyphIds.has(glyph.id)) {
        addIssue(
          issues,
          "duplicate-glyph-id",
          `${glyphPath}.id`,
          `Glyph ID '${glyph.id}' is already used by another font.`,
        );
      }
      globalGlyphIds.add(glyph.id);
      if (codePoints.has(glyph.codePoint)) {
        addIssue(
          issues,
          "duplicate-code-point",
          `${glyphPath}.codePoint`,
          `Font '${font.id}' declares U+${glyph.codePoint
            .toString(16)
            .toUpperCase()} more than once.`,
        );
      }
      codePoints.add(glyph.codePoint);

      if (atlas?.kind === "spritesheet" && !glyph.frameId) {
        addIssue(
          issues,
          "missing-glyph-frame-id",
          `${glyphPath}.frameId`,
          `Glyph '${glyph.id}' requires a frame ID for spritesheet atlas '${atlas.id}'.`,
        );
      }
      if (atlas?.kind === "image" && glyph.frameId) {
        addIssue(
          issues,
          "unexpected-glyph-frame-id",
          `${glyphPath}.frameId`,
          `Glyph '${glyph.id}' cannot declare a frame ID for image atlas '${atlas.id}'.`,
        );
      }
    });

    if (!codePoints.has(font.fallbackCodePoint)) {
      addIssue(
        issues,
        "missing-fallback-glyph",
        `${fontPath}.fallbackCodePoint`,
        `Font '${font.id}' fallback U+${font.fallbackCodePoint
          .toString(16)
          .toUpperCase()} is not present.`,
      );
    }

    const kerningPairs = new Set<string>();
    font.kernings.forEach((kerning, kerningIndex) => {
      const kerningPath = `${fontPath}.kernings[${kerningIndex}]`;
      const key = pairKey(kerning.leftCodePoint, kerning.rightCodePoint);
      if (kerningPairs.has(key)) {
        addIssue(
          issues,
          "duplicate-kerning-pair",
          kerningPath,
          `Kerning pair '${key}' is duplicated.`,
        );
      }
      kerningPairs.add(key);
      if (
        !codePoints.has(kerning.leftCodePoint) ||
        !codePoints.has(kerning.rightCodePoint)
      ) {
        addIssue(
          issues,
          "kerning-glyph-missing",
          kerningPath,
          `Kerning pair '${key}' references a missing glyph.`,
        );
      }
    });
  });

  return issues;
};

export const bitmapFontById = (
  manifest: BitmapFontManifest,
  fontId: Id<"bitmap-font">,
): BitmapFontDefinition => {
  const font = manifest.fonts.find((candidate) => candidate.id === fontId);
  if (!font) throw new Error(`Bitmap font '${fontId}' does not exist.`);
  return font;
};

export const glyphByCodePoint = (
  font: BitmapFontDefinition,
  codePoint: number,
): BitmapGlyph => {
  const glyph =
    font.glyphs.find((candidate) => candidate.codePoint === codePoint) ??
    font.glyphs.find(
      (candidate) => candidate.codePoint === font.fallbackCodePoint,
    );
  if (!glyph) {
    throw new Error(`Bitmap font '${font.id}' has no fallback glyph.`);
  }
  return glyph;
};
