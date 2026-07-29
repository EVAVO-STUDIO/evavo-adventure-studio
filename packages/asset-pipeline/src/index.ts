import type { Id, Size } from "@evavo/adventure-project-schema";
import sharp from "sharp";
import {
  countUniqueRgbaColours,
  cropRgba,
  findAlphaBounds,
  fullImageBounds,
  normalizeTransparentRgb,
  transparentPixelImage,
  type PixelBounds,
  type RgbaImage,
} from "./rgba.js";

export type ImageTrimRecipe =
  | { readonly mode: "none" }
  | { readonly mode: "alpha"; readonly threshold?: number };

export type ImageOutputRecipe =
  | { readonly mode: "rgba-png" }
  | {
      readonly mode: "indexed-png";
      readonly colours: number;
      readonly dither: number;
    };

export interface ImageCompileRecipe {
  readonly assetId: Id<"asset">;
  readonly resize?: Size;
  readonly trim?: ImageTrimRecipe;
  readonly output: ImageOutputRecipe;
}

export interface NormalizedImageCompileRecipe {
  readonly assetId: Id<"asset">;
  readonly resize: Size | null;
  readonly trim:
    | { readonly mode: "none" }
    | { readonly mode: "alpha"; readonly threshold: number };
  readonly output: ImageOutputRecipe;
}

export interface SourceImageMetadata {
  readonly format: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly channels: number | null;
  readonly isPalette: boolean | null;
  readonly bitsPerSample: number | null;
  readonly orientation: number | null;
}

export interface PreparedImage {
  readonly image: RgbaImage;
  readonly untrimmedSize: Size;
  readonly trimBounds: PixelBounds;
  readonly empty: boolean;
  readonly sourceMetadata: SourceImageMetadata;
  readonly sourceHash: string;
  readonly recipe: NormalizedImageCompileRecipe;
}

export interface CompiledImageManifest {
  readonly manifestVersion: 1;
  readonly compiler: "evavo-adventure-asset-pipeline";
  readonly assetId: Id<"asset">;
  readonly source: SourceImageMetadata & {
    readonly sha256: string;
    readonly byteLength: number;
  };
  readonly recipe: NormalizedImageCompileRecipe;
  readonly geometry: {
    readonly untrimmedSize: Size;
    readonly trimBounds: PixelBounds;
    readonly empty: boolean;
  };
  readonly output: {
    readonly format: "png";
    readonly palette: boolean;
    readonly width: number;
    readonly height: number;
    readonly colourCount: number;
    readonly byteLength: number;
    readonly sha256: string;
  };
  readonly recipeSha256: string;
}

export interface CompiledImage {
  readonly data: Uint8Array;
  readonly manifest: CompiledImageManifest;
}

const validateSize = (size: Size, label: string): void => {
  if (
    !Number.isSafeInteger(size.width) ||
    !Number.isSafeInteger(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  ) {
    throw new RangeError(`${label} dimensions must be positive safe integers.`);
  }
};

const normalizeRecipe = (
  recipe: ImageCompileRecipe,
): NormalizedImageCompileRecipe => {
  if (!recipe.assetId.trim()) {
    throw new RangeError("Compiled image asset ID cannot be empty.");
  }
  if (recipe.resize) {
    validateSize(recipe.resize, "Image resize");
  }

  const trim = recipe.trim ?? { mode: "alpha" as const, threshold: 0 };
  if (trim.mode === "alpha") {
    const threshold = trim.threshold ?? 0;
    if (!Number.isInteger(threshold) || threshold < 0 || threshold > 255) {
      throw new RangeError("Image alpha trim threshold must be an integer from 0 to 255.");
    }
  }

  if (recipe.output.mode === "indexed-png") {
    if (
      !Number.isInteger(recipe.output.colours) ||
      recipe.output.colours < 2 ||
      recipe.output.colours > 256
    ) {
      throw new RangeError("Indexed PNG colour limit must be an integer from 2 to 256.");
    }
    if (
      !Number.isFinite(recipe.output.dither) ||
      recipe.output.dither < 0 ||
      recipe.output.dither > 1
    ) {
      throw new RangeError("Indexed PNG dither must be a finite number from 0 to 1.");
    }
  }

  return {
    assetId: recipe.assetId,
    resize: recipe.resize ?? null,
    trim:
      trim.mode === "none"
        ? { mode: "none" }
        : { mode: "alpha", threshold: trim.threshold ?? 0 },
    output: recipe.output,
  };
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) =>
      left.localeCompare(right),
    )) {
      const child = source[key];
      if (child !== undefined) {
        result[key] = canonicalize(child);
      }
    }
    return result;
  }
  return value;
};

export const canonicalStringify = (value: unknown): string => {
  const output = JSON.stringify(canonicalize(value));
  if (output === undefined) {
    throw new TypeError("Value cannot be represented as canonical JSON.");
  }
  return output;
};

export const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto SHA-256 support is required by the asset compiler.");
  }
  const copy = new Uint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const metadataSnapshot = (
  metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>,
): SourceImageMetadata => ({
  format: metadata.format ?? null,
  width: metadata.width ?? null,
  height: metadata.height ?? null,
  channels: metadata.channels ?? null,
  isPalette: metadata.isPalette ?? null,
  bitsPerSample: metadata.bitsPerSample ?? null,
  orientation: metadata.orientation ?? null,
});

const decodeRawRgba = async (
  source: Uint8Array,
  resize: Size | null,
): Promise<RgbaImage> => {
  let pipeline = sharp(new Uint8Array(source), { failOn: "error" })
    .autoOrient()
    .ensureAlpha()
    .toColourspace("srgb");

  if (resize) {
    pipeline = pipeline.resize({
      width: resize.width,
      height: resize.height,
      fit: "fill",
      kernel: sharp.kernel.nearest,
    });
  }

  const raw = await pipeline.raw().toBuffer({ resolveWithObject: true });
  if (raw.info.channels !== 4) {
    throw new Error(
      `Canonical image decode produced ${raw.info.channels} channels instead of RGBA.`,
    );
  }

  return normalizeTransparentRgb({
    width: raw.info.width,
    height: raw.info.height,
    data: new Uint8Array(raw.data),
  });
};

export const prepareImage = async (
  source: Uint8Array,
  inputRecipe: ImageCompileRecipe,
): Promise<PreparedImage> => {
  if (source.byteLength === 0) {
    throw new RangeError("Image source cannot be empty.");
  }

  const recipe = normalizeRecipe(inputRecipe);
  const sourceCopy = new Uint8Array(source);
  const sourceMetadata = metadataSnapshot(
    await sharp(sourceCopy, { failOn: "error" }).metadata(),
  );
  const decoded = await decodeRawRgba(sourceCopy, recipe.resize);
  const untrimmedSize = { width: decoded.width, height: decoded.height };
  const detectedBounds =
    recipe.trim.mode === "none"
      ? fullImageBounds(decoded)
      : findAlphaBounds(decoded, recipe.trim.threshold);
  const empty = detectedBounds === null;
  const trimBounds =
    detectedBounds ?? { x: 0, y: 0, width: 1, height: 1 };
  const image = empty ? transparentPixelImage() : cropRgba(decoded, trimBounds);

  return {
    image,
    untrimmedSize,
    trimBounds,
    empty,
    sourceMetadata,
    sourceHash: await sha256Hex(sourceCopy),
    recipe,
  };
};

const encodePng = async (
  image: RgbaImage,
  output: ImageOutputRecipe,
): Promise<Uint8Array> => {
  const pipeline = sharp(new Uint8Array(image.data), {
    raw: {
      width: image.width,
      height: image.height,
      channels: 4,
    },
  });

  const encoded =
    output.mode === "indexed-png"
      ? await pipeline
          .png({
            palette: true,
            colours: output.colours,
            dither: output.dither,
            compressionLevel: 9,
            effort: 10,
            adaptiveFiltering: false,
            progressive: false,
          })
          .toBuffer()
      : await pipeline
          .png({
            palette: false,
            compressionLevel: 9,
            effort: 10,
            adaptiveFiltering: false,
            progressive: false,
          })
          .toBuffer();

  return new Uint8Array(encoded);
};

const outputColourCount = async (encoded: Uint8Array): Promise<number> =>
  countUniqueRgbaColours(await decodeRawRgba(encoded, null));

export const compileImage = async (
  source: Uint8Array,
  recipe: ImageCompileRecipe,
): Promise<CompiledImage> => {
  const prepared = await prepareImage(source, recipe);
  const data = await encodePng(prepared.image, prepared.recipe.output);
  const recipeJson = canonicalStringify(prepared.recipe);

  return {
    data,
    manifest: {
      manifestVersion: 1,
      compiler: "evavo-adventure-asset-pipeline",
      assetId: prepared.recipe.assetId,
      source: {
        ...prepared.sourceMetadata,
        sha256: prepared.sourceHash,
        byteLength: source.byteLength,
      },
      recipe: prepared.recipe,
      geometry: {
        untrimmedSize: prepared.untrimmedSize,
        trimBounds: prepared.trimBounds,
        empty: prepared.empty,
      },
      output: {
        format: "png",
        palette: prepared.recipe.output.mode === "indexed-png",
        width: prepared.image.width,
        height: prepared.image.height,
        colourCount: await outputColourCount(data),
        byteLength: data.byteLength,
        sha256: await sha256Hex(data),
      },
      recipeSha256: await sha256Hex(new TextEncoder().encode(recipeJson)),
    },
  };
};

export const encodeRgbaPng = async (
  image: RgbaImage,
  output: ImageOutputRecipe = { mode: "rgba-png" },
): Promise<Uint8Array> => encodePng(normalizeTransparentRgb(image), output);

export * from "./atlas.js";
export * from "./rgba.js";
