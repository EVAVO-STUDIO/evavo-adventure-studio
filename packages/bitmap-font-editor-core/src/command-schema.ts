import { z } from "zod";
import {
  bitmapFontDefinitionSchema,
  bitmapGlyphSchema,
  bitmapKerningSchema,
} from "@evavo/adventure-bitmap-font";
import { idSchema } from "@evavo/adventure-project-schema";
import type { BitmapFontEditorCommand } from "./index.js";

export const bitmapFontEditorCommandSchema: z.ZodType<BitmapFontEditorCommand> =
  z.lazy(() =>
    z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("batch"),
          commands: z.array(bitmapFontEditorCommandSchema).min(1),
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-font"),
          index: z.number().int().nonnegative(),
          font: bitmapFontDefinitionSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-font"),
          fontId: idSchema("bitmap-font"),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-font"),
          fontId: idSchema("bitmap-font"),
          font: bitmapFontDefinitionSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-glyph"),
          fontId: idSchema("bitmap-font"),
          index: z.number().int().nonnegative(),
          glyph: bitmapGlyphSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-glyph"),
          fontId: idSchema("bitmap-font"),
          glyphId: idSchema("font-glyph"),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-glyph"),
          fontId: idSchema("bitmap-font"),
          glyphId: idSchema("font-glyph"),
          glyph: bitmapGlyphSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-kerning"),
          fontId: idSchema("bitmap-font"),
          index: z.number().int().nonnegative(),
          kerning: bitmapKerningSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-kerning"),
          fontId: idSchema("bitmap-font"),
          leftCodePoint: z.number().int().min(0).max(0x10ffff),
          rightCodePoint: z.number().int().min(0).max(0x10ffff),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-kerning"),
          fontId: idSchema("bitmap-font"),
          leftCodePoint: z.number().int().min(0).max(0x10ffff),
          rightCodePoint: z.number().int().min(0).max(0x10ffff),
          kerning: bitmapKerningSchema,
        })
        .strict(),
    ]),
  );

export const parseBitmapFontEditorCommand = (
  input: unknown,
): BitmapFontEditorCommand => bitmapFontEditorCommandSchema.parse(input);
