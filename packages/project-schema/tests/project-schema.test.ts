import { describe, expect, it } from "vitest";
import { parseAdventureProject } from "../src/index.js";

const minimalProject = {
  schemaVersion: 1,
  id: "project.fixture",
  title: "The Locked Office",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "icon-bar",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: true,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.office",
  startEntranceId: "entrance.office.door",
  scenes: [
    {
      id: "scene.office",
      name: "Office",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.office.background",
      navigationAreas: [
        {
          id: "navigation.office.floor",
          shape: {
            points: [
              { x: 20, y: 130 },
              { x: 300, y: 130 },
              { x: 300, y: 190 },
              { x: 20, y: 190 },
            ],
          },
          elevation: 0,
        },
      ],
      depthBands: [
        {
          id: "depth.office.floor",
          farY: 130,
          nearY: 190,
          farScale: 0.72,
          nearScale: 1,
        },
      ],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.office.door",
          position: { x: 42, y: 160 },
          facing: "east",
        },
      ],
      fallbackText: "There is nothing useful there.",
    },
  ],
  actors: [],
  assets: [
    {
      id: "asset.office.background",
      path: "assets/scenes/office/background.png",
      kind: "image",
    },
  ],
  inventoryItems: [],
} as const;

describe("adventureProjectSchema", () => {
  it("parses a strict low-resolution project", () => {
    const project = parseAdventureProject(minimalProject);

    expect(project.title).toBe("The Locked Office");
    expect(project.presentation.nativeWidth).toBe(320);
    expect(project.scenes[0]?.entrances[0]?.id).toBe("entrance.office.door");
  });

  it("rejects malformed walk geometry", () => {
    const malformed = structuredClone(minimalProject) as Record<string, unknown>;
    const scenes = malformed.scenes as Array<Record<string, unknown>>;
    const scene = scenes[0];
    const navigationAreas = scene?.navigationAreas as Array<Record<string, unknown>>;
    const area = navigationAreas[0];
    area!.shape = { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };

    expect(() => parseAdventureProject(malformed)).toThrow();
  });

  it("rejects undeclared project fields", () => {
    const malformed = { ...minimalProject, rendererObject: { unsafe: true } };

    expect(() => parseAdventureProject(malformed)).toThrow();
  });
});
