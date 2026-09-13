import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import {
  acceptAdventureCreativeCandidate,
  createAdventureCreativeReworkRequest,
  reviewAdventureCreativeCandidate,
} from "../packages/adventure-design/dist/src/creative-production-handoff.js";

const [workOrderArgument, candidateArgument, outputArgument] = process.argv.slice(2);
if (!workOrderArgument || !candidateArgument) {
  console.error(
    "Usage: node scripts/review-adventure-creative-candidate.mjs <work-order.json> <candidate-evidence.json> [output.json]",
  );
  process.exitCode = 2;
} else {
  const workOrderPath = resolve(process.cwd(), workOrderArgument);
  const candidatePath = resolve(process.cwd(), candidateArgument);
  const workOrder = JSON.parse(await readFile(workOrderPath, "utf8"));
  const candidate = JSON.parse(await readFile(candidatePath, "utf8"));
  const review = reviewAdventureCreativeCandidate(workOrder, candidate);

  const result =
    review.decision === "accepted"
      ? {
          resultVersion: 1,
          kind: "accepted",
          workOrderId: workOrder.workOrderId,
          workOrderFile: basename(workOrderPath),
          candidateFile: basename(candidatePath),
          review,
          acceptance: acceptAdventureCreativeCandidate(workOrder, candidate, review),
        }
      : {
          resultVersion: 1,
          kind: "rework-required",
          workOrderId: workOrder.workOrderId,
          workOrderFile: basename(workOrderPath),
          candidateFile: basename(candidatePath),
          review,
          rework: createAdventureCreativeReworkRequest(
            workOrder,
            candidate,
            review,
            Array.isArray(candidate.preserveApprovedAspects)
              ? candidate.preserveApprovedAspects.filter((value) => typeof value === "string")
              : [],
          ),
        };

  const canonicalText = `${JSON.stringify(result, null, 2)}\n`;
  const digest = createHash("sha256").update(canonicalText).digest("hex");
  const outputPath = resolve(
    process.cwd(),
    outputArgument ?? `${workOrder.workOrderId}.review-result.json`,
  );
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, canonicalText);
  console.log(`${result.kind}\t${outputPath}\t${digest}`);
  if (result.kind === "rework-required") process.exitCode = 3;
}
