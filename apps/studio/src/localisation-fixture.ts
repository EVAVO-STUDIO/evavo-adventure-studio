import {
  type LocalisationTextFitProfile,
  localisationTextFitProfileSchema,
} from "@evavo/adventure-bitmap-font/localisation";
import {
  canonicaliseLocalisationManifest,
  createLocalisationTemplate,
  createPseudoLocalisationLocale,
  extractLocalisableText,
  type LocalisationManifest,
} from "@evavo/adventure-project-schema/localisation";
import { studioBitmapFonts, studioFontProject } from "./font-fixture.js";

const sourceEntries = extractLocalisableText(studioFontProject);
const template = createLocalisationTemplate(studioFontProject, "en-AU", [
  { locale: "fr-FR", label: "Français", status: "review" },
]);
const french = template.locales[0];
if (!french) throw new Error("Studio localisation fixture requires a French locale.");

export const studioLocalisationManifest: LocalisationManifest = canonicaliseLocalisationManifest({
  ...template,
  locales: [
    {
      ...french,
      entries: sourceEntries.map((entry, index) => ({
        key: entry.key,
        text: index < 8 ? `FR ${entry.text}` : "",
      })),
    },
    createPseudoLocalisationLocale(studioFontProject, {
      locale: "qps-ploc",
      label: "Pseudo-localised",
      status: "draft",
      expansionRatio: 0.35,
    }),
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
        id: "text-fit.body-copy",
        roles: [
          "scene-fallback",
          "hotspot-fallback",
          "dialogue-line",
          "dialogue-choice",
          "sequence-speech",
          "action-say",
          "inventory-description",
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
    ],
  });

export { studioBitmapFonts, studioFontProject };