import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { parseGameLifecycleManifest } from "@evavo/adventure-project-schema/lifecycle";
import {
  collectLocalisationSourceEntries,
  extractLifecycleLocalisableText,
  lifecycleLocalisationKey,
  localisationManifestSchema,
} from "@evavo/adventure-project-schema/localisation";
import { describe, expect, it } from "vitest";
import {
  createRuntimeLocalisationPack,
  extendRuntimeLocalisationPack,
  localiseRuntimeBundle,
  parseRuntimeBundle,
  RuntimeLocalisationCompilationError,
  runtimeBundleSaveCompatibilityView,
} from "../src/index.js";

const hash = "0".repeat(64);
const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.lifecycle-runtime-localisation",
  title: "Lifecycle Runtime",
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

const lifecycle = parseGameLifecycleManifest({
  manifestVersion: 1,
  projectId: project.id,
  outcomes: [
    {
      id: "outcome.case-closed",
      kind: "failure",
      priority: 20,
      when: { kind: "flag", flag: "case.failed", equals: true },
      title: "CASE CLOSED",
      message: "The ledger disappears into the rain.",
      menu: {
        allowQuickRetry: true,
        allowLoad: true,
        allowRestart: true,
        allowTitle: true,
        labels: {
          quickRetry: "QUICK RETRY",
          loadGame: "LOAD GAME",
          restartGame: "RESTART GAME",
          returnToTitle: "RETURN TO TITLE",
          back: "BACK",
        },
      },
    },
  ],
});

const lifecycleSources = extractLifecycleLocalisableText(lifecycle);
const allSources = collectLocalisationSourceEntries(project, lifecycleSources);
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
  lifecycle,
});

describe("runtime lifecycle localisation", () => {
  it("localises outcome copy and every recovery label through the canonical pack", () => {
    const pack = createRuntimeLocalisationPack(
      project,
      manifest,
      "fr-FR",
      lifecycleSources,
    );
    const bundled = parseRuntimeBundle({ ...sourceBundle, localisation: pack });
    const localised = localiseRuntimeBundle(bundled, "fr-FR");
    const outcome = localised.lifecycle?.outcomes[0];

    expect(pack.sourceEntries).toHaveLength(allSources.length);
    expect(outcome).toMatchObject({
      id: "outcome.case-closed",
      title: "FR CASE CLOSED",
      message: "FR The ledger disappears into the rain.",
      when: lifecycle.outcomes[0]?.when,
    });
    expect(outcome?.menu.labels).toEqual({
      quickRetry: "FR QUICK RETRY",
      loadGame: "FR LOAD GAME",
      restartGame: "FR RESTART GAME",
      returnToTitle: "FR RETURN TO TITLE",
      back: "FR BACK",
    });
    expect(runtimeBundleSaveCompatibilityView(localised)).toEqual(sourceBundle);
  });

  it("can extend an existing draft pack when lifecycle is attached later", () => {
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
    const extended = extendRuntimeLocalisationPack(basePack, lifecycleSources);
    const bundled = parseRuntimeBundle({ ...sourceBundle, localisation: extended });
    const localised = localiseRuntimeBundle(bundled, "fr-FR");

    expect(
      extended.sourceEntries.some(
        (entry) =>
          entry.key === lifecycleLocalisationKey("outcome.case-closed", "title"),
      ),
    ).toBe(true);
    expect(localised.lifecycle?.outcomes[0]?.title).toBe("CASE CLOSED");
  });

  it("rejects adding untranslated lifecycle copy to an existing release pack", () => {
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

    expect(() => extendRuntimeLocalisationPack(releasePack, lifecycleSources)).toThrow(
      RuntimeLocalisationCompilationError,
    );
  });

  it("rejects conflicting canonical definitions for the same lifecycle key", () => {
    const pack = createRuntimeLocalisationPack(
      project,
      manifest,
      "fr-FR",
      lifecycleSources,
    );
    expect(() =>
      extendRuntimeLocalisationPack(pack, [
        {
          ...lifecycleSources[0]!,
          text: "A different canonical source string.",
        },
      ]),
    ).toThrow(/conflicting canonical definitions/u);
  });
});
