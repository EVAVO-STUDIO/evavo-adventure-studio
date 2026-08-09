import { assertRgbaImage, blitRgba, extrudeRgba, type RgbaImage } from "./rgba.js";

export interface AtlasFrameRequest {
  readonly id: string;
  readonly width: number;
  readonly height: number;
}

export interface AtlasPackOptions {
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly padding: number;
}

export interface AtlasPlacement {
  readonly id: string;
  readonly pageIndex: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly padding: number;
  readonly outerX: number;
  readonly outerY: number;
  readonly outerWidth: number;
  readonly outerHeight: number;
}

export interface AtlasPageLayout {
  readonly index: number;
  readonly width: number;
  readonly height: number;
  readonly placements: readonly AtlasPlacement[];
}

interface MutableShelf {
  readonly y: number;
  readonly height: number;
  x: number;
}

interface MutablePage {
  readonly index: number;
  readonly shelves: MutableShelf[];
  readonly placements: AtlasPlacement[];
}

const assertPackOptions = (options: AtlasPackOptions): void => {
  if (
    !Number.isSafeInteger(options.pageWidth) ||
    !Number.isSafeInteger(options.pageHeight) ||
    options.pageWidth <= 0 ||
    options.pageHeight <= 0
  ) {
    throw new RangeError("Atlas page dimensions must be positive safe integers.");
  }
  if (!Number.isSafeInteger(options.padding) || options.padding < 0) {
    throw new RangeError("Atlas padding must be a non-negative safe integer.");
  }
};

const validateRequests = (frames: readonly AtlasFrameRequest[], options: AtlasPackOptions): void => {
  const ids = new Set<string>();
  for (const frame of frames) {
    if (!frame.id.trim()) {
      throw new RangeError("Atlas frame IDs cannot be empty.");
    }
    if (ids.has(frame.id)) {
      throw new Error(`Atlas frame ID '${frame.id}' is duplicated.`);
    }
    ids.add(frame.id);

    if (
      !Number.isSafeInteger(frame.width) ||
      !Number.isSafeInteger(frame.height) ||
      frame.width <= 0 ||
      frame.height <= 0
    ) {
      throw new RangeError(`Atlas frame '${frame.id}' dimensions must be positive safe integers.`);
    }

    const outerWidth = frame.width + options.padding * 2;
    const outerHeight = frame.height + options.padding * 2;
    if (outerWidth > options.pageWidth || outerHeight > options.pageHeight) {
      throw new RangeError(`Atlas frame '${frame.id}' including padding does not fit on a page.`);
    }
  }
};

const sortedRequests = (frames: readonly AtlasFrameRequest[], padding: number): AtlasFrameRequest[] =>
  [...frames].sort((left, right) => {
    const leftHeight = left.height + padding * 2;
    const rightHeight = right.height + padding * 2;
    if (leftHeight !== rightHeight) {
      return rightHeight - leftHeight;
    }

    const leftWidth = left.width + padding * 2;
    const rightWidth = right.width + padding * 2;
    if (leftWidth !== rightWidth) {
      return rightWidth - leftWidth;
    }

    return left.id.localeCompare(right.id);
  });

const pageUsedHeight = (page: MutablePage): number =>
  page.shelves.reduce((total, shelf) => total + shelf.height, 0);

const placeOnShelf = (
  frame: AtlasFrameRequest,
  page: MutablePage,
  shelf: MutableShelf,
  options: AtlasPackOptions,
): AtlasPlacement | null => {
  const outerWidth = frame.width + options.padding * 2;
  const outerHeight = frame.height + options.padding * 2;
  if (outerHeight > shelf.height || shelf.x + outerWidth > options.pageWidth) {
    return null;
  }

  const outerX = shelf.x;
  const outerY = shelf.y;
  shelf.x += outerWidth;

  return {
    id: frame.id,
    pageIndex: page.index,
    x: outerX + options.padding,
    y: outerY + options.padding,
    width: frame.width,
    height: frame.height,
    padding: options.padding,
    outerX,
    outerY,
    outerWidth,
    outerHeight,
  };
};

const tryPlace = (
  frame: AtlasFrameRequest,
  page: MutablePage,
  options: AtlasPackOptions,
): AtlasPlacement | null => {
  for (const shelf of page.shelves) {
    const placement = placeOnShelf(frame, page, shelf, options);
    if (placement) {
      return placement;
    }
  }

  const outerHeight = frame.height + options.padding * 2;
  const y = pageUsedHeight(page);
  if (y + outerHeight > options.pageHeight) {
    return null;
  }

  const shelf: MutableShelf = { y, height: outerHeight, x: 0 };
  page.shelves.push(shelf);
  return placeOnShelf(frame, page, shelf, options);
};

export const packAtlas = (
  frames: readonly AtlasFrameRequest[],
  options: AtlasPackOptions,
): readonly AtlasPageLayout[] => {
  assertPackOptions(options);
  validateRequests(frames, options);
  if (frames.length === 0) {
    return [];
  }

  const pages: MutablePage[] = [];
  for (const frame of sortedRequests(frames, options.padding)) {
    let placement: AtlasPlacement | null = null;

    for (const page of pages) {
      placement = tryPlace(frame, page, options);
      if (placement) {
        page.placements.push(placement);
        break;
      }
    }

    if (!placement) {
      const page: MutablePage = {
        index: pages.length,
        shelves: [],
        placements: [],
      };
      pages.push(page);
      placement = tryPlace(frame, page, options);
      if (!placement) {
        throw new Error(`Atlas frame '${frame.id}' could not be placed.`);
      }
      page.placements.push(placement);
    }
  }

  return pages.map((page) => ({
    index: page.index,
    width: options.pageWidth,
    height: options.pageHeight,
    placements: [...page.placements].sort((left, right) => left.id.localeCompare(right.id)),
  }));
};

export const composeAtlasPage = (
  layout: AtlasPageLayout,
  frames: ReadonlyMap<string, RgbaImage>,
): RgbaImage => {
  const page: RgbaImage = {
    width: layout.width,
    height: layout.height,
    data: new Uint8Array(layout.width * layout.height * 4),
  };
  assertRgbaImage(page);

  for (const placement of layout.placements) {
    const frame = frames.get(placement.id);
    if (!frame) {
      throw new Error(`Atlas source frame '${placement.id}' is missing.`);
    }
    assertRgbaImage(frame);
    if (frame.width !== placement.width || frame.height !== placement.height) {
      throw new RangeError(`Atlas source frame '${placement.id}' dimensions do not match its layout.`);
    }

    const extruded = extrudeRgba(frame, placement.padding);
    blitRgba(page, extruded, placement.outerX, placement.outerY);
  }

  return page;
};
