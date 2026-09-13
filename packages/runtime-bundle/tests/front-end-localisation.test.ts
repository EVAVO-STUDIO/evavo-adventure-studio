import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { parseClassicFrontEndManifest } from "@evavo/adventure-project-schema/front-end";
import {
  collectLocalisationSourceEntries,
  extractFrontEndLocalisableText,
  frontEndLocalisationKey,
  localisationManifestSchema,
} from "@evavo/adventure-project-schema/localisation";
import { describe, expect, it } from "vitest";
import {
  createRuntimeLocalisationPack,
  extendRuntimeLocalisationPack,
  localiseRuntimeFrontEnd,
  parseRuntimeBundle,
  RuntimeLocalisationCompilationError,
} from "../src/index.js";

const hash = "0".repeat(64);
const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.front-end-runtime-localisation",
  title: "Front End Runtime",
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
  startSceneId: "scene.room",
  startEntranceId: "entrance.room",
  scenes: [
    {
      id: "scene.room",
      name: "Room",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.room",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.room",
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
  assets: [{ id: "asset.room", path: "art/room.png", kind: "image" }],
  inventoryItems: [],
});

const frontEnd = parseClassicFrontEndManifest({
  manifestVersion: 1,
  projectId: project.id,
  publisher: {
    name: "EVAVO",
    presents: "ADVENTURE STUDIO PRESENTS",
    splashDurationTicks: 96,
    splashSkipAfterTicks: 18,
  },
  title: {
    kicker: "A CLASSIC POINT AND CLICK ADVENTURE",
  },
  menu: {
    labels: {
      newGame: "NEW GAME",
      continueGame: "CONTINUE",
      loadGame: "LOAD GAME",
      options: "OPTIONS",
      credits: "CREDITS",
      quit: "QUIT",
      quickSave: "QUICK SAVE",
      back: "BACK",
      fullscreen: "TOGGLE FULLSCREEN",
    },
    showContinue: true,
    showLoad: true,
    showOptions: true,
    showCredits: true,
    showQuit: true,
  },
  options: {
    allowFullscreen: true,
  },
  credits: {
    lines: ["DESIGNED BY EVAVO"],
  },
});

const frontEndSources = extractFrontEndLocalisableText(frontEnd);
const allSources = collectLocalisationSourceEntries(project, frontEndSources);
const manifest = localisationManifestSchema.parse({
  manifestVersion: 1,
  projectId: project.id,
  sourceLocale: "en-AU",
  locales: [
    {
      locale: "fr-FR",
      label: "Français",
      status: "release",
      entries: allSources.map((entry) => ({
        key: entry.key,
        text: `FR ${entry.text}`,
      })),
    },
  ],
});

const sourceBundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: project.id,
  title: project.title,
  presentation: project.presentation,
  startSceneId: project.startSceneId,
  startEntranceId: project.startEntranceId,
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [
    {
      assetId: "asset.room",
      kind: "image",
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/room.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image",
        width: 320,
        height: 200,
        palette: true,
        colourCount: 32,
      },
    },
  ],
  inventoryItems: [],
  actors: [],
  scenes: project.scenes.map((scene) => ({ ...scene, hotspots: [] })),
  dialogues: [],
  sequences: [],
  frontEnd,
});

describe("runtime classic front-end localisation", () => {
  it("localises publisher, title, menu and credits without changing behavior policy", () => {
    const pack = createRuntimeLocalisationPack(
      project,
      manifest,
      "fr-FR",
      frontEndSources,
    );
    const bundled = parseRuntimeBundle({ ...sourceBundle, localisation: pack });
    const localised = localiseRuntimeFrontEnd(bundled, "fr-FR");

    expect(localised.frontEnd).toMatchObject({
      publisher: {
        name: "FR EVAVO",
        presents: "FR ADVENTURE STUDIO PRESENTS",
        splashDurationTicks: 96,
        splashSkipAfterTicks: 18,
      },
      title: {
        kicker: "FR A CLASSIC POINT AND CLICK ADVENTURE",
      },
      menu: {
        showContinue: true,
        showLoad: true,
        showOptions: true,
        showCredits: true,
        showQuit: true,
        labels: {
          newGame: "FR NEW GAME",
          continueGame: "FR CONTINUE",
          loadGame: "FR LOAD GAME",
          options: "FR OPTIONS",
          credits: "FR CREDITS",
          quit: "FR QUIT",
          quickSave: "FR QUICK SAVE",
          back: "FR BACK",
          fullscreen: "FR TOGGLE FULLSCREEN",
        },
      },
      options: {
        allowFullscreen: true,
      },
      credits: {
        lines: ["FR DESIGNED BY EVAVO"],
      },
    });
  });

  it("falls back to canonical source copy when a draft pack is extended later", () => {
    const draftManifest = localisationManifestSchema.parse({
      manifestVersion: 1,
      projectId: project.id,
      sourceLocale: "en-AU",
      locales: [
        {
          locale: "fr-FR",
          status: "draft",
          entries: collectLocalisationSourceEntries(project).map((entry) => ({
            key: entry.key,
            text: `FR ${entry.text}`,
          })),
        },
      ],
    });
    const basePack = createRuntimeLocalisationPack(project, draftManifest, "fr-FR");
    const extended = extendRuntimeLocalisationPack(basePack, frontEndSources);
    const bundled = parseRuntimeBundle({ ...sourceBundle, localisation: extended });
    const localised = localiseRuntimeFrontEnd(bundled, "fr-FR");

    expect(
      extended.sourceEntries.some(
        (entry) => entry.key === frontEndLocalisationKey("menu.newGame"),
      ),
    ).toBe(true);
    expect(localised.frontEnd?.menu.labels.newGame).toBe("NEW GAME");
  });

  it("rejects adding untranslated front-end copy to an existing release pack", () => {
    const releaseManifest = localisationManifestSchema.parse({
      manifestVersion: 1,
      projectId: project.id,
      sourceLocale: "en-AU",
      locales: [
        {
          locale: "fr-FR",
          status: "release",
          entries: collectLocalisationSourceEntries(project).map((entry) => ({
            key: entry.key,
            text: `FR ${entry.text}`,
          })),
        },
      ],
    });
    const releasePack = createRuntimeLocalisationPack(
      project,
      releaseManifest,
      "fr-FR",
    );

    expect(() => extendRuntimeLocalisationPack(releasePack, frontEndSources)).toThrow(
      RuntimeLocalisationCompilationError,
    );
  });
});
