import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { parseGameLifecycleManifest } from "@evavo/adventure-project-schema/lifecycle";
import {
  collectLocalisationSourceEntries,
  extractLifecycleLocalisableText,
  localisationManifestSchema,
} from "@evavo/adventure-project-schema/localisation";
import {
  localiseRuntimeBundle,
  parseRuntimeBundle,
} from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { canonicalStringify, type CompiledProject } from "../src/index.js";
import { attachRuntimeLifecycle } from "../src/with-lifecycle.js";
import { attachRuntimeLocalisation } from "../src/with-localisation.js";

const hash = "0".repeat(64);
const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.compiler-lifecycle-localisation",
  title: "Compiler Lifecycle",
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
      id: "outcome.ending",
      kind: "success",
      priority: 100,
      when: { kind: "flag", flag: "case.solved", equals: true },
      title: "THE CASE IS CLOSED",
      message: "The rain finally stops.",
      menu: {
        allowQuickRetry: false,
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

describe("lifecycle and localisation compiler ordering", () => {
  it("includes lifecycle source entries when localisation is attached after lifecycle", () => {
    const withLifecycle = attachRuntimeLifecycle(compiled, lifecycle);
    const sources = collectLocalisationSourceEntries(
      project,
      extractLifecycleLocalisableText(lifecycle),
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
      withLifecycle,
      project,
      manifest,
      "fr-FR",
    );
    expect(
      localiseRuntimeBundle(localised.bundle, "fr-FR").lifecycle?.outcomes[0],
    ).toMatchObject({
      title: "FR THE CASE IS CLOSED",
      message: "FR The rain finally stops.",
    });
  });

  it("extends a draft localisation pack when lifecycle is attached later", () => {
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
    const complete = attachRuntimeLifecycle(withLocalisation, lifecycle);

    expect(complete.bundle.localisation?.sourceEntries).toHaveLength(
      collectLocalisationSourceEntries(
        project,
        extractLifecycleLocalisableText(lifecycle),
      ).length,
    );
    expect(
      localiseRuntimeBundle(complete.bundle, "fr-FR").lifecycle?.outcomes[0]
        ?.title,
    ).toBe("THE CASE IS CLOSED");
  });
});
