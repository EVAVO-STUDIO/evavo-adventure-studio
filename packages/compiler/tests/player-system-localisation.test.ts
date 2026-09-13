import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  collectLocalisationSourceEntries,
  extractPlayerSystemLocalisableText,
  localisationManifestSchema,
  playerSystemLocalisationKey,
} from "@evavo/adventure-project-schema/localisation";
import {
  parseRuntimeBundle,
  RuntimeLocalisationCompilationError,
} from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { canonicalStringify, type CompiledProject } from "../src/index.js";
import {
  attachRuntimeLocalisation,
  localisationRequestsPlayerSystemText,
} from "../src/with-localisation.js";

const hash = "0".repeat(64);
const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.player-system-localisation",
  title: "Player System Localisation",
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

const coreSources = collectLocalisationSourceEntries(project);
const playerSystemSources = extractPlayerSystemLocalisableText(project.id);

const manifestWith = (
  status: "draft" | "release",
  playerEntries: readonly { readonly key: string; readonly text: string }[],
) =>
  localisationManifestSchema.parse({
    manifestVersion: 1,
    projectId: project.id,
    sourceLocale: "en-AU",
    locales: [
      {
        locale: "fr-FR",
        status,
        entries: [
          ...coreSources.map((entry) => ({ key: entry.key, text: `FR ${entry.text}` })),
          ...playerEntries,
        ],
      },
    ],
  });

describe("player system localisation compilation", () => {
  it("keeps legacy localisation manifests source-compatible when they do not opt in", () => {
    const manifest = manifestWith("release", []);
    expect(localisationRequestsPlayerSystemText(manifest)).toBe(false);

    const result = attachRuntimeLocalisation(compiled, project, manifest, "fr-FR");
    expect(
      result.bundle.localisation?.sourceEntries.some((entry) =>
        entry.key.startsWith("playerSystem."),
      ),
    ).toBe(false);
  });

  it("embeds the complete Player system catalogue when any system key is authored", () => {
    const key = playerSystemLocalisationKey("menu.resume");
    const manifest = manifestWith("draft", [{ key, text: "REPRENDRE" }]);
    expect(localisationRequestsPlayerSystemText(manifest)).toBe(true);

    const result = attachRuntimeLocalisation(compiled, project, manifest, "fr-FR");
    const sourceKeys = result.bundle.localisation?.sourceEntries.map((entry) => entry.key) ?? [];
    expect(sourceKeys).toEqual(
      expect.arrayContaining(playerSystemSources.map((entry) => entry.key)),
    );
    expect(
      result.bundle.localisation?.locales[0]?.entries.find((entry) => entry.key === key)?.text,
    ).toBe("REPRENDRE");
  });

  it("fails closed when a release locale opts in without complete system copy", () => {
    const key = playerSystemLocalisationKey("menu.resume");
    const manifest = manifestWith("release", [{ key, text: "REPRENDRE" }]);

    expect(() => attachRuntimeLocalisation(compiled, project, manifest, "fr-FR")).toThrow(
      RuntimeLocalisationCompilationError,
    );
  });
});
