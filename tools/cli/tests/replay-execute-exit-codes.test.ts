import { describe, expect, it } from "vitest";
import { replayExecuteExitCodeForDiagnosticCode } from "../src/replay-execute.js";

describe("replay execute exit codes", () => {
  it("reserves exit 3 for unclassified internal or output failures", () => {
    expect(replayExecuteExitCodeForDiagnosticCode("replay-execute-failed")).toBe(3);
  });

  it("keeps recognized replay, limit, output and input failures on exit 1", () => {
    for (const code of [
      "ENOENT",
      "invalid-json",
      "input-not-file",
      "file-too-large",
      "schema-invalid",
      "runtime-bundle-invalid",
      "replay-integrity",
      "replay-compatibility",
      "replay-execution",
      "replay-divergence",
      "replay-limit-exceeded",
      "controlled-actor-mismatch",
      "output-collides-with-input",
      "output-exists",
    ]) {
      expect(replayExecuteExitCodeForDiagnosticCode(code)).toBe(1);
    }
  });
});
