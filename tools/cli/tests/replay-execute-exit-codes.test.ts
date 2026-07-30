import { describe, expect, it } from "vitest";
import { replayExecuteExitCodeForDiagnosticCode } from "../src/replay-execute.js";

describe("replay execute exit codes", () => {
  it("reserves exit 3 for unclassified internal or output failures", () => {
    expect(
      replayExecuteExitCodeForDiagnosticCode("replay-execute-failed"),
    ).toBe(3);
  });

  it("keeps recognized replay and input failures on exit 1", () => {
    for (const code of [
      "ENOENT",
      "invalid-json",
      "schema-invalid",
      "runtime-bundle-invalid",
      "replay-integrity",
      "replay-compatibility",
      "replay-execution",
      "replay-divergence",
      "controlled-actor-mismatch",
    ]) {
      expect(replayExecuteExitCodeForDiagnosticCode(code)).toBe(1);
    }
  });
});
