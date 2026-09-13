const writeUint16 = (view: DataView, offset: number, value: number): void => view.setUint16(offset, value, true);
const writeUint32 = (view: DataView, offset: number, value: number): void => view.setUint32(offset, value >>> 0, true);

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ (crcTable[(crc ^ byte) & 0xff] ?? 0);
  return (crc ^ 0xffffffff) >>> 0;
};

export interface DeterministicZipFile {
  readonly path: string;
  readonly data: Uint8Array;
}

interface Entry {
  readonly name: Uint8Array;
  readonly data: Uint8Array;
  readonly crc: number;
  readonly localOffset: number;
}

export const createDeterministicStoredZip = (files: readonly DeterministicZipFile[]): Uint8Array => {
  const encoder = new TextEncoder();
  const sorted = [...files].sort((left, right) => left.path.localeCompare(right.path));
  if (new Set(sorted.map((file) => file.path)).size !== sorted.length) {
    throw new Error("Deterministic ZIP contains duplicate file paths.");
  }
  const entries: Entry[] = [];
  let localSize = 0;
  for (const file of sorted) {
    const name = encoder.encode(file.path);
    const data = new Uint8Array(file.data);
    entries.push({ name, data, crc: crc32(data), localOffset: localSize });
    localSize += 30 + name.length + data.length;
  }
  const centralSize = entries.reduce((sum, entry) => sum + 46 + entry.name.length, 0);
  const output = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(output.buffer);
  let cursor = 0;
  for (const entry of entries) {
    writeUint32(view, cursor, 0x04034b50);
    writeUint16(view, cursor + 4, 20);
    writeUint16(view, cursor + 6, 0);
    writeUint16(view, cursor + 8, 0);
    writeUint16(view, cursor + 10, 0);
    writeUint16(view, cursor + 12, 0);
    writeUint32(view, cursor + 14, entry.crc);
    writeUint32(view, cursor + 18, entry.data.length);
    writeUint32(view, cursor + 22, entry.data.length);
    writeUint16(view, cursor + 26, entry.name.length);
    writeUint16(view, cursor + 28, 0);
    output.set(entry.name, cursor + 30);
    output.set(entry.data, cursor + 30 + entry.name.length);
    cursor += 30 + entry.name.length + entry.data.length;
  }
  const centralOffset = cursor;
  for (const entry of entries) {
    writeUint32(view, cursor, 0x02014b50);
    writeUint16(view, cursor + 4, 20);
    writeUint16(view, cursor + 6, 20);
    writeUint16(view, cursor + 8, 0);
    writeUint16(view, cursor + 10, 0);
    writeUint16(view, cursor + 12, 0);
    writeUint16(view, cursor + 14, 0);
    writeUint32(view, cursor + 16, entry.crc);
    writeUint32(view, cursor + 20, entry.data.length);
    writeUint32(view, cursor + 24, entry.data.length);
    writeUint16(view, cursor + 28, entry.name.length);
    writeUint16(view, cursor + 30, 0);
    writeUint16(view, cursor + 32, 0);
    writeUint16(view, cursor + 34, 0);
    writeUint16(view, cursor + 36, 0);
    writeUint32(view, cursor + 38, 0);
    writeUint32(view, cursor + 42, entry.localOffset);
    output.set(entry.name, cursor + 46);
    cursor += 46 + entry.name.length;
  }
  writeUint32(view, cursor, 0x06054b50);
  writeUint16(view, cursor + 4, 0);
  writeUint16(view, cursor + 6, 0);
  writeUint16(view, cursor + 8, entries.length);
  writeUint16(view, cursor + 10, entries.length);
  writeUint32(view, cursor + 12, centralSize);
  writeUint32(view, cursor + 16, centralOffset);
  writeUint16(view, cursor + 20, 0);
  return output;
};
