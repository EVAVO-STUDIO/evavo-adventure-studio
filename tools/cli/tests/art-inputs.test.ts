import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assetBuildManifestSchema } from "@evavo/adventure-asset-contract";
import { createArtDirectionManifest } from "@evavo/adventure-art-direction";
import { artVisualEvidenceManifestSchema } from "@evavo/adventure-art-direction/evidence";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { loadArtInputs } from "../src/art-inputs.js";

const temporaryDirectories: string[] = [];
const hash = "0".repeat(64);

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.cli-art",
  title: "CLI Art",
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
  assets: [{ id: "asset.office", path: "art/office.png", kind: "image" }],
  inventoryItems: [],
});

const assetManifest = assetBuildManifestSchema.parse({
  manifestVersion: 1,
  projectId: project.id,
  compilerVersion: "test",
  fingerprint: hash,
  assets: [
    {
      assetId: "asset.office",
      kind: "image",
      sourceFiles: [
        { path: "art/office.png", sha256: hash, byteLength: 10 },
      ],
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/office.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 10,
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
  ],
});

const artDirection = createArtDirectionManifest(project, "vga-256-320x200");

const visualEvidence = (
  colourCount = 128,
  alphaMode: "opaque" | "binary" | "full" = "opaque",
) =>
  artVisualEvidenceManifestSchema.parse({
    manifestVersion: 1,
    projectId: project.id,
    compilerVersion: "test",
    assets: [
      {
        assetId: "asset.office",
        kind: "image",
        palette: true,
        colourCount,
        alphaMode,
      },
    ],
  });

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const fixture = async (
  evidence = visualEvidence(),
): Promise<{
  readonly root: string;
  readonly artPath: string;
  readonly evidencePath: string;
}> => {
  const root = await mkdtemp(join(tmpdir(), "evavo-art-inputs-"));
  temporaryDirectories.push(root);
  const artPath = join(root, "art-direction.json");
  const evidencePath = join(root, "art-evidence.json");
  await writeJson(artPath, artDirection);
  await writeJson(evidencePath, evidence);
  return { root, artPath, evidencePath };
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("CLI art inputs", () => {
  it("loads a clean policy and proof sidecar", async () => {
    const files = await fixture();
    const loaded = await loadArtInputs(
      files.artPath,
      files.evidencePath,
      project,
      assetManifest,
    );

    expect(loaded.manifest?.profile.preset).toBe("vga-256-320x200");
    expect(loaded.visualEvidence?.assets).toHaveLength(1);
    expect(loaded.diagnostics).toEqual([]);
    expect(loaded.artDirectionPath).toBe(files.artPath);
    expect(loaded.artEvidencePath).toBe(files.evidencePath);
  });

  it("reports blocking pixel-proof diagnostics", async () => {
    const files = await fixture(visualEvidence(300, "binary"));
    const loaded = await loadArtInputs(
      files.artPath,
      files.evidencePath,
      project,
      assetManifest,
    );

    expect(loaded.diagnostics.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "visual-evidence-colour-budget-exceeded",
        "visual-evidence-alpha-mismatch",
      ]),
    );
    expect(
      loaded.diagnostics.every(
        (entry) => entry.source === "art-evidence-semantics",
      ),
    ).toBe(true);
  });

  it("validates policy without requiring compiled evidence", async () => {
    const files = await fixture();
    const loaded = await loadArtInputs(
      files.artPath,
      null,
      project,
      null,
    );

    expect(loaded.visualEvidence).toBeNull();
    expect(loaded.diagnostics).toEqual([]);
  });

  it("returns no art state when no policy path is supplied", async () => {
    await expect(loadArtInputs(null, null, project, assetManifest)).resolves.toEqual({
      artDirectionPath: null,
      artEvidencePath: null,
      manifest: null,
      visualEvidence: null,
      diagnostics: [],
    });
  });
});
