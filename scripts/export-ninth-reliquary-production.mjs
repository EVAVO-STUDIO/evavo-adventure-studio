import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createNinthReliquaryFinalizedProductionPackageV3,
  ninthReliquaryProductionBlueprintV3,
} from "../packages/adventure-design/dist/src/ninth-reliquary-production-package-v3.js";
import { ninthReliquaryProductionProfile } from "../packages/adventure-design/dist/src/ninth-reliquary-production-package.js";
import { ninthReliquaryGameplayProof } from "../packages/adventure-design/dist/src/ninth-reliquary-gameplay-proof.js";

const outputDirectory = resolve(process.cwd(), process.argv[2] ?? "artifacts/ninth-reliquary-production");
const authorityPath = process.argv[3] ? resolve(process.cwd(), process.argv[3]) : null;
await mkdir(outputDirectory, { recursive: true });

const requiredAuthorityKeys = [
  "sourceRevisionDigest",
  "visualStandardDigest",
  "styleBankDigest",
  "paletteDigest",
  "environmentLayoutDigest",
  "protagonistModelSheetDigest",
  "protagonistWalkXSheetDigest",
  "environmentalReferenceDigests",
  "characterReferenceDigests",
];

const validateAuthorities = (authorities) => {
  const missing = requiredAuthorityKeys.filter((key) => {
    const value = authorities?.[key];
    return Array.isArray(value) ? value.length === 0 : typeof value !== "string" || value.trim().length === 0;
  });
  if (missing.length > 0) {
    throw new Error(
      `Ninth Reliquary v3 authority file is incomplete. Missing/empty: ${missing.join(", ")}.`,
    );
  }
};

const files = new Map();
files.set("ninth-reliquary.production-blueprint.v3.json", ninthReliquaryProductionBlueprintV3());
files.set("ninth-reliquary.production-profile.json", ninthReliquaryProductionProfile());
files.set("ninth-reliquary.gameplay-proof.json", ninthReliquaryGameplayProof);

if (authorityPath) {
  const authorities = JSON.parse(await readFile(authorityPath, "utf8"));
  validateAuthorities(authorities);
  const finalized = createNinthReliquaryFinalizedProductionPackageV3(authorities);
  files.set("ninth-reliquary.creative-work-orders.v3.json", {
    contractVersion: 3,
    projectKey: "ninth-reliquary",
    workOrders: finalized.workOrders,
  });
  files.set("ninth-reliquary.art-studio.production-requests.v3.json", {
    requestVersion: 3,
    destinationStudio: "art-studio",
    requests: finalized.artStudioRequests.map((entry) => entry.request),
  });
  files.set("ninth-reliquary.cel-animation-studio.production-requests.v3.json", {
    requestVersion: 3,
    destinationStudio: "cel-animation-studio",
    requests: finalized.celAnimationStudioRequests.map((entry) => entry.request),
  });
  files.set("ninth-reliquary.creative-evidence-requirements.v3.json", {
    evidencePolicyVersion: 3,
    requirements: finalized.evidenceRequirements,
  });
} else {
  files.set("ninth-reliquary.authority-required.v3.json", {
    manifestVersion: 3,
    finalizedWorkOrdersEmitted: false,
    message:
      "Provide an approved v3 authority JSON file as the second exporter argument before Art Studio / Cel Animation Studio production requests can be emitted.",
    requiredAuthorityKeys,
    requiredAuthorities: ninthReliquaryProductionBlueprintV3().authorityRequirements,
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
      manifestVersion: 3,
      creativeProtocolVersion: 3,
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
