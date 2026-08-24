import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createNightShiftFoundationTechnicalArchive,
  nightShiftFoundationTechnicalArchiveFileName,
} from "../apps/studio/dist-types/src/night-shift-foundation-export.js";
import {
  nightShiftProductionManifestFileName,
  nightShiftProductionManifestJson,
} from "../apps/studio/dist-types/src/night-shift-production-manifest.js";
import {
  createNightShiftRuntimeSourceZip,
  nightShiftRuntimeSourceArchiveFileName,
} from "../apps/studio/dist-types/src/night-shift-runtime-source-export.js";
import {
  nightShiftStationProductionPacketFileName,
  nightShiftStationProductionPacketJson,
} from "../apps/studio/dist-types/src/night-shift-station-production-packet.js";

const outputDirectory = resolve(process.cwd(), process.argv[2] ?? "artifacts/night-shift-production");
await mkdir(outputDirectory, { recursive: true });

const encoder = new TextEncoder();
const files = [
  {
    name: nightShiftFoundationTechnicalArchiveFileName,
    data: createNightShiftFoundationTechnicalArchive(),
  },
  {
    name: nightShiftProductionManifestFileName,
    data: encoder.encode(nightShiftProductionManifestJson()),
  },
  {
    name: nightShiftRuntimeSourceArchiveFileName,
    data: createNightShiftRuntimeSourceZip(),
  },
  {
    name: nightShiftStationProductionPacketFileName,
    data: encoder.encode(nightShiftStationProductionPacketJson()),
  },
].sort((left, right) => left.name.localeCompare(right.name));

const summary = [];
for (const file of files) {
  const destination = resolve(outputDirectory, file.name);
  await writeFile(destination, file.data);
  summary.push({
    fileName: file.name,
    byteLength: file.data.byteLength,
    sha256: createHash("sha256").update(file.data).digest("hex"),
  });
}

const summaryPath = resolve(outputDirectory, "night-shift.export-summary.json");
await writeFile(
  summaryPath,
  `${JSON.stringify(
    {
      manifestVersion: 1,
      outputDirectory,
      files: summary,
    },
    null,
    2,
  )}\n`,
);

for (const entry of summary) {
  console.log(`${entry.fileName}\t${entry.byteLength} bytes\t${entry.sha256}`);
}
console.log(`night-shift.export-summary.json\t${summaryPath}`);
