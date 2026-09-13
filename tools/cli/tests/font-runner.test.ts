import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../src/runner.js";

const temporaryDirectories: string[] = [];

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) => left.localeCompare(right))) {
      const child = source[key];
      if (child !== undefined) output[key] = canonicalize(child);
    }
    return output;
  }
  return value;
};

const sha256 = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};

const createFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "evavo-font-runner-"));
  temporaryDirectories.push(root);
  const projectPath = join(root, "project.json");
  const fontsPath = join(root, "bitmap-fonts.json");
  const manifestPath = join(root, "build", "assets.manifest.json");
  const bundlePath = join(root, "dist", "game.bundle.json");
  const reportPath = join(root, "dist", "compile-report.json");
  const backgroundSourcePath = join(root, "art", "office.png");
  const fontSourcePath = join(root, "art", "dialogue-font.png");
  const backgroundOutputPath = join(root, "build", "assets", "office.png");
  const fontOutputPath = join(root, "build", "assets", "dialogue-font.png");

  const backgroundSource = new TextEncoder().encode("background source");
  const fontSource = new TextEncoder().encode("bitmap font source");
  const backgroundOutput = new Uint8Array([1, 2, 3, 4]);
  const fontOutput = new Uint8Array([5, 6, 7, 8]);
  await mkdir(dirname(backgroundSourcePath), { recursive: true });
  await mkdir(dirname(backgroundOutputPath), { recursive: true });
  await writeFile(backgroundSourcePath, backgroundSource);
  await writeFile(fontSourcePath, fontSource);
  await writeFile(backgroundOutputPath, backgroundOutput);
  await writeFile(fontOutputPath, fontOutput);

  const project = {
    schemaVersion: 1,
    id: "project.cli-font-runner",
    title: "CLI Font Runner",
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
        name: "Office",
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
        fallbackText: "Nothing happens.",
      },
    ],
    actors: [],
    dialogues: [],
    sequences: [],
    assets: [
      { id: "asset.office", path: "art/office.png", kind: "image" },
      {
        id: "asset.font.dialogue",
        path: "art/dialogue-font.png",
        kind: "image",
      },
    ],
    inventoryItems: [],
  };
  await writeJson(projectPath, project);

  const fontManifest = {
    manifestVersion: 1,
    projectId: project.id,
    fonts: [
      {
        id: "bitmap-font.dialogue",
        name: "Dialogue",
        atlasAssetId: "asset.font.dialogue",
        lineHeight: 10,
        baseline: 8,
        spaceAdvance: 4,
        letterSpacing: 1,
        fallbackCodePoint: 63,
        glyphs: [
          {
            id: "font-glyph.question",
            codePoint: 63,
            sourceRect: { x: 0, y: 0, width: 5, height: 8 },
            bearing: { x: 0, y: -8 },
            advance: 6,
          },
        ],
        kernings: [],
      },
    ],
  };
  await writeJson(fontsPath, fontManifest);

  const manifestPayload = {
    manifestVersion: 1,
    projectId: project.id,
    compilerVersion: "font-runner-test",
    assets: [
      {
        assetId: "asset.office",
        kind: "image",
        sourceFiles: [
          {
            path: "art/office.png",
            sha256: sha256(backgroundSource),
            byteLength: backgroundSource.byteLength,
          },
        ],
        outputFiles: [
          {
            role: "primary",
            runtimePath: "assets/office.png",
            mediaType: "image/png",
            sha256: sha256(backgroundOutput),
            byteLength: backgroundOutput.byteLength,
          },
        ],
        metadata: {
          kind: "image",
          width: 320,
          height: 200,
          palette: true,
          colourCount: 128,
        },
      },
      {
        assetId: "asset.font.dialogue",
        kind: "image",
        sourceFiles: [
          {
            path: "art/dialogue-font.png",
            sha256: sha256(fontSource),
            byteLength: fontSource.byteLength,
          },
        ],
        outputFiles: [
          {
            role: "primary",
            runtimePath: "assets/dialogue-font.png",
            mediaType: "image/png",
            sha256: sha256(fontOutput),
            byteLength: fontOutput.byteLength,
          },
        ],
        metadata: {
          kind: "image",
          width: 32,
          height: 16,
          palette: true,
          colourCount: 16,
        },
      },
    ],
  };
  const fingerprint = sha256(JSON.stringify(canonicalize(manifestPayload)));
  await writeJson(manifestPath, { ...manifestPayload, fingerprint });

  return {
    projectPath,
    fontsPath,
    manifestPath,
    bundlePath,
    reportPath,
    fontManifest,
  };
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("CLI bitmap font compilation", () => {
  it("embeds validated fonts and reports their exact source", async () => {
    const fixture = await createFixture();
    let stdout = "";
    let stderr = "";
    const exitCode = await runCli(
      [
        "compile",
        "--project",
        fixture.projectPath,
        "--asset-manifest",
        fixture.manifestPath,
        "--bitmap-fonts",
        fixture.fontsPath,
        "--out",
        fixture.bundlePath,
        "--report",
        fixture.reportPath,
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

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toMatchObject({
      command: "compile",
      valid: true,
      bitmapFontsPath: fixture.fontsPath,
      bitmapFontCount: 1,
    });
    const bundle = JSON.parse(await readFile(fixture.bundlePath, "utf8")) as {
      readonly bitmapFonts?: {
        readonly fonts: readonly { readonly id: string }[];
      };
    };
    expect(bundle.bitmapFonts?.fonts).toEqual([expect.objectContaining({ id: "bitmap-font.dialogue" })]);
    expect(await readFile(fixture.reportPath, "utf8")).toContain(fixture.fontsPath);
  });

  it("blocks stale compiled glyph geometry with exit code one", async () => {
    const fixture = await createFixture();
    await writeJson(fixture.fontsPath, {
      ...fixture.fontManifest,
      fonts: fixture.fontManifest.fonts.map((font) => ({
        ...font,
        glyphs: font.glyphs.map((glyph) => ({
          ...glyph,
          sourceRect: { x: 30, y: 0, width: 5, height: 8 },
        })),
      })),
    });
    let stdout = "";
    const exitCode = await runCli(
      [
        "validate",
        "--project",
        fixture.projectPath,
        "--asset-manifest",
        fixture.manifestPath,
        "--bitmap-fonts",
        fixture.fontsPath,
        "--json",
      ],
      {
        stdout: (text) => {
          stdout += text;
        },
        stderr: () => undefined,
      },
    );

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout)).toMatchObject({
      valid: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          source: "bitmap-fonts-semantics",
          code: "compiled-font-image-bounds",
        }),
      ]),
    });
  });

  it("refuses to overwrite the bitmap font input", async () => {
    const fixture = await createFixture();
    const exitCode = await runCli(
      [
        "compile",
        "--project",
        fixture.projectPath,
        "--asset-manifest",
        fixture.manifestPath,
        "--bitmap-fonts",
        fixture.fontsPath,
        "--out",
        fixture.fontsPath,
        "--json",
      ],
      {
        stdout: () => undefined,
        stderr: () => undefined,
      },
    );
    expect(exitCode).toBe(2);
  });
});
