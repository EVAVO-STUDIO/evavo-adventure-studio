import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseLocalisationCliArguments,
  runLocalisationCli,
  type LocalisationCliEnvironment,
} from "../src/localisation-cli.js";

const directories: string[] = [];

const project = {
  schemaVersion: 1,
  id: "project.cli-localisation",
  title: "The Red Ledger",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: false,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.office",
  startEntranceId: "entrance.office",
  scenes: [
    {
      id: "scene.office",
      name: "Rain Office",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.office",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.office",
          position: { x: 20, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing useful happens.",
    },
  ],
  actors: [],
  dialogues: [],
  sequences: [],
  assets: [{ id: "asset.office", path: "art/office.png", kind: "image" }],
  inventoryItems: [],
};

const runtimeBundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: project.id,
  title: project.title,
  presentation: project.presentation,
  startSceneId: project.startSceneId,
  startEntranceId: project.startEntranceId,
  assetManifestFingerprint: "0".repeat(64),
  assetCompilerVersion: "test",
  assets: [
    {
      assetId: "asset.office",
      kind: "image",
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/office.png",
          mediaType: "image/png",
          sha256: "0".repeat(64),
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image",
        width: 320,
        height: 200,
        palette: false,
        colourCount: 32,
      },
    },
  ],
  inventoryItems: [],
  actors: [],
  scenes: project.scenes,
  dialogues: [],
  sequences: [],
};

const environment = (): {
  readonly cli: LocalisationCliEnvironment;
  readonly stdout: string[];
  readonly stderr: string[];
} => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    cli: {
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    },
    stdout,
    stderr,
  };
};

const json = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, "utf8")) as unknown;

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("localisation CLI", () => {
  it("parses canonical and US spelling command groups", () => {
    expect(
      parseLocalisationCliArguments([
        "localisation",
        "source",
        "--project",
        "project.json",
        "--out",
        "source.json",
      ]),
    ).toMatchObject({ kind: "source" });
    expect(
      parseLocalisationCliArguments([
        "localization",
        "validate",
        "--project",
        "project.json",
        "--localisation",
        "localisation.json",
      ]),
    ).toMatchObject({ kind: "validate" });
    expect(parseLocalisationCliArguments(["compile", "--project", "project.json"])).toBeNull();
  });

  it("extracts, templates, validates and attaches localisation without changing the input bundle", async () => {
    const directory = await mkdtemp(join(tmpdir(), "evavo-localisation-cli-"));
    directories.push(directory);
    const projectPath = join(directory, "project.json");
    const sourcePath = join(directory, "source.json");
    const manifestPath = join(directory, "localisation.json");
    const bundlePath = join(directory, "runtime.bundle.json");
    const localisedPath = join(directory, "runtime.localised.bundle.json");
    await writeFile(projectPath, JSON.stringify(project), "utf8");
    await writeFile(bundlePath, JSON.stringify(runtimeBundle), "utf8");

    const sourceOutput = environment();
    expect(
      await runLocalisationCli(
        ["localisation", "source", "--project", projectPath, "--out", sourcePath, "--json"],
        sourceOutput.cli,
      ),
    ).toBe(0);
    expect(sourceOutput.stderr).toEqual([]);
    expect(json(sourcePath)).resolves.toMatchObject({
      catalogueVersion: 1,
      projectId: project.id,
      sourceEntries: expect.arrayContaining([
        expect.objectContaining({ key: "project.title" }),
        expect.objectContaining({ key: "scene.office.name" }),
      ]),
    });

    expect(
      await runLocalisationCli(
        [
          "localisation",
          "template",
          "--project",
          projectPath,
          "--source-locale",
          "en-AU",
          "--locale",
          "fr-FR",
          "--label",
          "Français",
          "--out",
          manifestPath,
        ],
        environment().cli,
      ),
    ).toBe(0);
    const manifest = (await json(manifestPath)) as {
      readonly locales: readonly { readonly locale: string; readonly entries: readonly unknown[] }[];
    };
    expect(manifest.locales[0]?.locale).toBe("fr-FR");
    expect(manifest.locales[0]?.entries.length).toBe(3);

    expect(
      await runLocalisationCli(
        ["localisation", "validate", "--project", projectPath, "--localisation", manifestPath],
        environment().cli,
      ),
    ).toBe(0);

    expect(
      await runLocalisationCli(
        [
          "localisation",
          "attach",
          "--project",
          projectPath,
          "--localisation",
          manifestPath,
          "--bundle",
          bundlePath,
          "--default-locale",
          "fr-FR",
          "--out",
          localisedPath,
        ],
        environment().cli,
      ),
    ).toBe(0);
    const attached = (await json(localisedPath)) as {
      readonly localisation?: {
        readonly sourceLocale: string;
        readonly defaultLocale: string;
        readonly locales: readonly { readonly locale: string }[];
      };
    };
    expect(attached.localisation).toMatchObject({
      sourceLocale: "en-AU",
      defaultLocale: "fr-FR",
      locales: [{ locale: "fr-FR" }],
    });
    expect(await json(bundlePath)).toEqual(runtimeBundle);
  });

  it("rejects output collisions before writing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "evavo-localisation-collision-"));
    directories.push(directory);
    const projectPath = join(directory, "project.json");
    await writeFile(projectPath, JSON.stringify(project), "utf8");
    const output = environment();

    expect(
      await runLocalisationCli(
        ["localisation", "source", "--project", projectPath, "--out", projectPath],
        output.cli,
      ),
    ).toBe(2);
    expect(output.stderr.join("\n")).toContain("overwrite an input file");
  });
});