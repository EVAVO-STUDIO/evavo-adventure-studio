import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { parseClassicFrontEndManifest } from "@evavo/adventure-project-schema/front-end";
import {
  collectLocalisationSourceEntries,
  createLocalisationTemplate,
  createPseudoLocalisationLocale,
  extractFrontEndLocalisableText,
  frontEndLocalisationKey,
  localisationManifestSchema,
  resolveLocalisedTextWithSupplementalSources,
  summariseLocalisationCoverageWithSupplementalSources,
  validateLocalisationManifest,
  validateLocalisationManifestWithSupplementalSources,
} from "@evavo/adventure-project-schema/localisation";
import { describe, expect, it } from "vitest";

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.front-end-localisation",
  title: "Front End Localisation",
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
    kicker: "A 1994 POINT AND CLICK ADVENTURE",
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
    lines: ["DESIGNED BY EVAVO", "RUNNING ON ADVENTURE STUDIO"],
  },
});

const frontEndSources = extractFrontEndLocalisableText(frontEnd);

describe("classic front-end localisation sources", () => {
  it("extracts stable publisher, title, menu and credit keys", () => {
    expect(frontEndSources).toHaveLength(14);
    expect(frontEndSources.map((entry) => entry.key)).toEqual(
      expect.arrayContaining([
        frontEndLocalisationKey("publisher.name"),
        frontEndLocalisationKey("publisher.presents"),
        frontEndLocalisationKey("title.kicker"),
        frontEndLocalisationKey("menu.newGame"),
        frontEndLocalisationKey("menu.fullscreen"),
        frontEndLocalisationKey("credits.line.0"),
        frontEndLocalisationKey("credits.line.1"),
      ]),
    );
    expect(frontEndSources.map((entry) => entry.role)).toEqual(
      expect.arrayContaining([
        "front-end-publisher",
        "front-end-title",
        "front-end-menu-label",
        "front-end-credit",
      ]),
    );
  });

  it("accepts front-end translations only with the supplemental source contract", () => {
    const sources = collectLocalisationSourceEntries(project, frontEndSources);
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

    expect(
      validateLocalisationManifest(project, manifest).some(
        (issue) =>
          issue.code === "unknown-localisation-key" &&
          issue.key === frontEndLocalisationKey("menu.newGame"),
      ),
    ).toBe(true);
    expect(
      validateLocalisationManifestWithSupplementalSources(
        project,
        manifest,
        frontEndSources,
      ).filter((issue) => issue.severity === "error"),
    ).toEqual([]);
  });

  it("creates complete templates, pseudo locales and coverage for sidecar text", () => {
    const template = createLocalisationTemplate(
      project,
      "en-AU",
      [{ locale: "fr-FR", status: "draft" }],
      frontEndSources,
    );
    const target = template.locales[0];
    if (!target) throw new Error("Expected a target locale.");
    const allSources = collectLocalisationSourceEntries(project, frontEndSources);
    expect(target.entries.map((entry) => entry.key)).toEqual(
      allSources.map((entry) => entry.key),
    );

    const pseudo = createPseudoLocalisationLocale(
      project,
      { locale: "qps-ploc", expansionRatio: 0 },
      frontEndSources,
    );
    expect(pseudo.entries).toHaveLength(allSources.length);
    expect(
      pseudo.entries.find((entry) => entry.key === frontEndLocalisationKey("menu.newGame"))?.text,
    ).toContain("ÑÉŴ ĞÅḾÉ");

    const translated = localisationManifestSchema.parse({
      ...template,
      locales: [
        {
          ...target,
          entries: target.entries.map((entry) => ({
            ...entry,
            text:
              entry.key === frontEndLocalisationKey("menu.newGame")
                ? "NOUVELLE PARTIE"
                : "",
          })),
        },
      ],
    });
    expect(
      resolveLocalisedTextWithSupplementalSources(
        project,
        translated,
        "fr-FR",
        frontEndLocalisationKey("menu.newGame"),
        frontEndSources,
      ),
    ).toMatchObject({
      text: "NOUVELLE PARTIE",
      resolvedLocale: "fr-FR",
      sourceFallback: false,
    });
    expect(
      summariseLocalisationCoverageWithSupplementalSources(
        project,
        translated,
        frontEndSources,
      )[0],
    ).toMatchObject({
      total: allSources.length,
      direct: 1,
      sourceFallback: allSources.length - 1,
    });
  });

  it("keeps release locales strict when front-end copy is missing", () => {
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

    const missing = validateLocalisationManifestWithSupplementalSources(
      project,
      manifest,
      frontEndSources,
    ).filter(
      (issue) =>
        issue.severity === "error" &&
        issue.code === "missing-localisation-key" &&
        issue.key?.startsWith("frontEnd."),
    );
    expect(missing).toHaveLength(frontEndSources.length);
  });
});
