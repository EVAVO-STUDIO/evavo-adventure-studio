import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { createSaveGame as createRuntimeSaveGame } from "@evavo/adventure-save-game";
import { describe, expect, it } from "vitest";
import { createInvestigationPackagedSessionController } from "../src/investigation-session-controller.js";

const hash = "0".repeat(64);
const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const bundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.topic-panel",
  title: "Topic Panel Proof",
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
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/office.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: { kind: "image", width: 320, height: 200, palette: true, colourCount: 16 },
    },
    {
      assetId: "asset.font.system",
      kind: "image",
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/font.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: { kind: "image", width: 64, height: 16, palette: true, colourCount: 2 },
    },
  ],
  inventoryItems: [],
  actors: [
    {
      id: "actor.clerk",
      name: "Clerk",
      frames: [],
      animations: [],
    },
  ],
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
        { id: "entrance.office", position: { x: 20, y: 170 }, facing: "east" },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  dialogues: [
    {
      id: "dialogue.clerk",
      name: "Clerk",
      startNodeId: "dialogue-node.clerk.ask",
      nodeIndex: { "dialogue-node.clerk.ask": 0 },
      nodes: [
        {
          id: "dialogue-node.clerk.ask",
          enterActions: [],
          lines: [{ speakerId: "actor.clerk", text: "What would you like to know?" }],
          choices: [
            {
              id: "dialogue-choice.clerk.alias",
              text: "Ask about the alias",
              once: true,
              actions: [{ kind: "set-flag", flag: "clerkAnswered", value: true }],
              nextNodeId: "dialogue-node.clerk.ask",
              closeDialogue: false,
            },
          ],
          exitActions: [],
        },
      ],
    },
  ],
  sequences: [],
  bitmapFonts: {
    manifestVersion: 1,
    projectId: "project.topic-panel",
    fonts: [
      {
        id: "bitmap-font.system",
        name: "System",
        atlasAssetId: "asset.font.system",
        lineHeight: 8,
        baseline: 7,
        spaceAdvance: 4,
        letterSpacing: 0,
        fallbackCodePoint: 63,
        glyphs: [],
        kernings: [],
      },
    ],
  },
  uiSkins: {
    manifestVersion: 1,
    projectId: "project.topic-panel",
    defaultSkinId: "ui-skin.topic",
    skins: [
      {
        id: "ui-skin.topic",
        name: "Topic UI",
        interactionMode: "context",
        nativeSize: { width: 320, height: 200 },
        status: {
          id: "ui-region.status",
          rect: { x: 0, y: 0, width: 320, height: 14 },
          padding: 2,
          panel: { fill: 0x111111, border: 0x888888, borderWidth: 1, accent: 0xffffff },
        },
        dialogueChoices: {
          region: {
            id: "ui-region.dialogue",
            rect: { x: 8, y: 145, width: 304, height: 48 },
            padding: 2,
            panel: { fill: 0x111111, border: 0x888888, borderWidth: 1 },
          },
          maximumChoices: 6,
          gap: 1,
          normal: { fill: 0x222222, border: 0x888888, borderWidth: 1 },
          hover: { fill: 0x333333, border: 0xffffff, borderWidth: 1 },
          disabled: { fill: 0x111111, border: 0x444444, borderWidth: 1 },
        },
        verbs: [],
        fonts: {
          status: { fontId: "bitmap-font.system", color: 0xffffff, align: "left" },
          dialogue: { fontId: "bitmap-font.system", color: 0xffffff, align: "left" },
        },
      },
    ],
  },
  investigation: {
    manifestVersion: 1,
    projectId: "project.topic-panel",
    facts: [
      {
        id: "fact.alias-answer",
        label: "Alias answer",
        description: "The clerk confirms the alias.",
      },
    ],
    topics: [
      {
        id: "topic.alias",
        label: "R. Vale alias",
        initiallyAvailable: true,
        revealFactIds: ["fact.alias-answer"],
        oneShot: true,
      },
    ],
    researchSources: [],
    chapters: [
      {
        id: "chapter.day-1",
        label: "Day 1",
        order: 1,
        objectives: [
          {
            id: "objective.alias",
            label: "Ask the clerk",
            required: true,
            score: 5,
            requirements: [{ kind: "topic-used", topicId: "topic.alias" }],
          },
        ],
      },
    ],
    topicPanel: {
      region: { x: 12, y: 150, width: 296, height: 36 },
      gap: 1,
      maximumVisibleTopics: 6,
      dialogues: [
        {
          dialogueId: "dialogue.clerk",
          speakerId: "actor.clerk",
          responses: [
            {
              topicId: "topic.alias",
              dialogueChoiceId: "dialogue-choice.clerk.alias",
            },
          ],
        },
      ],
    },
  },
} as unknown as RuntimeBundle;

const openClerkDialogue = (
  controller: ReturnType<typeof createInvestigationPackagedSessionController>,
): void => {
  const base = controller.createSaveGame();
  controller.restoreSaveGame(
    createRuntimeSaveGame(
      bundle,
      {
        ...controller.worldState(),
        story: {
          ...controller.worldState().story,
          activeDialogue: {
            dialogueId: id<"dialogue">("dialogue.clerk"),
            nodeId: id<"dialogue-node">("dialogue-node.clerk.ask"),
          },
        },
      },
      {
        controlledActorInstanceId: base.interface.controlledActorInstanceId,
        selectedVerbId: base.interface.selectedVerbId,
        selectedItemId: base.interface.selectedItemId,
        statusText: base.interface.statusText,
        parser: base.interface.parser,
        investigation: controller.investigationState() ?? undefined,
      },
    ),
  );
};

describe("packaged investigation topic panel", () => {
  it("replaces generic choices and executes dialogue + semantic topic state together", () => {
    const controller = createInvestigationPackagedSessionController(bundle);
    openClerkDialogue(controller);

    const before = controller.createFrame(0);
    expect(
      before.nodes.find((node) => node.id === "runtime.ui.investigation.topic.0.text"),
    ).toMatchObject({ kind: "bitmap-text", text: "R. Vale alias" });
    expect(
      before.nodes.some((node) => String(node.id).startsWith("runtime.ui.dialogue")),
    ).toBe(false);

    controller.activate({ x: 30, y: 160 });
    expect(controller.worldState().story.flags.clerkAnswered).toBe(true);
    expect(controller.worldState().story.consumedDialogueChoiceIds).toContain(
      "dialogue-choice.clerk.alias",
    );
    expect(controller.investigationState()?.usedTopicIds).toContain("topic.alias");
    expect(controller.investigationState()?.discoveredFactIds).toContain("fact.alias-answer");
    expect(controller.investigationState()?.discovery["fact.alias-answer"]).toEqual([
      {
        kind: "dialogue",
        sourceId: "actor.clerk",
        chapterId: "chapter.day-1",
      },
    ]);
    expect(controller.investigationState()?.score).toBe(5);

    const after = controller.createFrame(0);
    expect(
      after.nodes.some((node) => String(node.id).startsWith("runtime.ui.dialogue")),
    ).toBe(false);
    expect(
      after.nodes.some((node) => String(node.id).startsWith("runtime.ui.investigation.topic")),
    ).toBe(false);
  });

  it("persists the semantic topic result through save/restore", () => {
    const controller = createInvestigationPackagedSessionController(bundle);
    openClerkDialogue(controller);
    controller.activate({ x: 30, y: 160 });
    const save = controller.createSaveGame();

    controller.setInvestigationFlag("temporary", true);
    expect(controller.investigationState()?.flags.temporary).toBe(true);
    controller.restoreSaveGame(save);
    expect(controller.investigationState()?.flags.temporary).toBeUndefined();
    expect(controller.investigationState()?.usedTopicIds).toEqual(["topic.alias"]);
    expect(controller.investigationState()?.discoveredFactIds).toEqual(["fact.alias-answer"]);
  });
});
