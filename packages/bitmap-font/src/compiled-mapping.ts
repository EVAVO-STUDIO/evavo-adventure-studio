import type {
  AssetBuildManifest,
  CompiledAssetRecord,
} from "@evavo/adventure-asset-contract";
import type { RuntimeAssetRecord } from "@evavo/adventure-asset-contract/runtime-asset";
import type { Rectangle } from "@evavo/adventure-project-schema";
import type {
  BitmapFontManifest,
  BitmapGlyph,
} from "./index.js";

export type BitmapFontCompiledIssueCode =
  | "compiled-font-asset-missing"
  | "compiled-font-asset-kind"
  | "compiled-font-frame-missing"
  | "compiled-font-frame-rectangle-mismatch"
  | "compiled-font-image-bounds";

export interface BitmapFontCompiledIssue {
  readonly severity: "error";
  readonly code: BitmapFontCompiledIssueCode;
  readonly path: string;
  readonly message: string;
}

type FontAssetRecord = CompiledAssetRecord | RuntimeAssetRecord;
type ImageFontAsset = Extract<FontAssetRecord, { readonly kind: "image" }>;
type SpritesheetFontAsset = Extract<
  FontAssetRecord,
  { readonly kind: "spritesheet" }
>;

export interface BitmapFontAssetCollection {
  readonly assets: readonly FontAssetRecord[];
}

const addIssue = (
  issues: BitmapFontCompiledIssue[],
  code: BitmapFontCompiledIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

const sameRectangle = (left: Rectangle, right: Rectangle): boolean =>
  left.x === right.x &&
  left.y === right.y &&
  left.width === right.width &&
  left.height === right.height;

const rectangleInside = (
  rectangle: Rectangle,
  width: number,
  height: number,
): boolean =>
  rectangle.x + rectangle.width <= width &&
  rectangle.y + rectangle.height <= height;

const validateImageGlyph = (
  issues: BitmapFontCompiledIssue[],
  asset: ImageFontAsset,
  glyph: BitmapGlyph,
  path: string,
): void => {
  if (
    !rectangleInside(
      glyph.sourceRect,
      asset.metadata.width,
      asset.metadata.height,
    )
  ) {
    addIssue(
      issues,
      "compiled-font-image-bounds",
      `${path}.sourceRect`,
      `Glyph '${glyph.id}' rectangle exceeds compiled image '${asset.assetId}' dimensions ${asset.metadata.width} × ${asset.metadata.height}.`,
    );
  }
};

const validateSpritesheetGlyph = (
  issues: BitmapFontCompiledIssue[],
  asset: SpritesheetFontAsset,
  glyph: BitmapGlyph,
  path: string,
): void => {
  if (!glyph.frameId) {
    addIssue(
      issues,
      "compiled-font-frame-missing",
      `${path}.frameId`,
      `Glyph '${glyph.id}' has no frame ID for compiled spritesheet '${asset.assetId}'.`,
    );
    return;
  }
  const frame = asset.metadata.frames.find(
    (candidate) => candidate.frameId === glyph.frameId,
  );
  if (!frame) {
    addIssue(
      issues,
      "compiled-font-frame-missing",
      `${path}.frameId`,
      `Glyph '${glyph.id}' frame '${glyph.frameId}' is missing from '${asset.assetId}'.`,
    );
    return;
  }
  if (!sameRectangle(frame.sourceRect, glyph.sourceRect)) {
    addIssue(
      issues,
      "compiled-font-frame-rectangle-mismatch",
      `${path}.sourceRect`,
      `Glyph '${glyph.id}' rectangle does not match compiled frame '${frame.frameId}'.`,
    );
  }
};

export const validateCompiledBitmapFontMappings = (
  fonts: BitmapFontManifest,
  compiled: BitmapFontAssetCollection | Pick<AssetBuildManifest, "assets">,
): readonly BitmapFontCompiledIssue[] => {
  const issues: BitmapFontCompiledIssue[] = [];
  const assets = new Map(
    compiled.assets.map((asset) => [asset.assetId as string, asset] as const),
  );

  fonts.fonts.forEach((font, fontIndex) => {
    const asset = assets.get(font.atlasAssetId);
    if (!asset) {
      addIssue(
        issues,
        "compiled-font-asset-missing",
        `fonts[${fontIndex}].atlasAssetId`,
        `Compiled font atlas '${font.atlasAssetId}' is missing.`,
      );
      return;
    }
    if (asset.kind !== "image" && asset.kind !== "spritesheet") {
      addIssue(
        issues,
        "compiled-font-asset-kind",
        `fonts[${fontIndex}].atlasAssetId`,
        `Compiled font atlas '${font.atlasAssetId}' is '${asset.kind}', not an image or spritesheet.`,
      );
      return;
    }

    font.glyphs.forEach((glyph, glyphIndex) => {
      const path = `fonts[${fontIndex}].glyphs[${glyphIndex}]`;
      if (asset.kind === "image") {
        validateImageGlyph(issues, asset, glyph, path);
      } else {
        validateSpritesheetGlyph(issues, asset, glyph, path);
      }
    });
  });

  return issues;
};
