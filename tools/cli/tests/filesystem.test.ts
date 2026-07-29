import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeFilesAtomically } from "../src/filesystem.js";

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "evavo-adventure-cli-"));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("transactional file writes", () => {
  it("commits multiple staged files", async () => {
    const directory = await createTemporaryDirectory();
    const bundle = join(directory, "nested", "game.bundle.json");
    const report = join(directory, "nested", "report.json");

    await writeFilesAtomically([
      { path: bundle, data: "bundle\n" },
      { path: report, data: "report\n" },
    ]);

    expect(await readFile(bundle, "utf8")).toBe("bundle\n");
    expect(await readFile(report, "utf8")).toBe("report\n");
  });

  it("replaces existing targets without leaving backup files", async () => {
    const directory = await createTemporaryDirectory();
    const target = join(directory, "game.bundle.json");
    await writeFile(target, "old\n");

    await writeFilesAtomically([{ path: target, data: "new\n" }]);

    expect(await readFile(target, "utf8")).toBe("new\n");
  });

  it("rejects duplicate resolved targets", async () => {
    const directory = await createTemporaryDirectory();
    const target = join(directory, "game.bundle.json");

    await expect(
      writeFilesAtomically([
        { path: target, data: "one" },
        { path: target, data: "two" },
      ]),
    ).rejects.toThrow(RangeError);
  });
});
