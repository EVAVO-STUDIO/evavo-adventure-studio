import type {
  Id,
  Point,
  Rectangle,
  Size,
} from "@evavo/adventure-project-schema";
import sharp from "sharp";
import type { ImageOutputRecipe } from "./index.js";
import {
  composeAtlasPage,
  packAtlas,
  type AtlasPackOptions,
  type AtlasPageLayout,
} from "./atlas.js";
import {
  normalizeTransparentRgb,
  type RgbaImage,
} from "./rgba.js";

export interface AtlasSourceFrame {
  readonly id: Id<"sprite-frame">;
  readonly image: RgbaImage;
  readonly originalSize: Size;
  readonly trimOffset: Point;
}

export interface AtlasCompileOptions extends AtlasPackOptions {
  readonly output?: ImageOutputRecipe;
  readonly pageNamePrefix?: string;
}

export interface AtlasPageArtifact {
  readonly index: number;
  readonly fileName: string;
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
  readonly sha256: string;
}

export interface AtlasFrameRecord {
  readonly frameId: Id<"sprite-frame">;
  readonly pageIndex: number;
  readonly sourceRect: Rectangle;
  readonly originalSize: Size;
  readonly trimOffset: Point;
  readonly padding: number;
}

export interface AtlasManifest {
  readonly manifestVersion: 1;
  readonly compiler: "evavo-adventure-asset-pipeline";
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly padding: number;
  readonly output: ImageOutputRecipe;
  readonly pages: readonly {
    readonly index: number;
    readonly fileName: string;
    readonly width: number;
    readonly height: number;
    readonly byteLength: number;
    readonly sha256: string;
  }[];
  readonly frames: readonly AtlasFrameRecord[];
  readonly sha256: string;
}

export interface CompiledAtlas {
  readonly pages: readonly AtlasPageArtifact[];
  readonly manifest: AtlasManifest;
}

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

const canonicalStringify = (value: unknown): string => {
  const output = JSON.stringify(canonicalize(value));
  if (output === undefined) {
    throw new TypeError("Atlas manifest cannot be represented as canonical JSON.");
  }
  return output;
};

const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto SHA-256 support is required by the atlas compiler.");
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(bytes),
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const normalizeOutput = (
  output: ImageOutputRecipe | undefined,
): ImageOutputRecipe => {
  const resolved = output ?? { mode: "rgba-png" as const };
  if (resolved.mode === "indexed-png") {
    if (
      !Number.isInteger(resolved.colours) ||
      resolved.colours < 2 ||
      resolved.colours > 256
    ) {
      throw new RangeError("Atlas indexed PNG colour limit must be from 2 to 256.");
    }
    if (
      !Number.isFinite(resolved.dither) ||
      resolved.dither < 0 ||
      resolved.dither > 1
    ) {
      throw new RangeError("Atlas indexed PNG dither must be from 0 to 1.");
    }
  }
  return resolved;
};

const encodePng = async (
  image: RgbaImage,
  output: ImageOutputRecipe,
): Promise<Uint8Array> => {
  const normalized = normalizeTransparentRgb(image);
  const pipeline = sharp(new Uint8Array(normalized.data), {
    raw: {
      width: normalized.width,
      height: normalized.height,
      channels: 4,
    },
  });

  const data =
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

  return new Uint8Array(data);
};

const normalizePagePrefix = (value: string | undefined): string => {
  const prefix = (value ?? "atlas").trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  if (!prefix) {
    throw new RangeError("Atlas page name prefix cannot be empty.");
  }
  return prefix;
};

const pageFileName = (prefix: string, index: number): string =>
  `${prefix}-${index.toString().padStart(3, "0")}.png`;

const assertSourceFrames = (frames: readonly AtlasSourceFrame[]): void => {
  const ids = new Set<string>();
  for (const frame of frames) {
    if (ids.has(frame.id)) {
      throw new Error(`Atlas source frame '${frame.id}' is duplicated.`);
    }
    ids.add(frame.id);
    if (
      frame.originalSize.width < frame.image.width + frame.trimOffset.x ||
      frame.originalSize.height < frame.image.height + frame.trimOffset.y ||
      frame.trimOffset.x < 0 ||
      frame.trimOffset.y < 0
    ) {
      throw new RangeError(
        `Atlas source frame '${frame.id}' does not fit its original geometry.`,
      );
    }
  }
};

const frameRecords = (
  layouts: readonly AtlasPageLayout[],
  frames: ReadonlyMap<string, AtlasSourceFrame>,
): readonly AtlasFrameRecord[] =>
  layouts
    .flatMap((layout) =>
      layout.placements.map((placement) => {
        const frame = frames.get(placement.id);
        if (!frame) {
          throw new Error(`Atlas source frame '${placement.id}' is missing.`);
        }
        return {
          frameId: frame.id,
          pageIndex: placement.pageIndex,
          sourceRect: {
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
          },
          originalSize: frame.originalSize,
          trimOffset: frame.trimOffset,
          padding: placement.padding,
        } satisfies AtlasFrameRecord;
      }),
    )
    .sort((left, right) => left.frameId.localeCompare(right.frameId));

export const compileAtlas = async (
  sourceFrames: readonly AtlasSourceFrame[],
  options: AtlasCompileOptions,
): Promise<CompiledAtlas> => {
  assertSourceFrames(sourceFrames);
  const output = normalizeOutput(options.output);
  const prefix = normalizePagePrefix(options.pageNamePrefix);
  const frames = new Map(
    sourceFrames.map((frame) => [frame.id as string, frame]),
  );
  const images = new Map(
    sourceFrames.map((frame) => [frame.id as string, frame.image]),
  );
  const layouts = packAtlas(
    sourceFrames.map((frame) => ({
      id: frame.id,
      width: frame.image.width,
      height: frame.image.height,
    })),
    options,
  );

  const pages: AtlasPageArtifact[] = [];
  for (const layout of layouts) {
    const data = await encodePng(composeAtlasPage(layout, images), output);
    pages.push({
      index: layout.index,
      fileName: pageFileName(prefix, layout.index),
      width: layout.width,
      height: layout.height,
      data,
      sha256: await sha256Hex(data),
    });
  }

  const framesManifest = frameRecords(layouts, frames);
  const manifestWithoutHash = {
    manifestVersion: 1 as const,
    compiler: "evavo-adventure-asset-pipeline" as const,
    pageWidth: options.pageWidth,
    pageHeight: options.pageHeight,
    padding: options.padding,
    output,
    pages: pages.map((page) => ({
      index: page.index,
      fileName: page.fileName,
      width: page.width,
      height: page.height,
      byteLength: page.data.byteLength,
      sha256: page.sha256,
    })),
    frames: framesManifest,
  };
  const sha256 = await sha256Hex(
    new TextEncoder().encode(canonicalStringify(manifestWithoutHash)),
  );

  return {
    pages,
    manifest: { ...manifestWithoutHash, sha256 },
  };
};
