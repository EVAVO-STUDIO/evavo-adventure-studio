import { describe, expect, it } from "vitest";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { validateProjectSemantics } from "../src/index.js";

const createProject = () =>
  parseAdventureProject({
    schemaVersion: 1,
    id: "project.validation-fixture",
    title: "Validation Fixture",
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
    startEntranceId: "entrance.office.door",
    scenes: [
      {
        id: "scene.office",
        name: "Office",
        width: 320,
        height: 200,
        backgroundAssetId: "asset.office",
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
        depthBands: [
          {
            id: "depth.office",
            farY: 120,
            nearY: 190,
            farScale: 0.7,
            nearScale: 1,
          },
        ],
        occluders: [],
        hotspots: [
          {
            id: "hotspot.door",
            name: "Door",
            shape: {
              points: [
                { x: 280, y: 80 },
                { x: 319, y: 80 },
                { x: 319, y: 190 },
                { x: 280, y: 190 },
              ],
            },
            walkTo: { x: 270, y: 160 },
            interactions: [
              {
                id: "interaction.exit-office",
                verb: "use",
                actions: [
                  {
                    kind: "change-scene",
                    sceneId: "scene.hall",
                    entranceId: "entrance.hall.office",
                  },
                ],
              },
            ],
          },
        ],
        entrances: [
          {
            id: "entrance.office.door",
            position: { x: 40, y: 160 },
            facing: "east",
          },
        ],
        fallbackText: "Nothing useful happens.",
      },
      {
        id: "scene.hall",
        name: "Hall",
        width: 320,
        height: 200,
        backgroundAssetId: "asset.hall",
        navigationAreas: [
          {
            id: "navigation.hall",
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
        hotspots: [],
        entrances: [
          {
            id: "entrance.hall.office",
            position: { x: 40, y: 160 },
            facing: "east",
          },
        ],
        fallbackText: "Nothing useful happens.",
      },
    ],
    actors: [],
    assets: [
      { id: "asset.office", path: "office.png", kind: "image" },
      { id: "asset.hall", path: "hall.png", kind: "image" },
    ],
    inventoryItems: [],
  });

describe("semantic project validation", () => {
  it("accepts a connected two-room fixture", () => {
    const issues = validateProjectSemantics(createProject());

    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(issues.find((issue) => issue.code === "unreachable-scene")).toBeUndefined();
  });

  it("reports missing assets and entrances", () => {
    const project = createProject();
    const broken = {
      ...project,
      scenes: project.scenes.map((scene) =>
        scene.id === "scene.hall"
          ? { ...scene, backgroundAssetId: "asset.missing" as typeof scene.backgroundAssetId }
          : scene,
      ),
      startEntranceId: "entrance.missing" as typeof project.startEntranceId,
    };

    const codes = validateProjectSemantics(broken).map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(["missing-asset", "missing-start-entrance"]));
  });

  it("reports invalid walk targets and unreachable rooms", () => {
    const project = createProject();
    const office = project.scenes[0]!;
    const door = office.hotspots[0]!;
    const broken = {
      ...project,
      scenes: [
        {
          ...office,
          hotspots: [
            {
              ...door,
              walkTo: { x: 5, y: 5 },
              interactions: [],
            },
          ],
        },
        project.scenes[1]!,
      ],
    };

    const codes = validateProjectSemantics(broken).map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(["invalid-walk-target", "unreachable-scene"]));
  });
});
