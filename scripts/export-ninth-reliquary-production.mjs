import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createNinthReliquaryFinalizedProductionPackage,
  ninthReliquaryProductionBlueprint,
  ninthReliquaryProductionProfile,
} from "../packages/adventure-design/dist/src/ninth-reliquary-production-package.js";
import { ninthReliquaryGameplayProof } from "../packages/adventure-design/dist/src/ninth-reliquary-gameplay-proof.js";

const outputDirectory = resolve(process.cwd(), process.argv[2] ?? "artifacts/ninth-reliquary-production");
const authorityPath = process.argv[3] ? resolve(process.cwd(), process.argv[3]) : null;
await mkdir(outputDirectory, { recursive: true });

const files = new Map();
files.set("ninth-reliquary.production-blueprint.json", ninthReliquaryProductionBlueprint());
files.set("ninth-reliquary.production-profile.json", ninthReliquaryProductionProfile());
files.set("ninth-reliquary.gameplay-proof.json", ninthReliquaryGameplayProof);

if (authorityPath) {
  const authorities = JSON.parse(await readFile(authorityPath, "utf8"));
  const finalized = createNinthReliquaryFinalizedProductionPackage(authorities);
  files.set("ninth-reliquary.art-studio.work-orders.json", {
    contractVersion: 1,
    destinationStudio: "art-studio",
    workOrders: finalized.artStudioWorkOrders,
  });
  files.set("ninth-reliquary.cel-animation-studio.work-orders.json", {
    contractVersion: 1,
    destinationStudio: "cel-animation-studio",
    workOrders: finalized.celAnimationStudioWorkOrders,
  });
} else {
  files.set("ninth-reliquary.authority-required.json", {
    manifestVersion: 1,
    finalizedWorkOrdersEmitted: false,
    message:
      "Provide an approved authority JSON file as the second exporter argument before finalized Art Studio / Cel Animation Studio work orders can be emitted.",
    requiredAuthorities: ninthReliquaryProductionBlueprint().authorityRequirements,
  });
}

const summary = [];
for (const [fileName, value] of [...files.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  const data = new TextEncoder().encode(text);
  await writeFile(resolve(outputDirectory, fileName), data);
  summary.push({
    fileName,
    byteLength: data.byteLength,
    sha256: createHash("sha256").update(data).digest("hex"),
  });
}

const summaryFile = "ninth-reliquary.export-summary.json";
await writeFile(
  resolve(outputDirectory, summaryFile),
  `${JSON.stringify(
    {
      manifestVersion: 1,
      authoritiesSupplied: Boolean(authorityPath),
      authorityPath,
      files: summary,
    },
    null,
    2,
  )}\n`,
);

for (const entry of summary) {
  console.log(`${entry.fileName}\t${entry.byteLength} bytes\t${entry.sha256}`);
}
console.log(`${summaryFile}\t${resolve(outputDirectory, summaryFile)}`);
