import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runReplayExecuteCli } from "../src/replay-execute.js";

describe("replay execute output collision", () => {
  it("rejects the bundle path before reading either input", async () => {
    let stdout = "";
    let stderr = "";
    const bundlePath = "same.bundle.json";

    const exitCode = await runReplayExecuteCli(
      [
        "replay-execute",
        "--bundle",
        bundlePath,
        "--replay",
        "playtest.replay.json",
        "--output-save",
        bundlePath,
        "--json",
      ],
      {
        stdout: (text) => {
          stdout += text;
        },
        stderr: (text) => {
          stderr += text;
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toMatchObject({
      command: "replay-execute",
      valid: false,
      exitCode: 1,
      diagnostics: [
        {
          severity: "error",
          source: "replay-execution",
          code: "output-collides-with-input",
          path: "--output-save",
          message: `Replay output '${resolve(bundlePath)}' collides with an input artifact.`,
        },
      ],
    });
  });
});
