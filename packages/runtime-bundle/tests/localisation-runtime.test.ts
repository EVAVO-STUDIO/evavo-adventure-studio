import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  extractLocalisableText,
  localisationManifestSchema,
} from "@evavo/adventure-project-schema/localisation";
import { describe, expect, it } from "vitest";
import {
  createRuntimeLocalisationPack,
  localiseRuntimeBundle,
  parseRuntimeBundle,
  resolveRuntimeLocalisedText,
  runtimeBundleSaveCompatibilityView,
} from "../src/index.js";

const hash = "0".repeat(64);

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.runtime-localisation",
  title: "The Red Ledger",
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
  scenes: [
    {
      id: "scene.office",
      name: "Rain Office",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.office",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [
        {
          id: "hotspot.ledger",
          name: "Red ledger",
          shape: {
            points: [
              { x: 10, y: 10 },
              { x: 40, y: 10 },
              { x: 40, y: 30 },
            ],
          },
          interactions: [
            {
              id: "interaction.ledger.look",
              verb: "look",
              actions: [{ kind: "say", text: "Three pages are missing." }],
            },
          ],
          fallbackText: "The cover is damp.",
        },
      ],
      entrances: [
        {
          id: "entrance.office",
          position: { x: 20, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing useful happens.",
    },
  ],
  actors: [{ id: "actor.detective", name: "Mara Voss", frames: [], animations: [] }],
  dialogues: [
    {
      id: "dialogue.clerk",
      name: "Night clerk",
      startNodeId: "node.start",
      nodes: [
        {
          id: "node.start",
          enterActions: [],
          lines: [{ id: "line.warning", text: "Do not open the ledger." }],
          choices: [
            {
              id: "choice.ask",
              text: "Ask about the ledger",
              actions: [],
              closeDialogue: true,
            },
          ],
          exitActions: [],
        },
      ],
    },
  ],
  sequences: [
    {
      id: "sequence.intro",
      name: "Rain arrival",
      mode: "cutscene",
      durationTicks: 20,
      skip: { allowed: true, completionActions: [] },
      tracks: [
        {
          id: "track.dialogue",
          kind: "dialogue",
          cues: [{ kind: "speech", atTick: 0, text: "The light was already on." }],
        },
      ],
    },
  ],
  assets: [{ id: "asset.office", path: "art/office.png", kind: "image" }],
  inventoryItems: [
    {
      id: "item.blank-note",
      name: "Blank note",
      description: "",
      iconAssetId: "asset.office",
    },
  ],
});

const sourceBundleInput = {
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
      metadata: {
        kind: "image",
        width: 320,
        height: 200,
        palette: false,
        colourCount: 64,
      },
    },
  ],
  inventoryItems: project.inventoryItems,
  actors: project.actors,
  scenes: project.scenes.map((scene) => ({
    ...scene,
    hotspots: scene.hotspots.map((hotspot) => ({
      ...hotspot,
      interactionIndex: { '["look",null]': ["interaction.ledger.look"] },
    })),
  })),
  dialogues: project.dialogues.map((dialogue) => ({
    ...dialogue,
    nodeIndex: { "node.start": 0 },
  })),
  sequences: project.sequences.map((sequence) => ({
    ...sequence,
    cueCount: 1,
  })),
};

const manifest = localisationManifestSchema.parse({
  manifestVersion: 1,
  projectId: project.id,
  sourceLocale: "en-AU",
  locales: [
    {
      locale: "fr-FR",
      label: "Français",
      status: "release",
      entries: extractLocalisableText(project).map((entry) => ({
        key: entry.key,
        text: `FR ${entry.text}`,
      })),
    },
  ],
});

const sourceBundle = parseRuntimeBundle(sourceBundleInput);
const pack = createRuntimeLocalisationPack(project, manifest, "fr-FR");
const bundled = parseRuntimeBundle({ ...sourceBundleInput, localisation: pack });

describe("runtime localisation packs", () => {
  it("resolves canonical source and exact target text", () => {
    expect(resolveRuntimeLocalisedText(pack, "en-AU", "project.title")).toMatchObject({
      text: "The Red Ledger",
      resolvedLocale: "en-AU",
      sourceFallback: true,
    });
    expect(resolveRuntimeLocalisedText(pack, "fr-FR", "project.title")).toMatchObject({
      text: "FR The Red Ledger",
      resolvedLocale: "fr-FR",
      sourceFallback: false,
    });
  });

  it("projects every gameplay text surface without changing runtime identity", () => {
    const localised = localiseRuntimeBundle(bundled, "fr-FR");

    expect(localised.title).toBe("FR The Red Ledger");
    expect(localised.scenes[0]?.name).toBe("FR Rain Office");
    expect(localised.scenes[0]?.hotspots[0]?.interactions[0]?.actions[0]).toMatchObject({
      kind: "say",
      text: "FR Three pages are missing.",
    });
    expect(localised.dialogues[0]?.nodes[0]?.lines[0]?.text).toBe(
      "FR Do not open the ledger.",
    );
    expect(localised.sequences[0]?.tracks[0]?.cues[0]).toMatchObject({
      kind: "speech",
      text: "FR The light was already on.",
    });
    expect(localised.inventoryItems[0]).toMatchObject({
      id: "item.blank-note",
      name: "FR Blank note",
      description: "",
    });
    expect(localised.projectId).toBe(bundled.projectId);
    expect(localised.scenes[0]?.id).toBe(bundled.scenes[0]?.id);
    expect(localised.dialogues[0]?.nodeIndex).toEqual(bundled.dialogues[0]?.nodeIndex);
  });

  it("produces the same save-compatibility view in every language", () => {
    const localised = localiseRuntimeBundle(bundled, "fr-FR");

    expect(runtimeBundleSaveCompatibilityView(bundled)).toEqual(sourceBundle);
    expect(runtimeBundleSaveCompatibilityView(localised)).toEqual(sourceBundle);
  });
});
