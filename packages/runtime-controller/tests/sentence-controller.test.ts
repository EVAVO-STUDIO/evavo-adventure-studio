import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { createSaveGame as createRuntimeSaveGame } from "@evavo/adventure-save-game";
import { describe, expect, it } from "vitest";
import { createSentencePackagedRuntimeController } from "../src/sentence-controller.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;
const hash = "0".repeat(64);

const imageAsset = (assetId: string, path: string, width: number, height: number) => ({
  assetId,
  kind: "image",
  outputFiles: [
    {
      role: "primary",
      runtimePath: path,
      mediaType: "image/png",
      sha256: hash,
      byteLength: 1,
    },
  ],
  metadata: { kind: "image", width, height, palette: true, colourCount: 16 },
});

const bundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.sentence-session",
  title: "Sentence Session",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "verb-list",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: false,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.room",
  startEntranceId: "entrance.room",
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [
    imageAsset("asset.room", "assets/room.png", 320, 200),
    imageAsset("asset.font", "assets/font.png", 16, 8),
    imageAsset("asset.icon.battery", "assets/battery.png", 8, 8),
    imageAsset("asset.icon.radio", "assets/radio.png", 8, 8),
    imageAsset("asset.icon.powered", "assets/powered.png", 8, 8),
    {
      assetId: "asset.actor",
      kind: "spritesheet",
      outputFiles: [
        {
          role: "atlas-manifest",
          runtimePath: "assets/actor/atlas.json",
          mediaType: "application/json",
          sha256: hash,
          byteLength: 1,
        },
        {
          role: "page-000",
          runtimePath: "assets/actor/page.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "spritesheet",
        pages: [{ outputRole: "page-000", width: 32, height: 32 }],
        frames: [
          {
            frameId: "frame.actor.idle",
            pageOutputRole: "page-000",
            sourceRect: { x: 0, y: 0, width: 12, height: 20 },
            originalSize: { width: 18, height: 24 },
            trimOffset: { x: 3, y: 4 },
            padding: 1,
          },
          {
            frameId: "frame.actor.walk",
            pageOutputRole: "page-000",
            sourceRect: { x: 12, y: 0, width: 12, height: 20 },
            originalSize: { width: 18, height: 24 },
            trimOffset: { x: 3, y: 4 },
            padding: 1,
          },
        ],
      },
    },
  ],
  inventoryItems: [
    {
      id: "item.battery",
      name: "Battery",
      description: "A battery.",
      iconAssetId: "asset.icon.battery",
    },
    {
      id: "item.radio",
      name: "Radio",
      description: "A radio.",
      iconAssetId: "asset.icon.radio",
    },
    {
      id: "item.powered-radio",
      name: "Powered Radio",
      description: "A powered radio.",
      iconAssetId: "asset.icon.powered",
    },
  ],
  actors: [
    {
      id: "actor.player",
      name: "Player",
      frames: [
        {
          id: "frame.actor.idle",
          assetId: "asset.actor",
          sourceRect: { x: 0, y: 0, width: 12, height: 20 },
          sourceSize: { width: 18, height: 24 },
          trimOffset: { x: 3, y: 4 },
          pivot: { x: 9, y: 23 },
          footPoint: { x: 9, y: 23 },
          durationTicks: 4,
          mirrorEligible: true,
        },
        {
          id: "frame.actor.walk",
          assetId: "asset.actor",
          sourceRect: { x: 12, y: 0, width: 12, height: 20 },
          sourceSize: { width: 18, height: 24 },
          trimOffset: { x: 3, y: 4 },
          pivot: { x: 9, y: 23 },
          footPoint: { x: 9, y: 23 },
          durationTicks: 4,
          mirrorEligible: true,
        },
      ],
      animations: [
        {
          id: "animation.player.idle-east",
          state: "idle",
          facing: "east",
          frameIds: ["frame.actor.idle"],
          loop: true,
          interruptible: true,
        },
        {
          id: "animation.player.walk-east",
          state: "walk",
          facing: "east",
          frameIds: ["frame.actor.walk"],
          loop: true,
          interruptible: true,
        },
      ],
    },
  ],
  scenes: [
    {
      id: "scene.room",
      name: "Room",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.room",
      navigationAreas: [
        {
          id: "navigation.room",
          shape: {
            points: [
              { x: 0, y: 80 },
              { x: 320, y: 80 },
              { x: 320, y: 140 },
              { x: 0, y: 140 },
            ],
          },
          elevation: 0,
        },
      ],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [{ id: "entrance.room", position: { x: 80, y: 120 }, facing: "east" }],
      fallbackText: "That does not work.",
    },
  ],
  dialogues: [],
  sequences: [],
  sceneInstances: {
    manifestVersion: 1,
    projectId: "project.sentence-session",
    objectDefinitions: [],
    scenes: [
      {
        sceneId: "scene.room",
        actorInstances: [
          {
            id: "actor-instance.player",
            actorId: "actor.player",
            position: { x: 80, y: 120 },
            facing: "east",
            animationState: "idle",
            mobility: "walkable",
            elevation: 0,
            zOffset: 0,
            scaleMultiplier: 1,
          },
        ],
        objectInstances: [],
        navigationPortals: [],
      },
    ],
  },
  bitmapFonts: {
    manifestVersion: 1,
    projectId: "project.sentence-session",
    fonts: [
      {
        id: "bitmap-font.ui",
        name: "UI",
        atlasAssetId: "asset.font",
        lineHeight: 8,
        baseline: 7,
        spaceAdvance: 4,
        letterSpacing: 0,
        fallbackCodePoint: 63,
        glyphs: [
          {
            id: "font-glyph.question",
            codePoint: 63,
            sourceRect: { x: 0, y: 0, width: 5, height: 7 },
            bearing: { x: 0, y: -7 },
            advance: 6,
          },
        ],
        kernings: [],
      },
    ],
  },
  uiSkins: {
    manifestVersion: 1,
    projectId: "project.sentence-session",
    defaultSkinId: "ui-skin.scumm",
    skins: [
      {
        id: "ui-skin.scumm",
        name: "Classic sentence panel",
        interactionMode: "verb-list",
        nativeSize: { width: 320, height: 200 },
        status: {
          id: "ui-region.status",
          rect: { x: 0, y: 140, width: 320, height: 10 },
          padding: 1,
          panel: { fill: 0, border: 0xffffff, borderWidth: 0 },
        },
        verbs: [
          {
            id: "ui-verb.use",
            verb: "use",
            label: "USE",
            cursorId: "use",
            primary: true,
          },
        ],
        verbBar: {
          region: {
            id: "ui-region.verbs",
            rect: { x: 0, y: 150, width: 96, height: 40 },
            padding: 2,
            panel: { fill: 0, border: 0xffffff, borderWidth: 1 },
          },
          orientation: "horizontal",
          gap: 0,
          buttonHeight: 16,
          normal: { fill: 0, border: 0xffffff, borderWidth: 1 },
          hover: { fill: 0, border: 0xffffff, borderWidth: 1 },
          pressed: { fill: 0, border: 0xffffff, borderWidth: 1 },
          disabled: { fill: 0, border: 0xffffff, borderWidth: 1 },
        },
        inventory: {
          region: {
            id: "ui-region.inventory",
            rect: { x: 100, y: 150, width: 120, height: 40 },
            padding: 2,
            panel: { fill: 0, border: 0xffffff, borderWidth: 1 },
          },
          slotWidth: 32,
          slotHeight: 32,
          gap: 4,
          visibleSlots: 3,
          slot: { fill: 0, border: 0xffffff, borderWidth: 1 },
          selected: { fill: 0, border: 0xffffff, borderWidth: 1 },
        },
        fonts: {
          status: { fontId: "bitmap-font.ui", color: 0xffffff, align: "left" },
          verb: { fontId: "bitmap-font.ui", color: 0xffffff, align: "center" },
        },
      },
    ],
  },
  itemCombinations: {
    manifestVersion: 1,
    projectId: "project.sentence-session",
    fallbackText: "Those items do not work together.",
    recipes: [
      {
        id: "item-combination.power-radio",
        verb: "use",
        primaryItemId: "item.battery",
        secondaryItemId: "item.radio",
        commutative: true,
        once: true,
        actions: [
          { kind: "remove-item", itemId: "item.battery" },
          { kind: "remove-item", itemId: "item.radio" },
          { kind: "give-item", itemId: "item.powered-radio" },
        ],
      },
    ],
  },
} as unknown as RuntimeBundle;

const seedInventory = (controller: ReturnType<typeof createSentencePackagedRuntimeController>) => {
  const base = controller.createSaveGame();
  return createRuntimeSaveGame(
    bundle,
    {
      ...controller.worldState(),
      story: {
        ...controller.worldState().story,
        inventory: [id<"item">("item.battery"), id<"item">("item.radio")],
      },
    },
    {
      controlledActorInstanceId: base.interface.controlledActorInstanceId,
      selectedVerbId: base.interface.selectedVerbId,
      selectedItemId: null,
      statusText: base.interface.statusText,
      parser: base.interface.parser,
      sentence: base.interface.sentence,
      itemCombinations: { usedRecipeIds: [] },
    },
  );
};

describe("classic sentence packaged session", () => {
  it("renders and restores a partial native sentence, then executes an item combination", () => {
    const controller = createSentencePackagedRuntimeController(bundle);
    controller.restoreSaveGame(seedInventory(controller));

    controller.activate({ x: 104, y: 154 });
    expect(controller.sentenceText()).toBe("USE Battery with …");
    expect(controller.statusText()).toBe("USE Battery with …");
    const frame = controller.createFrame(0);
    expect(
      frame.nodes.find((node) => node.kind === "bitmap-text" && node.id === "runtime.ui.status.text"),
    ).toMatchObject({ text: "USE Battery with …" });

    const midSentence = controller.createSaveGame();
    expect(midSentence.interface.sentence?.primary).toMatchObject({
      kind: "inventory-item",
      itemId: "item.battery",
    });

    controller.activate({ x: 140, y: 154 });
    expect(controller.worldState().story.inventory).toEqual(["item.powered-radio"]);
    expect(controller.combinationState().usedRecipeIds).toEqual(["item-combination.power-radio"]);

    controller.restoreSaveGame(midSentence);
    expect(controller.worldState().story.inventory).toEqual(["item.battery", "item.radio"]);
    expect(controller.sentenceText()).toBe("USE Battery with …");
    expect(controller.combinationState().usedRecipeIds).toEqual([]);
  });
});
