import { describe, expect, it } from "vitest";
import {
  createNightShiftRuntimeSourceZip,
  nightShiftRuntimeSourceArchiveFileName,
  nightShiftRuntimeSourceFiles,
} from "../src/night-shift-runtime-source-export.js";

const zipFileNames = (bytes: Uint8Array): readonly string[] => {
  const decoder = new TextDecoder();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const names: string[] = [];
  let cursor = 0;
  while (cursor + 30 <= bytes.byteLength && view.getUint32(cursor, true) === 0x04034b50) {
    const compressedSize = view.getUint32(cursor + 18, true);
    const nameLength = view.getUint16(cursor + 26, true);
    const extraLength = view.getUint16(cursor + 28, true);
    const nameStart = cursor + 30;
    names.push(decoder.decode(bytes.slice(nameStart, nameStart + nameLength)));
    cursor = nameStart + nameLength + extraLength + compressedSize;
  }
  return names;
};

describe("Night Shift runtime source export", () => {
  it("exports every authored compiler input plus runtime index contracts and production manifest", () => {
    expect(nightShiftRuntimeSourceFiles().map((file) => file.fileName)).toEqual([
      "project.json",
      "scene-instances.json",
      "scene-staging.json",
      "palette-maps.json",
      "bitmap-fonts.json",
      "ui-skins.json",
      "audio-mix.json",
      "front-end.json",
      "lifecycle.json",
      "runtime-index-bindings.json",
      "runtime-index-build-plan.json",
      "production-manifest.json",
    ]);
  });

  it("creates a deterministic store-only ZIP with all twelve files", () => {
    const first = createNightShiftRuntimeSourceZip();
    const second = createNightShiftRuntimeSourceZip();
    expect(first).toEqual(second);
    expect(zipFileNames(first)).toEqual([
      "audio-mix.json",
      "bitmap-fonts.json",
      "front-end.json",
      "lifecycle.json",
      "palette-maps.json",
      "production-manifest.json",
      "project.json",
      "runtime-index-bindings.json",
      "runtime-index-build-plan.json",
      "scene-instances.json",
      "scene-staging.json",
      "ui-skins.json",
    ]);
  });

  it("uses a stable archive filename", () => {
    expect(nightShiftRuntimeSourceArchiveFileName).toBe("night-shift.runtime-source.zip");
  });
});
