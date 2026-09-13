import { describe, expect, it } from "vitest";
import { parseAdventureProject } from "../src/index.js";
import {
  canonicaliseLocalisationManifest,
  createLocalisationTemplate,
  createPseudoLocalisationLocale,
  extractLocalisableText,
  localisationManifestSchema,
  localisationPlaceholders,
  pseudoLocaliseText,
  resolveLocalisedText,
  summariseLocalisationCoverage,
  upsertLocalisationEntry,
  validateLocalisationManifest,
} from "../src/localisation.js";

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.localisation",
  title: "The Red Ledger",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: true,
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
              actions: [
                {
                  kind: "say",
                  text: "The ledger has {pageCount} missing pages.",
                },
              ],
            },
          ],
          fallbackText: "The cover is still damp.",
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
  actors: [
    {
      id: "actor.detective",
      name: "Mara Voss",
      frames: [],
      animations: [],
    },
  ],
  dialogues: [
    {
      id: "dialogue.clerk",
      name: "Night clerk",
      startNodeId: "dialogue-node.clerk.start",
      nodes: [
        {
          id: "dialogue-node.clerk.start",
          enterActions: [],
          lines: [
            {
              id: "dialogue-line.clerk.warning",
              speakerId: "actor.detective",
              text: "Who signed page {pageCount}?",
            },
          ],
          choices: [
            {
              id: "dialogue-choice.clerk.ledger",
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
      durationTicks: 60,
      skip: { allowed: true, completionActions: [] },
      tracks: [
        {
          id: "sequence-track.intro.dialogue",
          kind: "dialogue",
          cues: [
            {
              kind: "speech",
              atTick: 0,
              speakerId: "actor.detective",
              text: "The office light was already on.",
            },
          ],
        },
      ],
    },
  ],
  assets: [
    { id: "asset.office", path: "art/office.png", kind: "image" },
    { id: "asset.key", path: "art/key.png", kind: "image" },
  ],
  inventoryItems: [
    {
      id: "item.archive-key",
      name: "Archive key",
      description: "A brass key marked B12.",
      iconAssetId: "asset.key",
    },
  ],
});

const translatedEntries = () =>
  extractLocalisableText(project).map((entry) => ({
    key: entry.key,
    text: entry.text.replace("{pageCount}", "{pageCount}"),
  }));

describe("localisable source extraction", () => {
  it("extracts stable project, scene, dialogue, sequence, action and inventory keys", () => {
    const entries = extractLocalisableText(project);
    const keys = entries.map((entry) => entry.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        "project.title",
        "scene.office.name",
        "hotspot.ledger.fallback",
        "interaction.ledger.look.action.0.say",
        "dialogue-line.clerk.warning.text",
        "dialogue-choice.clerk.ledger.text",
        "sequence.intro.sequence-track.intro.dialogue.cue.0.speech",
        "item.archive-key.description",
      ]),
    );
    expect(entries).toEqual([...entries].sort((left, right) => left.key.localeCompare(right.key)));
  });

  it("preserves placeholders during deterministic pseudo-localisation", () => {
    const source = "The ledger has {pageCount} missing pages.";
    const pseudo = pseudoLocaliseText(source, { expansionRatio: 0.2 });

    expect(localisationPlaceholders(pseudo)).toEqual(["pageCount"]);
    expect(pseudo).toContain("{pageCount}");
    expect(pseudo.startsWith("[!! ")).toBe(true);
    expect(createPseudoLocalisationLocale(project).entries).toHaveLength(
      extractLocalisableText(project).length,
    );
  });
});

describe("localisation validation and resolution", () => {
  it("accepts a complete release locale and resolves exact text", () => {
    const manifest = localisationManifestSchema.parse({
      manifestVersion: 1,
      projectId: project.id,
      sourceLocale: "en-AU",
      locales: [
        {
          locale: "fr-FR",
          status: "release",
          entries: translatedEntries(),
        },
      ],
    });

    expect(validateLocalisationManifest(project, manifest)).toEqual([]);
    expect(resolveLocalisedText(project, manifest, "fr-FR", "project.title")).toMatchObject({
      text: "The Red Ledger",
      resolvedLocale: "fr-FR",
      sourceFallback: false,
    });
  });

  it("uses explicit locale fallback before canonical source text", () => {
    const sourceEntries = translatedEntries();
    const manifest = localisationManifestSchema.parse({
      manifestVersion: 1,
      projectId: project.id,
      sourceLocale: "en-AU",
      locales: [
        {
          locale: "fr-FR",
          status: "review",
          entries: sourceEntries,
        },
        {
          locale: "fr-CA",
          status: "release",
          fallbackLocale: "fr-FR",
          entries: [],
        },
      ],
    });

    const resolved = resolveLocalisedText(project, manifest, "fr-CA", "project.title");
    expect(resolved).toMatchObject({
      resolvedLocale: "fr-FR",
      sourceFallback: false,
      fallbackDepth: 1,
    });
    expect(validateLocalisationManifest(project, manifest).map((issue) => issue.code)).toContain(
      "fallback-localisation-used",
    );
  });

  it("reports unknown keys, missing release text, placeholder drift and fallback cycles", () => {
    const manifest = localisationManifestSchema.parse({
      manifestVersion: 1,
      projectId: project.id,
      sourceLocale: "en-AU",
      locales: [
        {
          locale: "de-DE",
          status: "release",
          fallbackLocale: "de-AT",
          entries: [
            { key: "unknown.key", text: "Unknown" },
            {
              key: "interaction.ledger.look.action.0.say",
              text: "Das Buch hat {wrongCount} fehlende Seiten.",
            },
          ],
        },
        {
          locale: "de-AT",
          status: "draft",
          fallbackLocale: "de-DE",
          entries: [],
        },
      ],
    });

    expect(validateLocalisationManifest(project, manifest).map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "unknown-localisation-key",
        "missing-localisation-key",
        "placeholder-mismatch",
        "fallback-locale-cycle",
      ]),
    );
  });
});

describe("localisation authoring helpers", () => {
  it("creates complete templates, upserts entries and reports direct coverage", () => {
    const template = createLocalisationTemplate(project, "en-AU", [
      { locale: "es-ES", label: "Español", status: "review" },
    ]);
    const updated = upsertLocalisationEntry(template, "es-ES", "project.title", "El libro rojo");
    const summary = summariseLocalisationCoverage(project, updated)[0];

    expect(updated.locales[0]?.entries.find((entry) => entry.key === "project.title")?.text).toBe(
      "El libro rojo",
    );
    expect(summary?.direct).toBe(1);
    expect(summary?.total).toBe(extractLocalisableText(project).length);
    expect(canonicaliseLocalisationManifest(updated).locales[0]?.entries[0]?.key).toBe(
      [...updated.locales[0]!.entries].sort((left, right) => left.key.localeCompare(right.key))[0]?.key,
    );
  });
});
