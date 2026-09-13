import type { Id } from "@evavo/adventure-project-schema";
import { type BitmapFontDefinition, type BitmapGlyph, glyphByCodePoint } from "./index.js";

export type BitmapTextAlignment = "left" | "center" | "right";

export interface BitmapTextLayoutOptions {
  readonly maxWidth?: number;
  readonly alignment?: BitmapTextAlignment;
  readonly lineSpacing?: number;
  readonly tabSpaces?: number;
}

export interface BitmapGlyphPlacement {
  readonly glyphId: Id<"font-glyph">;
  readonly codePoint: number;
  readonly x: number;
  readonly y: number;
  readonly glyph: BitmapGlyph;
}

export interface BitmapTextLine {
  readonly index: number;
  readonly y: number;
  readonly width: number;
  readonly placementStart: number;
  readonly placementEnd: number;
}

export interface BitmapTextLayout {
  readonly fontId: Id<"bitmap-font">;
  readonly text: string;
  readonly width: number;
  readonly height: number;
  readonly placements: readonly BitmapGlyphPlacement[];
  readonly lines: readonly BitmapTextLine[];
  readonly fallbackCodePoints: readonly number[];
}

interface MutableLine {
  readonly index: number;
  readonly y: number;
  readonly placementStart: number;
  placementEnd: number;
  width: number;
}

type TextToken =
  | { readonly kind: "newline" }
  | { readonly kind: "spaces"; readonly count: number }
  | { readonly kind: "word"; readonly codePoints: readonly number[] };

const assertLayoutOptions = (options: BitmapTextLayoutOptions): void => {
  if (options.maxWidth !== undefined && (!Number.isSafeInteger(options.maxWidth) || options.maxWidth <= 0)) {
    throw new RangeError("Bitmap text maximum width must be a positive integer.");
  }
  if (options.lineSpacing !== undefined && !Number.isSafeInteger(options.lineSpacing)) {
    throw new RangeError("Bitmap text line spacing must be an integer.");
  }
  if (
    options.tabSpaces !== undefined &&
    (!Number.isSafeInteger(options.tabSpaces) || options.tabSpaces <= 0)
  ) {
    throw new RangeError("Bitmap text tab width must be a positive integer.");
  }
};

const tokenize = (text: string, tabSpaces: number): readonly TextToken[] => {
  const tokens: TextToken[] = [];
  let word: number[] = [];
  let spaces = 0;

  const flushWord = (): void => {
    if (word.length > 0) {
      tokens.push({ kind: "word", codePoints: word });
      word = [];
    }
  };
  const flushSpaces = (): void => {
    if (spaces > 0) {
      tokens.push({ kind: "spaces", count: spaces });
      spaces = 0;
    }
  };

  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) continue;
    if (character === "\r") continue;
    if (character === "\n") {
      flushWord();
      flushSpaces();
      tokens.push({ kind: "newline" });
      continue;
    }
    if (character === " " || character === "\t") {
      flushWord();
      spaces += character === "\t" ? tabSpaces : 1;
      continue;
    }
    flushSpaces();
    word.push(codePoint);
  }
  flushWord();
  flushSpaces();
  return tokens;
};

const kerningMap = (font: BitmapFontDefinition): ReadonlyMap<string, number> =>
  new Map(font.kernings.map((entry) => [`${entry.leftCodePoint}:${entry.rightCodePoint}`, entry.adjustment]));

const kerningAdjustment = (
  kernings: ReadonlyMap<string, number>,
  left: number | null,
  right: number,
): number => (left === null ? 0 : (kernings.get(`${left}:${right}`) ?? 0));

const glyphAdvance = (font: BitmapFontDefinition, glyph: BitmapGlyph): number =>
  glyph.advance + font.letterSpacing;

const wordWidth = (
  font: BitmapFontDefinition,
  kernings: ReadonlyMap<string, number>,
  codePoints: readonly number[],
  previousCodePoint: number | null,
): number => {
  let width = 0;
  let previous = previousCodePoint;
  for (const codePoint of codePoints) {
    const glyph = glyphByCodePoint(font, codePoint);
    width += kerningAdjustment(kernings, previous, glyph.codePoint);
    width += glyphAdvance(font, glyph);
    previous = glyph.codePoint;
  }
  return Math.max(0, width - (codePoints.length > 0 ? font.letterSpacing : 0));
};

export const layoutBitmapText = (
  font: BitmapFontDefinition,
  text: string,
  options: BitmapTextLayoutOptions = {},
): BitmapTextLayout => {
  assertLayoutOptions(options);
  const alignment = options.alignment ?? "left";
  const lineSpacing = options.lineSpacing ?? 0;
  const tabSpaces = options.tabSpaces ?? 4;
  const maxWidth = options.maxWidth ?? null;
  const kernings = kerningMap(font);
  const tokens = tokenize(text, tabSpaces);
  const placements: BitmapGlyphPlacement[] = [];
  const lines: MutableLine[] = [];
  const fallbackCodePoints = new Set<number>();
  let penX = 0;
  let lineIndex = 0;
  let previousCodePoint: number | null = null;
  let currentLine: MutableLine = {
    index: 0,
    y: 0,
    placementStart: 0,
    placementEnd: 0,
    width: 0,
  };

  const finishLine = (): void => {
    currentLine.placementEnd = placements.length;
    lines.push(currentLine);
    lineIndex += 1;
    penX = 0;
    previousCodePoint = null;
    currentLine = {
      index: lineIndex,
      y: lineIndex * (font.lineHeight + lineSpacing),
      placementStart: placements.length,
      placementEnd: placements.length,
      width: 0,
    };
  };

  const placeCodePoint = (codePoint: number, allowWrap: boolean): void => {
    const directGlyph = font.glyphs.find((candidate) => candidate.codePoint === codePoint);
    const glyph = directGlyph ?? glyphByCodePoint(font, codePoint);
    if (!directGlyph) fallbackCodePoints.add(codePoint);
    const adjustment = kerningAdjustment(kernings, previousCodePoint, glyph.codePoint);
    const advance = glyphAdvance(font, glyph);
    if (allowWrap && maxWidth !== null && penX > 0 && penX + adjustment + advance > maxWidth) {
      finishLine();
      placeCodePoint(codePoint, false);
      return;
    }
    penX += adjustment;
    placements.push({
      glyphId: glyph.id,
      codePoint,
      x: penX + glyph.bearing.x,
      y: currentLine.y + font.baseline + glyph.bearing.y,
      glyph,
    });
    penX += advance;
    currentLine.width = Math.max(currentLine.width, penX - font.letterSpacing);
    previousCodePoint = glyph.codePoint;
  };

  for (const token of tokens) {
    if (token.kind === "newline") {
      finishLine();
      continue;
    }
    if (token.kind === "spaces") {
      const width = font.spaceAdvance * token.count;
      if (maxWidth !== null && penX > 0 && penX + width > maxWidth) {
        finishLine();
      } else {
        penX += width;
        currentLine.width = Math.max(currentLine.width, penX);
        previousCodePoint = null;
      }
      continue;
    }

    const measured = wordWidth(font, kernings, token.codePoints, previousCodePoint);
    if (maxWidth !== null && penX > 0 && penX + measured > maxWidth) {
      finishLine();
    }
    for (const codePoint of token.codePoints) {
      placeCodePoint(codePoint, true);
    }
  }
  finishLine();

  const contentWidth = lines.reduce((maximum, line) => Math.max(maximum, line.width), 0);
  const alignmentWidth = maxWidth ?? contentWidth;
  const alignedPlacements = placements.map((placement) => ({ ...placement }));
  for (const line of lines) {
    const offset =
      alignment === "center"
        ? Math.floor((alignmentWidth - line.width) / 2)
        : alignment === "right"
          ? alignmentWidth - line.width
          : 0;
    for (let index = line.placementStart; index < line.placementEnd; index += 1) {
      const placement = alignedPlacements[index];
      if (placement) alignedPlacements[index] = { ...placement, x: placement.x + offset };
    }
  }

  return {
    fontId: font.id,
    text,
    width: alignmentWidth,
    height: lines.length * font.lineHeight + Math.max(0, lines.length - 1) * lineSpacing,
    placements: alignedPlacements,
    lines: lines.map((line) => ({ ...line })),
    fallbackCodePoints: [...fallbackCodePoints].sort((left, right) => left - right),
  };
};
