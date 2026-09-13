const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const writeUint32Be = (output: Uint8Array, offset: number, value: number): void => {
  output[offset] = (value >>> 24) & 0xff;
  output[offset + 1] = (value >>> 16) & 0xff;
  output[offset + 2] = (value >>> 8) & 0xff;
  output[offset + 3] = value & 0xff;
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ (crcTable[(crc ^ byte) & 0xff] ?? 0);
  return (crc ^ 0xffffffff) >>> 0;
};

const adler32 = (bytes: Uint8Array): number => {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
};

const zlibStored = (bytes: Uint8Array): Uint8Array => {
  const blocks: Uint8Array[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const length = Math.min(65535, bytes.length - offset);
    const final = offset + length >= bytes.length;
    const block = new Uint8Array(5 + length);
    block[0] = final ? 1 : 0;
    block[1] = length & 0xff;
    block[2] = (length >>> 8) & 0xff;
    const complement = (~length) & 0xffff;
    block[3] = complement & 0xff;
    block[4] = (complement >>> 8) & 0xff;
    block.set(bytes.subarray(offset, offset + length), 5);
    blocks.push(block);
    offset += length;
  }
  const bodyLength = blocks.reduce((sum, block) => sum + block.length, 0);
  const output = new Uint8Array(2 + bodyLength + 4);
  output[0] = 0x78;
  output[1] = 0x01;
  let cursor = 2;
  for (const block of blocks) {
    output.set(block, cursor);
    cursor += block.length;
  }
  writeUint32Be(output, cursor, adler32(bytes));
  return output;
};

const ascii = (value: string): Uint8Array => new TextEncoder().encode(value);

const pngChunk = (type: string, data: Uint8Array): Uint8Array => {
  const typeBytes = ascii(type);
  const output = new Uint8Array(12 + data.length);
  writeUint32Be(output, 0, data.length);
  output.set(typeBytes, 4);
  output.set(data, 8);
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  writeUint32Be(output, 8 + data.length, crc32(crcInput));
  return output;
};

const assemblePng = (chunks: readonly Uint8Array[]): Uint8Array => {
  const total = PNG_SIGNATURE.length + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  output.set(PNG_SIGNATURE, 0);
  let cursor = PNG_SIGNATURE.length;
  for (const chunk of chunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
};

const assertDimensions = (width: number, height: number): void => {
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
    throw new RangeError("PNG dimensions must be positive safe integers.");
  }
};

export const encodeNativeRgbaPng = (
  width: number,
  height: number,
  rgba: Uint8Array,
): Uint8Array => {
  assertDimensions(width, height);
  if (rgba.byteLength !== width * height * 4) {
    throw new RangeError(`PNG RGBA buffer has ${rgba.byteLength} bytes; expected ${width * height * 4}.`);
  }

  const ihdr = new Uint8Array(13);
  writeUint32Be(ihdr, 0, width);
  writeUint32Be(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const scanlines = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const destination = y * (1 + width * 4);
    scanlines[destination] = 0;
    scanlines.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), destination + 1);
  }

  return assemblePng([
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlibStored(scanlines)),
    pngChunk("IEND", new Uint8Array()),
  ]);
};

export interface NativeIndexedPngPaletteEntry {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a?: number;
}

export const encodeNativeIndexedPng = (
  width: number,
  height: number,
  indices: Uint8Array,
  palette: readonly NativeIndexedPngPaletteEntry[],
): Uint8Array => {
  assertDimensions(width, height);
  if (indices.byteLength !== width * height) {
    throw new RangeError(`PNG index buffer has ${indices.byteLength} bytes; expected ${width * height}.`);
  }
  if (palette.length < 1 || palette.length > 256) {
    throw new RangeError("Indexed PNG palette must contain from 1 to 256 entries.");
  }

  let maximumIndex = 0;
  for (const value of indices) maximumIndex = Math.max(maximumIndex, value);
  if (maximumIndex >= palette.length) {
    throw new RangeError(`Indexed PNG source uses palette index ${maximumIndex}; palette has ${palette.length} entries.`);
  }

  const ihdr = new Uint8Array(13);
  writeUint32Be(ihdr, 0, width);
  writeUint32Be(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 3;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const plte = new Uint8Array(palette.length * 3);
  const alpha = new Uint8Array(palette.length);
  let lastNonOpaque = -1;
  palette.forEach((entry, index) => {
    for (const [name, value] of [
      ["r", entry.r],
      ["g", entry.g],
      ["b", entry.b],
      ["a", entry.a ?? 255],
    ] as const) {
      if (!Number.isSafeInteger(value) || value < 0 || value > 255) {
        throw new RangeError(`Indexed PNG palette ${name} component at entry ${index} must be 0–255.`);
      }
    }
    plte[index * 3] = entry.r;
    plte[index * 3 + 1] = entry.g;
    plte[index * 3 + 2] = entry.b;
    alpha[index] = entry.a ?? 255;
    if (alpha[index] !== 255) lastNonOpaque = index;
  });

  const scanlines = new Uint8Array(height * (1 + width));
  for (let y = 0; y < height; y += 1) {
    const destination = y * (1 + width);
    scanlines[destination] = 0;
    scanlines.set(indices.subarray(y * width, (y + 1) * width), destination + 1);
  }

  const chunks: Uint8Array[] = [pngChunk("IHDR", ihdr), pngChunk("PLTE", plte)];
  if (lastNonOpaque >= 0) chunks.push(pngChunk("tRNS", alpha.slice(0, lastNonOpaque + 1)));
  chunks.push(pngChunk("IDAT", zlibStored(scanlines)), pngChunk("IEND", new Uint8Array()));
  return assemblePng(chunks);
};
