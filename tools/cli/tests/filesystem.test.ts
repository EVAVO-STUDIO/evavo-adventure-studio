import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { replaceDirectoryAtomically, writeFilesAtomically } from "../src/filesystem.js";

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "evavo-adventure-cli-"));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
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

describe("transactional release directories", () => {
  it("replaces the complete directory and removes stale files", async () => {
    const parent = await createTemporaryDirectory();
    const release = join(parent, "release");
    await mkdir(release, { recursive: true });
    await writeFile(join(release, "stale.txt"), "stale");

    await replaceDirectoryAtomically(release, [
      { relativePath: "game.bundle.json", data: "bundle\n" },
      { relativePath: "assets/office.png", data: new Uint8Array([1, 2, 3]) },
    ]);

    expect(await readFile(join(release, "game.bundle.json"), "utf8")).toBe("bundle\n");
    expect(new Uint8Array(await readFile(join(release, "assets", "office.png")))).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    await expect(readFile(join(release, "stale.txt"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects traversal, Windows separators and duplicate release paths", async () => {
    const parent = await createTemporaryDirectory();
    const release = join(parent, "release");

    await expect(
      replaceDirectoryAtomically(release, [{ relativePath: "../escape.txt", data: "bad" }]),
    ).rejects.toThrow(RangeError);
    await expect(
      replaceDirectoryAtomically(release, [{ relativePath: "assets\\office.png", data: "bad" }]),
    ).rejects.toThrow(RangeError);
    await expect(
      replaceDirectoryAtomically(release, [
        { relativePath: "same.txt", data: "one" },
        { relativePath: "same.txt", data: "two" },
      ]),
    ).rejects.toThrow(RangeError);
  });
});
