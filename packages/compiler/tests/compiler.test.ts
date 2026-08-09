import { type AssetBuildManifest, assetBuildManifestSchema } from "@evavo/adventure-asset-contract";
import { type AdventureProject, parseAdventureProject } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { compileProject, interactionIndexKey, tryCompileProject } from "../src/index.js";

const hash = "0".repeat(64);

const createProject = () =>
  parseAdventureProject({
    schemaVersion: 1,
    id: "project.compiler-fixture",
    title: "Compiler Fixture",
    presentation: {
      nativeWidth: 320,
      nativeHeight: 200,
      interactionMode: "verb-list",
      integerScale: true,
      textureSampling: "nearest",
      logicalTicksPerSecond: 60,
      pixelMotionPolicy: "strict",
      showScore: true,
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
        backgroundAssetId: "asset.background",
        navigationAreas: [
          {
            id: "navigation.office",
            shape: {
              points: [
                { x: 20, y: 120 },
                { x: 300, y: 120 },
                { x: 300, y: 190 },
                { x: 20, y: 190 },
              ],
            },
            elevation: 0,
          },
        ],
        depthBands: [],
        occluders: [],
        hotspots: [
          {
            id: "hotspot.desk",
            name: "Desk",
            shape: {
              points: [
                { x: 80, y: 80 },
                { x: 220, y: 80 },
                { x: 220, y: 150 },
                { x: 80, y: 150 },
              ],
            },
            walkTo: { x: 150, y: 160 },
            interactions: [
              {
                id: "interaction.look-desk-first",
                verb: "look",
                actions: [{ kind: "say", text: "A tidy desk." }],
              },
              {
                id: "interaction.look-desk-second",
                verb: "look",
                actions: [{ kind: "say", text: "Still tidy." }],
              },
            ],
          },
        ],
        entrances: [
          {
            id: "entrance.office",
            position: { x: 40, y: 160 },
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
      {
        id: "asset.z-unused",
        path: "authoring/z.png",
        kind: "image",
      },
      {
        id: "asset.background",
        path: "authoring/office.png",
        kind: "image",
      },
    ],
    inventoryItems: [],
  });

const createManifest = (project: AdventureProject, reverse = false): AssetBuildManifest => {
  const records = project.assets.map((asset) => ({
    assetId: asset.id,
    kind: "image" as const,
    sourceFiles: [
      {
        path: asset.path,
        sha256: hash,
        byteLength: 10,
      },
    ],
    outputFiles: [
      {
        role: "primary",
        runtimePath: `assets/${asset.id}.png`,
        mediaType: "image/png",
        sha256: hash,
        byteLength: 8,
      },
    ],
    metadata: {
      kind: "image" as const,
      width: asset.id === "asset.background" ? 320 : 16,
      height: asset.id === "asset.background" ? 200 : 16,
      palette: false,
      colourCount: 2,
    },
  }));

  return assetBuildManifestSchema.parse({
    manifestVersion: 1,
    projectId: project.id,
    compilerVersion: "0.1.0-test",
    fingerprint: hash,
    assets: reverse ? records.reverse() : records,
  });
};

describe("project compiler", () => {
  it("produces stable source-free output when non-semantic order changes", () => {
    const project = createProject();
    const reordered = {
      ...project,
      assets: [...project.assets].reverse(),
    };

    const left = compileProject(project, createManifest(project));
    const right = compileProject(reordered, createManifest(reordered, true));

    expect(left.canonicalJson).toBe(right.canonicalJson);
    expect(left.fingerprint).toBe(right.fingerprint);
    expect(left.bundle.assets.map((asset) => asset.assetId)).toEqual(["asset.background", "asset.z-unused"]);
    expect(left.bundle.assetManifestFingerprint).toBe(hash);
    expect(left.canonicalJson).not.toContain("authoring/");
  });

  it("preserves authored interaction precedence in its lookup index", () => {
    const project = createProject();
    const compiled = compileProject(project, createManifest(project));
    const hotspot = compiled.bundle.scenes[0]?.hotspots[0];
    const key = interactionIndexKey("look", null);

    expect(hotspot?.interactionIndex[key]).toEqual([
      "interaction.look-desk-first",
      "interaction.look-desk-second",
    ]);
  });

  it("refuses semantic project reference errors", () => {
    const project = createProject();
    const broken = {
      ...project,
      scenes: project.scenes.map((scene) => ({
        ...scene,
        backgroundAssetId: "asset.missing" as typeof scene.backgroundAssetId,
      })),
    };

    const result = tryCompileProject(broken, createManifest(project));

    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.issues.map((issue) => issue.code)).toContain("missing-asset");
    }
  });

  it("refuses incomplete compiled asset evidence", () => {
    const project = createProject();
    const complete = createManifest(project);
    const incomplete = assetBuildManifestSchema.parse({
      ...complete,
      assets: complete.assets.slice(0, 1),
    });

    const result = tryCompileProject(project, incomplete);

    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.issues.map((issue) => issue.code)).toContain("missing-asset");
    }
  });
});
