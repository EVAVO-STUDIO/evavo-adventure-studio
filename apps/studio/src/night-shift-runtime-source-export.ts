import { nightShiftProductionManifestJson } from "./night-shift-production-manifest.js";
import { nightShiftRuntimeSource } from "./night-shift-runtime-source.js";

export interface NightShiftRuntimeSourceFile {
  readonly fileName: string;
  readonly data: string;
}

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort((left, right) => left.localeCompare(right))) {
      const child = (value as Record<string, unknown>)[key];
      if (child !== undefined) output[key] = canonical(child);
    }
    return output;
  }
  return value;
};

const json = (value: unknown): string => `${JSON.stringify(canonical(value), null, 2)}\n`;

export const nightShiftRuntimeSourceFiles = (): readonly NightShiftRuntimeSourceFile[] => [
  { fileName: "project.json", data: json(nightShiftRuntimeSource.project) },
  { fileName: "scene-instances.json", data: json(nightShiftRuntimeSource.sceneInstances) },
  { fileName: "scene-staging.json", data: json(nightShiftRuntimeSource.sceneStaging) },
  { fileName: "palette-maps.json", data: json(nightShiftRuntimeSource.paletteMaps) },
  { fileName: "bitmap-fonts.json", data: json(nightShiftRuntimeSource.bitmapFonts) },
  { fileName: "ui-skins.json", data: json(nightShiftRuntimeSource.uiSkins) },
  { fileName: "audio-mix.json", data: json(nightShiftRuntimeSource.audioMix) },
  { fileName: "front-end.json", data: json(nightShiftRuntimeSource.frontEnd) },
  { fileName: "lifecycle.json", data: json(nightShiftRuntimeSource.lifecycle) },
  { fileName: "production-manifest.json", data: nightShiftProductionManifestJson() },
];

const writeUint16 = (view: DataView, offset: number, value: number): void => {
  view.setUint16(offset, value, true);
};

const writeUint32 = (view: DataView, offset: number, value: number): void => {
  view.setUint32(offset, value >>> 0, true);
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

interface Entry {
  readonly name: Uint8Array;
  readonly data: Uint8Array;
  readonly crc: number;
  readonly localOffset: number;
}

export const createNightShiftRuntimeSourceZip = (): Uint8Array => {
  const encoder = new TextEncoder();
  const files = [...nightShiftRuntimeSourceFiles()].sort((left, right) => left.fileName.localeCompare(right.fileName));
  const entries: Entry[] = [];
  let localSize = 0;
  for (const file of files) {
    const name = encoder.encode(file.fileName);
    const data = encoder.encode(file.data);
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

export const nightShiftRuntimeSourceArchiveFileName = "night-shift.runtime-source.zip";

export const downloadNightShiftRuntimeSource = (): void => {
  const zip = new Uint8Array(createNightShiftRuntimeSourceZip());
  const url = URL.createObjectURL(new Blob([zip.buffer], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nightShiftRuntimeSourceArchiveFileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
