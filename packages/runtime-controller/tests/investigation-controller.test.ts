import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { createInvestigationPackagedRuntimeController } from "../src/investigation-controller.js";

const hash = "0".repeat(64);

const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.investigation-controller",
  title: "Investigation Controller",
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
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [
    {
      assetId: "asset.office",
      kind: "image",
      outputFiles: [{
        role: "primary",
        runtimePath: "assets/office.png",
        mediaType: "image/png",
        sha256: hash,
        byteLength: 1,
      }],
      metadata: { kind: "image", width: 320, height: 200, palette: true, colourCount: 16 },
    },
  ],
  inventoryItems: [],
  actors: [],
  scenes: [{
    id: "scene.office",
    name: "Office",
    width: 320,
    height: 200,
    backgroundAssetId: "asset.office",
    navigationAreas: [],
    depthBands: [],
    occluders: [],
    hotspots: [],
    entrances: [{ id: "entrance.office", position: { x: 20, y: 170 }, facing: "east" }],
    fallbackText: "Nothing happens.",
  }],
  dialogues: [],
  sequences: [],
  investigation: {
    manifestVersion: 1,
    projectId: "project.investigation-controller",
    facts: [
      {
        id: "fact.alias",
        label: "Alias",
        description: "The registry exposes an alias.",
        unlockTopicIds: ["topic.alias"],
      },
      {
        id: "fact.contradiction",
        label: "Contradiction",
        description: "The witness account conflicts with the record.",
      },
    ],
    topics: [
      {
        id: "topic.alias",
        label: "Alias",
        revealFactIds: ["fact.contradiction"],
        oneShot: true,
      },
    ],
    researchSources: [
      {
        id: "source.registry",
        label: "Registry",
        availableChapterIds: ["chapter.day-1"],
        revealFactIds: ["fact.alias"],
        oneShot: true,
      },
    ],
    chapters: [
      {
        id: "chapter.day-1",
        label: "Day 1",
        order: 1,
        nextChapterId: "chapter.day-2",
        objectives: [
          {
            id: "objective.contradiction",
            label: "Find the contradiction",
            required: true,
            score: 5,
            requirements: [{ kind: "fact", factId: "fact.contradiction" }],
          },
        ],
      },
      {
        id: "chapter.day-2",
        label: "Day 2",
        order: 2,
        objectives: [],
      },
    ],
    presenceVariants: [
      {
        id: "presence.clerk.day-2",
        chapterIds: ["chapter.day-2"],
        locationId: "scene.archive",
        present: false,
        state: "gone",
      },
    ],
  },
});

describe("investigation packaged runtime controller", () => {
  it("persists semantic case state across save and restore", () => {
    const controller = createInvestigationPackagedRuntimeController(bundle);
    expect(controller.investigationState()?.chapterId).toBe("chapter.day-1");
    expect(controller.investigationState()?.availableTopicIds).toEqual([]);

    controller.useInvestigationResearchSource("source.registry");
    expect(controller.investigationState()?.discoveredFactIds).toContain("fact.alias");
    expect(controller.investigationState()?.availableTopicIds).toContain("topic.alias");

    controller.useInvestigationTopic("topic.alias", "actor.clerk");
    expect(controller.investigationChapterReadiness()?.ready).toBe(true);
    expect(controller.investigationState()?.score).toBe(5);

    const save = controller.createSaveGame();
    expect(save.investigation?.discoveredFactIds).toEqual(["fact.alias", "fact.contradiction"]);

    controller.advanceInvestigationChapter();
    expect(controller.investigationState()?.chapterId).toBe("chapter.day-2");
    expect(controller.investigationPresence()[0]?.state).toBe("gone");

    controller.restoreSaveGame(save);
    expect(controller.investigationState()?.chapterId).toBe("chapter.day-1");
    expect(controller.investigationState()?.score).toBe(5);
    expect(controller.investigationState()?.usedTopicIds).toEqual(["topic.alias"]);
  });

  it("remains a normal packaged controller when no investigation manifest exists", () => {
    const plainBundle = parseRuntimeBundle({ ...bundle, investigation: undefined });
    const controller = createInvestigationPackagedRuntimeController(plainBundle);
    expect(controller.investigationState()).toBeNull();
    expect(controller.investigationChapterReadiness()).toBeNull();
    expect(controller.investigationPresence()).toEqual([]);
  });
});
