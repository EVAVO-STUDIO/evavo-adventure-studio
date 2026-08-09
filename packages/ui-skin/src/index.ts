import type { BitmapFontManifest } from "@evavo/adventure-bitmap-font";
import {
  type AdventureProject,
  type Id,
  idSchema,
  type PresentationProfile,
  type Rectangle,
  rectangleSchema,
  sizeSchema,
} from "@evavo/adventure-project-schema";
import { z } from "zod";

export const uiColorSchema = z.union([
  z.number().int().min(0).max(0xffffff),
  z.tuple([
    z.number().int().min(0).max(255),
    z.number().int().min(0).max(255),
    z.number().int().min(0).max(255),
    z.number().int().min(0).max(255),
  ]),
]);
export type UiColor = z.infer<typeof uiColorSchema>;

export const uiPanelStyleSchema = z
  .object({
    fill: uiColorSchema,
    border: uiColorSchema,
    borderWidth: z.number().int().min(0).max(4),
    accent: uiColorSchema.optional(),
  })
  .strict();
export type UiPanelStyle = z.infer<typeof uiPanelStyleSchema>;

export const uiTextStyleSchema = z
  .object({
    fontId: idSchema("bitmap-font"),
    color: uiColorSchema,
    outlineColor: uiColorSchema.optional(),
    align: z.enum(["left", "center", "right"]),
  })
  .strict();
export type UiTextStyle = z.infer<typeof uiTextStyleSchema>;

export const uiRegionSchema = z
  .object({
    id: idSchema("ui-region"),
    rect: rectangleSchema,
    padding: z.number().int().min(0).max(32),
    panel: uiPanelStyleSchema,
  })
  .strict();
export type UiRegion = z.infer<typeof uiRegionSchema>;

export const uiVerbSchema = z
  .object({
    id: idSchema("ui-verb"),
    verb: z.string().min(1),
    label: z.string().min(1),
    cursorId: z.string().min(1),
    shortcut: z.string().min(1).max(1).optional(),
    iconAssetId: idSchema("asset").optional(),
    iconFrameId: idSchema("sprite-frame").optional(),
    primary: z.boolean().default(false),
  })
  .strict();
export type UiVerb = z.infer<typeof uiVerbSchema>;

export const uiVerbBarSchema = z
  .object({
    region: uiRegionSchema,
    orientation: z.enum(["horizontal", "vertical", "grid"]),
    gap: z.number().int().min(0).max(16),
    columns: z.number().int().positive().optional(),
    buttonHeight: z.number().int().positive(),
    normal: uiPanelStyleSchema,
    hover: uiPanelStyleSchema,
    pressed: uiPanelStyleSchema,
    disabled: uiPanelStyleSchema,
  })
  .strict();
export type UiVerbBar = z.infer<typeof uiVerbBarSchema>;

export const uiVerbCoinSchema = z
  .object({
    radius: z.number().int().positive(),
    itemRadius: z.number().int().positive(),
    panel: uiPanelStyleSchema,
  })
  .strict();
export type UiVerbCoin = z.infer<typeof uiVerbCoinSchema>;

export const uiInventorySchema = z
  .object({
    region: uiRegionSchema,
    slotWidth: z.number().int().positive(),
    slotHeight: z.number().int().positive(),
    gap: z.number().int().min(0).max(16),
    visibleSlots: z.number().int().positive(),
    slot: uiPanelStyleSchema,
    selected: uiPanelStyleSchema,
  })
  .strict();
export type UiInventory = z.infer<typeof uiInventorySchema>;

export const uiParserSchema = z
  .object({
    region: uiRegionSchema,
    prompt: z.string(),
    cursorCharacter: z.string().length(1),
    historyLimit: z.number().int().positive(),
  })
  .strict();
export type UiParser = z.infer<typeof uiParserSchema>;

export const uiDialogueChoicesSchema = z
  .object({
    region: uiRegionSchema,
    gap: z.number().int().min(0).max(16),
    maximumChoices: z.number().int().positive(),
    normal: uiPanelStyleSchema,
    hover: uiPanelStyleSchema,
    disabled: uiPanelStyleSchema,
  })
  .strict();
export type UiDialogueChoices = z.infer<typeof uiDialogueChoicesSchema>;

export const uiSkinSchema = z
  .object({
    id: idSchema("ui-skin"),
    name: z.string().min(1),
    interactionMode: z.enum([
      "icon-bar",
      "verb-list",
      "verb-coin",
      "two-button",
      "context",
      "parser-assisted",
    ]),
    nativeSize: sizeSchema,
    status: uiRegionSchema,
    score: uiRegionSchema.optional(),
    verbs: z.array(uiVerbSchema),
    verbBar: uiVerbBarSchema.optional(),
    verbCoin: uiVerbCoinSchema.optional(),
    inventory: uiInventorySchema.optional(),
    parser: uiParserSchema.optional(),
    dialogueChoices: uiDialogueChoicesSchema.optional(),
    fonts: z
      .object({
        status: uiTextStyleSchema,
        verb: uiTextStyleSchema.optional(),
        inventory: uiTextStyleSchema.optional(),
        score: uiTextStyleSchema.optional(),
        parser: uiTextStyleSchema.optional(),
        dialogue: uiTextStyleSchema.optional(),
      })
      .strict(),
  })
  .strict();
export type UiSkin = z.infer<typeof uiSkinSchema>;

export const uiSkinManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    defaultSkinId: idSchema("ui-skin"),
    skins: z.array(uiSkinSchema).min(1),
  })
  .strict();
export type UiSkinManifest = z.infer<typeof uiSkinManifestSchema>;

export const parseUiSkinManifest = (input: unknown): UiSkinManifest => uiSkinManifestSchema.parse(input);

export type UiSkinIssueCode =
  | "project-mismatch"
  | "duplicate-skin"
  | "missing-default-skin"
  | "default-mode-mismatch"
  | "native-size-mismatch"
  | "duplicate-region"
  | "region-out-of-bounds"
  | "region-overlap"
  | "duplicate-verb"
  | "duplicate-shortcut"
  | "unknown-icon-asset"
  | "icon-asset-kind"
  | "icon-frame-without-asset"
  | "unknown-font"
  | "missing-verb-bar"
  | "unexpected-verb-bar"
  | "missing-verb-coin"
  | "unexpected-verb-coin"
  | "missing-parser"
  | "unexpected-parser"
  | "missing-score-region"
  | "missing-verb-font"
  | "missing-parser-font"
  | "missing-score-font"
  | "insufficient-primary-verbs"
  | "icon-bar-without-icons";

export interface UiSkinIssue {
  readonly severity: "error" | "warning";
  readonly code: UiSkinIssueCode;
  readonly path: string;
  readonly message: string;
}

const addIssue = (
  issues: UiSkinIssue[],
  severity: UiSkinIssue["severity"],
  code: UiSkinIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity, code, path, message });
};

const rectanglesOverlap = (left: Rectangle, right: Rectangle): boolean =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;

const skinRegions = (skin: UiSkin): readonly UiRegion[] => [
  skin.status,
  ...(skin.score ? [skin.score] : []),
  ...(skin.verbBar ? [skin.verbBar.region] : []),
  ...(skin.inventory ? [skin.inventory.region] : []),
  ...(skin.parser ? [skin.parser.region] : []),
  ...(skin.dialogueChoices ? [skin.dialogueChoices.region] : []),
];

const fontIds = (fonts: BitmapFontManifest | null): ReadonlySet<string> =>
  new Set(fonts?.fonts.map((font) => font.id) ?? []);

const validateFontRole = (
  issues: UiSkinIssue[],
  knownFonts: ReadonlySet<string>,
  style: UiTextStyle | undefined,
  path: string,
): void => {
  if (style && !knownFonts.has(style.fontId)) {
    addIssue(
      issues,
      "error",
      "unknown-font",
      `${path}.fontId`,
      `UI font '${style.fontId}' does not exist in the bitmap-font manifest.`,
    );
  }
};

const validateModeRequirements = (
  issues: UiSkinIssue[],
  project: Pick<AdventureProject, "presentation">,
  skin: UiSkin,
  path: string,
): void => {
  const mode = skin.interactionMode;
  const requiresBar = mode === "icon-bar" || mode === "verb-list" || mode === "two-button";
  if (requiresBar && !skin.verbBar) {
    addIssue(
      issues,
      "error",
      "missing-verb-bar",
      `${path}.verbBar`,
      `${mode} skins require a persistent verb bar.`,
    );
  }
  if (!requiresBar && skin.verbBar) {
    addIssue(
      issues,
      "warning",
      "unexpected-verb-bar",
      `${path}.verbBar`,
      `${mode} skins do not normally use a persistent verb bar.`,
    );
  }
  if (mode === "verb-coin" && !skin.verbCoin) {
    addIssue(
      issues,
      "error",
      "missing-verb-coin",
      `${path}.verbCoin`,
      "Verb-coin skins require coin geometry.",
    );
  }
  if (mode !== "verb-coin" && skin.verbCoin) {
    addIssue(
      issues,
      "warning",
      "unexpected-verb-coin",
      `${path}.verbCoin`,
      `${mode} skins do not normally use a verb coin.`,
    );
  }
  if (mode === "parser-assisted" && !skin.parser) {
    addIssue(
      issues,
      "error",
      "missing-parser",
      `${path}.parser`,
      "Parser-assisted skins require a parser region.",
    );
  }
  if (mode !== "parser-assisted" && skin.parser) {
    addIssue(
      issues,
      "warning",
      "unexpected-parser",
      `${path}.parser`,
      `${mode} skins do not normally expose a parser field.`,
    );
  }
  if (project.presentation.showScore && !skin.score) {
    addIssue(
      issues,
      "error",
      "missing-score-region",
      `${path}.score`,
      "The project presentation enables score but this skin has no score region.",
    );
  }
  if ((skin.verbBar || skin.verbCoin) && !skin.fonts.verb) {
    addIssue(
      issues,
      "error",
      "missing-verb-font",
      `${path}.fonts.verb`,
      "Visible verbs require a bitmap-font role.",
    );
  }
  if (skin.parser && !skin.fonts.parser) {
    addIssue(
      issues,
      "error",
      "missing-parser-font",
      `${path}.fonts.parser`,
      "Parser text requires a bitmap-font role.",
    );
  }
  if (skin.score && !skin.fonts.score) {
    addIssue(
      issues,
      "error",
      "missing-score-font",
      `${path}.fonts.score`,
      "Score text requires a bitmap-font role.",
    );
  }
  if (mode === "two-button" && skin.verbs.filter((verb) => verb.primary).length !== 2) {
    addIssue(
      issues,
      "error",
      "insufficient-primary-verbs",
      `${path}.verbs`,
      "Two-button skins require exactly two primary verbs.",
    );
  }
  if (mode === "icon-bar" && skin.verbs.some((verb) => !verb.iconAssetId)) {
    addIssue(
      issues,
      "error",
      "icon-bar-without-icons",
      `${path}.verbs`,
      "Every icon-bar verb requires an icon asset.",
    );
  }
};

export const validateUiSkinManifest = (
  project: Pick<AdventureProject, "id" | "presentation" | "assets">,
  fonts: BitmapFontManifest | null,
  manifest: UiSkinManifest,
): readonly UiSkinIssue[] => {
  const issues: UiSkinIssue[] = [];
  if (manifest.projectId !== project.id) {
    addIssue(
      issues,
      "error",
      "project-mismatch",
      "projectId",
      `UI skin project '${manifest.projectId}' does not match '${project.id}'.`,
    );
  }

  const knownFonts = fontIds(fonts);
  const assets = new Map(project.assets.map((asset) => [asset.id as string, asset] as const));
  const skinIds = new Set<string>();
  manifest.skins.forEach((skin, skinIndex) => {
    const path = `skins[${skinIndex}]`;
    if (skinIds.has(skin.id)) {
      addIssue(issues, "error", "duplicate-skin", `${path}.id`, `UI skin '${skin.id}' is duplicated.`);
    }
    skinIds.add(skin.id);
    if (
      skin.nativeSize.width !== project.presentation.nativeWidth ||
      skin.nativeSize.height !== project.presentation.nativeHeight
    ) {
      addIssue(
        issues,
        "error",
        "native-size-mismatch",
        `${path}.nativeSize`,
        `UI skin '${skin.id}' does not match the ${project.presentation.nativeWidth} × ${project.presentation.nativeHeight} project canvas.`,
      );
    }

    const regions = skinRegions(skin);
    const regionIds = new Set<string>();
    regions.forEach((region, regionIndex) => {
      const regionPath = `${path}.regions[${regionIndex}]`;
      if (regionIds.has(region.id)) {
        addIssue(
          issues,
          "error",
          "duplicate-region",
          `${regionPath}.id`,
          `UI region '${region.id}' is duplicated in skin '${skin.id}'.`,
        );
      }
      regionIds.add(region.id);
      if (
        region.rect.x + region.rect.width > skin.nativeSize.width ||
        region.rect.y + region.rect.height > skin.nativeSize.height
      ) {
        addIssue(
          issues,
          "error",
          "region-out-of-bounds",
          `${regionPath}.rect`,
          `UI region '${region.id}' exceeds the native canvas.`,
        );
      }
    });
    for (let left = 0; left < regions.length; left += 1) {
      for (let right = left + 1; right < regions.length; right += 1) {
        const leftRegion = regions[left];
        const rightRegion = regions[right];
        if (leftRegion && rightRegion && rectanglesOverlap(leftRegion.rect, rightRegion.rect)) {
          addIssue(
            issues,
            "warning",
            "region-overlap",
            `${path}.regions`,
            `UI regions '${leftRegion.id}' and '${rightRegion.id}' overlap.`,
          );
        }
      }
    }

    const verbIds = new Set<string>();
    const shortcuts = new Set<string>();
    skin.verbs.forEach((verb, verbIndex) => {
      const verbPath = `${path}.verbs[${verbIndex}]`;
      if (verbIds.has(verb.id)) {
        addIssue(issues, "error", "duplicate-verb", `${verbPath}.id`, `UI verb '${verb.id}' is duplicated.`);
      }
      verbIds.add(verb.id);
      if (verb.shortcut) {
        const normalized = verb.shortcut.toLocaleLowerCase("en-US");
        if (shortcuts.has(normalized)) {
          addIssue(
            issues,
            "error",
            "duplicate-shortcut",
            `${verbPath}.shortcut`,
            `Shortcut '${verb.shortcut}' is duplicated.`,
          );
        }
        shortcuts.add(normalized);
      }
      if (verb.iconFrameId && !verb.iconAssetId) {
        addIssue(
          issues,
          "error",
          "icon-frame-without-asset",
          `${verbPath}.iconFrameId`,
          `Verb '${verb.id}' declares a frame without an icon asset.`,
        );
      }
      if (verb.iconAssetId) {
        const asset = assets.get(verb.iconAssetId);
        if (!asset) {
          addIssue(
            issues,
            "error",
            "unknown-icon-asset",
            `${verbPath}.iconAssetId`,
            `Verb icon asset '${verb.iconAssetId}' does not exist.`,
          );
        } else if (asset.kind !== "image" && asset.kind !== "spritesheet") {
          addIssue(
            issues,
            "error",
            "icon-asset-kind",
            `${verbPath}.iconAssetId`,
            `Verb icon asset '${verb.iconAssetId}' is '${asset.kind}', not an image or spritesheet.`,
          );
        }
      }
    });

    validateFontRole(issues, knownFonts, skin.fonts.status, `${path}.fonts.status`);
    validateFontRole(issues, knownFonts, skin.fonts.verb, `${path}.fonts.verb`);
    validateFontRole(issues, knownFonts, skin.fonts.inventory, `${path}.fonts.inventory`);
    validateFontRole(issues, knownFonts, skin.fonts.score, `${path}.fonts.score`);
    validateFontRole(issues, knownFonts, skin.fonts.parser, `${path}.fonts.parser`);
    validateFontRole(issues, knownFonts, skin.fonts.dialogue, `${path}.fonts.dialogue`);
    validateModeRequirements(issues, project, skin, path);
  });

  const defaultSkin = manifest.skins.find((skin) => skin.id === manifest.defaultSkinId);
  if (!defaultSkin) {
    addIssue(
      issues,
      "error",
      "missing-default-skin",
      "defaultSkinId",
      `Default UI skin '${manifest.defaultSkinId}' does not exist.`,
    );
  } else if (defaultSkin.interactionMode !== project.presentation.interactionMode) {
    addIssue(
      issues,
      "error",
      "default-mode-mismatch",
      "defaultSkinId",
      `Default skin mode '${defaultSkin.interactionMode}' does not match project mode '${project.presentation.interactionMode}'.`,
    );
  }

  return issues;
};

export const uiSkinById = (
  manifest: UiSkinManifest,
  skinId: Id<"ui-skin"> = manifest.defaultSkinId,
): UiSkin => {
  const skin = manifest.skins.find((candidate) => candidate.id === skinId);
  if (!skin) throw new Error(`UI skin '${skinId}' does not exist.`);
  return skin;
};

export const interactionModeMatchesSkin = (
  presentation: Pick<PresentationProfile, "interactionMode">,
  skin: UiSkin,
): boolean => presentation.interactionMode === skin.interactionMode;
