import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runRuntimeArtifactCli } from "../src/runtime-artifacts.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("runtime artifact preflight wrapper", () => {
  it("rejects a directory as the bundle before reading the artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "evavo-artifact-input-"));
    directories.push(directory);
    let stdout = "";
    let stderr = "";

    const exitCode = await runRuntimeArtifactCli(
      ["save-validate", "--bundle", directory, "--save", "missing.save.json", "--json"],
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
      command: "save-validate",
      valid: false,
      exitCode: 1,
      diagnostics: [
        expect.objectContaining({
          source: "runtime-bundle-file",
          code: "input-not-file",
          path: directory,
        }),
      ],
    });
  });

  it("delegates malformed usage to the established command parser", async () => {
    let stdout = "";
    const exitCode = await runRuntimeArtifactCli(["replay-validate", "--json", "--json"], {
      stdout: (text) => {
        stdout += text;
      },
      stderr: () => undefined,
    });

    expect(exitCode).toBe(2);
    expect(JSON.parse(stdout)).toMatchObject({
      command: "replay-validate",
      valid: false,
      exitCode: 2,
      diagnostics: [expect.objectContaining({ code: "invalid-usage" })],
    });
  });
});
