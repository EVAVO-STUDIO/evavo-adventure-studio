import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  runRuntimeArtifactCli,
  type RuntimeArtifactCliEnvironment,
} from "../src/runtime-artifacts.js";

const directories: string[] = [];

const captureEnvironment = () => {
  const output = { stdout: "", stderr: "" };
  const environment: RuntimeArtifactCliEnvironment = {
    stdout: (text) => {
      output.stdout += text;
    },
    stderr: (text) => {
      output.stderr += text;
    },
  };
  return { output, environment };
};

const temporaryRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "evavo-runtime-diagnostics-"));
  directories.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("runtime artifact CLI diagnostics", () => {
  it("reports a missing runtime bundle before inspecting the artifact", async () => {
    const root = await temporaryRoot();
    const bundlePath = join(root, "missing.bundle.json");
    const savePath = join(root, "missing.save.json");
    const { output, environment } = captureEnvironment();

    const exitCode = await runRuntimeArtifactCli(
      [
        "save-validate",
        "--bundle",
        bundlePath,
        "--save",
        savePath,
        "--json",
      ],
      environment,
    );

    expect(exitCode).toBe(1);
    expect(output.stderr).toBe("");
    expect(JSON.parse(output.stdout)).toMatchObject({
      command: "save-validate",
      valid: false,
      exitCode: 1,
      diagnostics: [
        {
          severity: "error",
          source: "runtime-bundle-file",
          code: "ENOENT",
          path: bundlePath,
        },
      ],
    });
  });

  it("distinguishes malformed bundle JSON from bundle schema errors", async () => {
    const root = await temporaryRoot();
    const bundlePath = join(root, "game.bundle.json");
    const savePath = join(root, "quick.save.json");
    const malformed = captureEnvironment();
    await writeFile(bundlePath, "{", "utf8");

    expect(
      await runRuntimeArtifactCli(
        [
          "save-validate",
          "--bundle",
          bundlePath,
          "--save",
          savePath,
          "--json",
        ],
        malformed.environment,
      ),
    ).toBe(1);
    expect(JSON.parse(malformed.output.stdout)).toMatchObject({
      diagnostics: [
        {
          source: "runtime-bundle-file",
          code: "invalid-json",
          path: bundlePath,
        },
      ],
    });

    await writeFile(bundlePath, "{}\n", "utf8");
    const invalidSchema = captureEnvironment();
    expect(
      await runRuntimeArtifactCli(
        [
          "save-validate",
          "--bundle",
          bundlePath,
          "--save",
          savePath,
          "--json",
        ],
        invalidSchema.environment,
      ),
    ).toBe(1);
    const report = JSON.parse(invalidSchema.output.stdout) as {
      readonly diagnostics: readonly {
        readonly source: string;
        readonly path: string;
      }[];
    };
    expect(report.diagnostics.length).toBeGreaterThan(0);
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "runtime-bundle-schema" }),
      ]),
    );
    expect(report.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "runtime-bundle-semantics" }),
      ]),
    );
  });

  it("rejects duplicate options before touching the filesystem", async () => {
    const { output, environment } = captureEnvironment();

    const exitCode = await runRuntimeArtifactCli(
      [
        "replay-validate",
        "--bundle",
        "game.bundle.json",
        "--replay",
        "playtest.replay.json",
        "--json",
        "--json",
      ],
      environment,
    );

    expect(exitCode).toBe(2);
    expect(output.stderr).toBe("");
    expect(JSON.parse(output.stdout)).toMatchObject({
      command: "replay-validate",
      valid: false,
      exitCode: 2,
      diagnostics: [
        {
          severity: "error",
          source: "cli",
          code: "invalid-usage",
          path: "$",
          message: "Option '--json' was supplied more than once.",
        },
      ],
    });
  });
});
