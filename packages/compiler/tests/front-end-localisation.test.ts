import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { parseClassicFrontEndManifest } from "@evavo/adventure-project-schema/front-end";
import {
  collectLocalisationSourceEntries,
  extractFrontEndLocalisableText,
  localisationManifestSchema,
} from "@evavo/adventure-project-schema/localisation";
import {
  localiseRuntimeFrontEnd,
  parseRuntimeBundle,
  RuntimeLocalisationCompilationError,
} from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { canonicalStringify, type CompiledProject } from "../src/index.js";
import { attachRuntimeFrontEnd } from "../src/with-front-end.js";
import { attachRuntimeLocalisation } from "../src/with-localisation.js";

const hash = "0".repeat(64);
const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.compiler-front-end-localisation",
  title: "Compiler Front End",
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

const bundle = parseRuntimeBundle({
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
});

const compiled: CompiledProject = {
  bundle,
  canonicalJson: canonicalStringify(bundle),
  fingerprint: "fnv1a64:0000000000000000",
  warnings: [],
};

describe("front-end and localisation compiler ordering", () => {
  it("includes front-end sources when localisation is attached after the front end", () => {
    const withFrontEnd = attachRuntimeFrontEnd(compiled, frontEnd);
    const sources = collectLocalisationSourceEntries(
      project,
      extractFrontEndLocalisableText(frontEnd),
    );
    const manifest = localisationManifestSchema.parse({
      manifestVersion: 1,
      projectId: project.id,
      sourceLocale: "en-AU",
      locales: [
        {
          locale: "fr-FR",
          status: "release",
          entries: sources.map((entry) => ({
            key: entry.key,
            text: `FR ${entry.text}`,
          })),
        },
      ],
    });

    const localised = attachRuntimeLocalisation(
      withFrontEnd,
      project,
      manifest,
      "fr-FR",
    );
    expect(
      localiseRuntimeFrontEnd(localised.bundle, "fr-FR").frontEnd,
    ).toMatchObject({
      publisher: {
        name: "FR EVAVO",
        presents: "FR ADVENTURE STUDIO PRESENTS",
      },
      title: {
        kicker: "FR A CLASSIC POINT AND CLICK ADVENTURE",
      },
      menu: {
        labels: {
          newGame: "FR NEW GAME",
          loadGame: "FR LOAD GAME",
        },
      },
      credits: {
        lines: ["FR DESIGNED BY EVAVO"],
      },
    });
  });

  it("extends a draft localisation pack when the front end is attached later", () => {
    const manifest = localisationManifestSchema.parse({
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

    const withLocalisation = attachRuntimeLocalisation(
      compiled,
      project,
      manifest,
      "fr-FR",
    );
    const complete = attachRuntimeFrontEnd(withLocalisation, frontEnd);

    expect(complete.bundle.localisation?.sourceEntries).toHaveLength(
      collectLocalisationSourceEntries(
        project,
        extractFrontEndLocalisableText(frontEnd),
      ).length,
    );
    expect(
      localiseRuntimeFrontEnd(complete.bundle, "fr-FR").frontEnd?.menu.labels
        .newGame,
    ).toBe("NEW GAME");
  });

  it("rejects a release localisation pack that lacks later front-end translations", () => {
    const manifest = localisationManifestSchema.parse({
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
    const withLocalisation = attachRuntimeLocalisation(
      compiled,
      project,
      manifest,
      "fr-FR",
    );

    expect(() => attachRuntimeFrontEnd(withLocalisation, frontEnd)).toThrow(
      RuntimeLocalisationCompilationError,
    );
  });
});
