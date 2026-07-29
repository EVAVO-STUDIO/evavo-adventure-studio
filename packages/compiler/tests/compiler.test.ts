import { describe, expect, it } from "vitest";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  compileProject,
  interactionIndexKey,
  tryCompileProject,
} from "../src/index.js";

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
    assets: [
      { id: "asset.z-unused", path: "z.png", kind: "image" },
      { id: "asset.background", path: "office.png", kind: "image" },
    ],
    inventoryItems: [],
  });

describe("project compiler", () => {
  it("produces stable output when non-semantic asset order changes", () => {
    const project = createProject();
    const reordered = {
      ...project,
      assets: [...project.assets].reverse(),
    };

    const left = compileProject(project);
    const right = compileProject(reordered);

    expect(left.canonicalJson).toBe(right.canonicalJson);
    expect(left.fingerprint).toBe(right.fingerprint);
    expect(left.bundle.assets.map((asset) => asset.id)).toEqual([
      "asset.background",
      "asset.z-unused",
    ]);
  });

  it("preserves authored interaction precedence in its lookup index", () => {
    const compiled = compileProject(createProject());
    const hotspot = compiled.bundle.scenes[0]?.hotspots[0];
    const key = interactionIndexKey("look", null);

    expect(hotspot?.interactionIndex[key]).toEqual([
      "interaction.look-desk-first",
      "interaction.look-desk-second",
    ]);
  });

  it("refuses to compile semantic reference errors", () => {
    const project = createProject();
    const broken = {
      ...project,
      scenes: project.scenes.map((scene) => ({
        ...scene,
        backgroundAssetId: "asset.missing" as typeof scene.backgroundAssetId,
      })),
    };

    const result = tryCompileProject(broken);

    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.issues.map((issue) => issue.code)).toContain("missing-asset");
    }
  });
});
