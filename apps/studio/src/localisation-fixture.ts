import {
  type LocalisationTextFitProfile,
  localisationTextFitProfileSchema,
} from "@evavo/adventure-bitmap-font/localisation";
import {
  canonicaliseLocalisationManifest,
  collectLocalisationSourceEntries,
  createLocalisationTemplate,
  createPseudoLocalisationLocale,
  extractFrontEndLocalisableText,
  extractLifecycleLocalisableText,
  frontEndLocalisationKey,
  lifecycleLocalisationKey,
  type LocalisationManifest,
  type LocalisationSourceEntry,
} from "@evavo/adventure-project-schema/localisation";
import { studioBitmapFonts, studioFontProject } from "./font-fixture.js";
import { studioFrontEndManifest } from "./front-end-fixture.js";
import { studioLifecycleManifest } from "./lifecycle-fixture.js";

export const studioLocalisationSupplementalSources: readonly LocalisationSourceEntry[] = [
  ...extractFrontEndLocalisableText(studioFrontEndManifest),
  ...extractLifecycleLocalisableText(studioLifecycleManifest),
].sort((left, right) => left.key.localeCompare(right.key));

const sourceEntries = collectLocalisationSourceEntries(
  studioFontProject,
  studioLocalisationSupplementalSources,
);
const template = createLocalisationTemplate(
  studioFontProject,
  "en-AU",
  [{ locale: "fr-FR", label: "Français", status: "review" }],
  studioLocalisationSupplementalSources,
);
const french = template.locales[0];
if (!french) throw new Error("Studio localisation fixture requires a French locale.");

const frenchTranslations: Readonly<Record<string, string>> = {
  "project.title": "Le registre rouge",
  [frontEndLocalisationKey("publisher.presents")]: "ADVENTURE STUDIO PRÉSENTE",
  [frontEndLocalisationKey("title.kicker")]: "UNE AVENTURE POINT AND CLICK CLASSIQUE",
  [frontEndLocalisationKey("menu.newGame")]: "NOUVELLE PARTIE",
  [frontEndLocalisationKey("menu.loadGame")]: "CHARGER UNE PARTIE",
  [frontEndLocalisationKey("menu.options")]: "OPTIONS",
  [frontEndLocalisationKey("menu.credits")]: "GÉNÉRIQUE",
  [frontEndLocalisationKey("menu.quit")]: "QUITTER",
  [frontEndLocalisationKey("menu.back")]: "RETOUR",
  [lifecycleLocalisationKey("outcome.case-closed", "title")]: "Affaire classée",
  [lifecycleLocalisationKey("outcome.case-closed", "message")]:
    "La piste est froide. Mara ne peut plus terminer l'enquête.",
  [lifecycleLocalisationKey("outcome.case-closed", "menu.quickRetry")]: "RÉESSAYER",
  [lifecycleLocalisationKey("outcome.case-closed", "menu.loadGame")]: "CHARGER",
  [lifecycleLocalisationKey("outcome.case-closed", "menu.returnToTitle")]:
    "RETOUR AU TITRE",
};

export const studioLocalisationManifest: LocalisationManifest = canonicaliseLocalisationManifest({
  ...template,
  locales: [
    {
      ...french,
      entries: sourceEntries.map((entry) => ({
        key: entry.key,
        text: frenchTranslations[entry.key] ?? "",
      })),
    },
    createPseudoLocalisationLocale(
      studioFontProject,
      {
        locale: "qps-ploc",
        label: "Pseudo-localised",
        status: "draft",
        expansionRatio: 0.35,
      },
      studioLocalisationSupplementalSources,
    ),
  ],
});

export const studioLocalisationTextFitProfile: LocalisationTextFitProfile =
  localisationTextFitProfileSchema.parse({
    profileVersion: 1,
    projectId: studioFontProject.id,
    rules: [
      {
        id: "text-fit.compact-label",
        roles: [
          "project-title",
          "scene-name",
          "hotspot-name",
          "actor-name",
          "dialogue-name",
          "sequence-name",
          "inventory-name",
          "lifecycle-title",
          "lifecycle-menu-label",
          "front-end-menu-label",
        ],
        fontId: "bitmap-font.dialogue",
        maxWidth: 180,
        maxHeight: 20,
        maxLines: 2,
        alignment: "left",
        lineSpacing: 1,
        tabSpaces: 4,
        overflowSeverity: "warning",
        glyphSeverity: "warning",
      },
      {
        id: "text-fit.front-end-heading",
        roles: ["front-end-publisher", "front-end-title"],
        fontId: "bitmap-font.dialogue",
        maxWidth: 260,
        maxHeight: 30,
        maxLines: 3,
        alignment: "center",
        lineSpacing: 1,
        tabSpaces: 4,
        overflowSeverity: "warning",
        glyphSeverity: "warning",
      },
      {
        id: "text-fit.body-copy",
        roles: [
          "scene-fallback",
          "hotspot-fallback",
          "dialogue-line",
          "dialogue-choice",
          "sequence-speech",
          "action-say",
          "inventory-description",
          "lifecycle-message",
        ],
        fontId: "bitmap-font.dialogue",
        maxWidth: 284,
        maxHeight: 44,
        maxLines: 4,
        alignment: "left",
        lineSpacing: 1,
        tabSpaces: 4,
        overflowSeverity: "error",
        glyphSeverity: "warning",
      },
      {
        id: "text-fit.front-end-credit",
        roles: ["front-end-credit"],
        fontId: "bitmap-font.dialogue",
        maxWidth: 260,
        maxHeight: 50,
        maxLines: 4,
        alignment: "center",
        lineSpacing: 1,
        tabSpaces: 4,
        overflowSeverity: "warning",
        glyphSeverity: "warning",
      },
    ],
  });

export { studioBitmapFonts, studioFontProject };
