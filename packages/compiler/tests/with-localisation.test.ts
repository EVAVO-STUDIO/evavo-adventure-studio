import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  extractLocalisableText,
  localisationManifestSchema,
} from "@evavo/adventure-project-schema/localisation";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { type CompiledProject, canonicalStringify } from "../src/index.js";
import { attachRuntimeLocalisation } from "../src/with-localisation.js";

const hash = "0".repeat(64);
const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.compiler-locale",
  title: "Compiler Locale",
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
        { id: "entrance.room", position: { x: 20, y: 170 }, facing: "east" },
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

const manifest = localisationManifestSchema.parse({
  manifestVersion: 1,
  projectId: project.id,
  sourceLocale: "en-AU",
  locales: [
    {
      locale: "fr-FR",
      status: "release",
      entries: extractLocalisableText(project).map((entry) => ({
        key: entry.key,
        text: `FR ${entry.text}`,
      })),
    },
  ],
});

describe("runtime localisation compilation", () => {
  it("attaches a deterministic locale pack without mutating the source compilation", () => {
    const first = attachRuntimeLocalisation(compiled, project, manifest, "fr-FR");
    const second = attachRuntimeLocalisation(compiled, project, manifest, "fr-FR");

    expect(compiled.bundle.localisation).toBeUndefined();
    expect(first.bundle.localisation?.defaultLocale).toBe("fr-FR");
    expect(first.bundle.localisation?.sourceEntries).toHaveLength(
      extractLocalisableText(project).length,
    );
    expect(second).toEqual(first);
    expect(first.fingerprint).toMatch(/^fnv1a64:[0-9a-f]{16}$/u);
    expect(first.fingerprint).not.toBe(compiled.fingerprint);
  });

  it("rejects a source project that does not own the compiled bundle", () => {
    const mismatch = { ...project, id: "project.other" as typeof project.id };
    expect(() => attachRuntimeLocalisation(compiled, mismatch, manifest)).toThrow(/does not match/u);
  });
});
