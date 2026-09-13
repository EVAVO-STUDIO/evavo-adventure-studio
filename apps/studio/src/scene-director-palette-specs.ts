import type { Id } from "@evavo/adventure-project-schema";

export type SceneDirectorPaletteHex = `#${string}`;

export interface SceneDirectorPaletteBank {
  readonly label: string;
  readonly offset: number;
  readonly role: string;
  readonly colours: readonly SceneDirectorPaletteHex[];
}

export interface SceneDirectorPaletteSpec {
  readonly assetId: Id<"asset">;
  readonly entryCount: number;
  readonly banks: readonly SceneDirectorPaletteBank[];
}

const bank = (
  label: string,
  offset: number,
  role: string,
  colours: readonly SceneDirectorPaletteHex[],
): SceneDirectorPaletteBank => {
  if (colours.length !== 16) {
    throw new RangeError(`Scene Director VGA palette bank '${label}' must contain exactly 16 colours.`);
  }
  return { label, offset, role, colours };
};

const redLedgerBase = bank(
  "Actor neutral",
  0,
  "Neutral investigation-room actor ramp with restrained skin, cloth and leather values.",
  [
    "#09090c", "#141319", "#211d24", "#302831",
    "#44343b", "#5a4143", "#765254", "#956867",
    "#b17e73", "#ca9682", "#ddb09a", "#ebc7b2",
    "#544d5e", "#71687b", "#948a9d", "#c0b7c5",
  ],
);

const redLedgerWarm = bank(
  "Desk lamp warm",
  64,
  "Localized tungsten-like practical-light substitution; warm skin and paper without modern yellow tint.",
  [
    "#0b0908", "#1c1512", "#302019", "#493025",
    "#654032", "#835342", "#a56852", "#c17f61",
    "#d99a72", "#e8b286", "#f0c99d", "#f5dcba",
    "#635442", "#806c52", "#a68c69", "#d2b78f",
  ],
);

const redLedgerShadow = bank(
  "Rain shadow cool",
  96,
  "Cool blue-violet exterior shadow bank retaining readable faces against wet masonry.",
  [
    "#080a0f", "#101522", "#171e31", "#202940",
    "#2b3550", "#38425f", "#48516d", "#5b637d",
    "#72788f", "#898fa2", "#a2a6b6", "#bcc0cc",
    "#33394a", "#4b5265", "#697084", "#9299aa",
  ],
);

export const redLedgerActorLightingPalette: SceneDirectorPaletteSpec = {
  assetId: "asset.palette.red-ledger.actor-lighting" as Id<"asset">,
  entryCount: 128,
  banks: [redLedgerBase, redLedgerWarm, redLedgerShadow],
};

const nightShiftBase = bank(
  "Officer neutral",
  0,
  "Grounded municipal actor colours: dark uniform/navy, natural skin, brown leather and restrained highlights.",
  [
    "#080b0e", "#111820", "#19242f", "#233342",
    "#304455", "#40596c", "#526f83", "#68869a",
    "#7f604f", "#9d7560", "#bb8e74", "#d2a98e",
    "#dcc0aa", "#7f8790", "#a1a8ad", "#d1d4d2",
  ],
);

const nightShiftFluorescent = bank(
  "Station fluorescent",
  32,
  "Cool institutional fluorescent substitution with flattened warmth and slightly cyan neutral highlights.",
  [
    "#080c0e", "#10191e", "#17262e", "#20353f",
    "#2b4651", "#395965", "#4b6e79", "#60838d",
    "#745f57", "#8c7569", "#a68c7b", "#bda493",
    "#d0bbab", "#788d91", "#9cafb1", "#c8d2d0",
  ],
);

const nightShiftHeadlamp = bank(
  "Roadside headlamp",
  64,
  "Warm headlamp/practical bank for roadside figures; amber lift without bloom or smooth exposure.",
  [
    "#0c0a08", "#1c1610", "#302318", "#493321",
    "#65472b", "#835c36", "#a37142", "#c0884d",
    "#90654e", "#ae7d5f", "#c89572", "#ddb18e",
    "#ebc9aa", "#8d7553", "#b39a6d", "#e2c990",
  ],
);

const nightShiftDinerWarm = bank(
  "Diner practical warm",
  96,
  "Muted cream-and-amber late-diner practical ramp that lifts faces and paper while preserving dark navy uniform values.",
  [
    "#0b0908", "#19130f", "#2a1e16", "#3c2a1d",
    "#513824", "#69482e", "#825b3a", "#9d7048",
    "#8e6b59", "#aa8069", "#c3997d", "#d8b091",
    "#e8c8ab", "#8b806a", "#b0a183", "#d9ceb3",
  ],
);

export const nightShiftActorLightingPalette: SceneDirectorPaletteSpec = {
  assetId: "asset.palette.night-shift.actor-lighting" as Id<"asset">,
  entryCount: 128,
  banks: [nightShiftBase, nightShiftFluorescent, nightShiftHeadlamp, nightShiftDinerWarm],
};

export const sceneDirectorPaletteSpecs: readonly SceneDirectorPaletteSpec[] = [
  redLedgerActorLightingPalette,
  nightShiftActorLightingPalette,
] as const;

export const sceneDirectorPaletteSpecByAssetId = (
  assetId: Id<"asset"> | string,
): SceneDirectorPaletteSpec | null =>
  sceneDirectorPaletteSpecs.find((spec) => spec.assetId === assetId) ?? null;

export const sceneDirectorPaletteBankAtOffset = (
  spec: SceneDirectorPaletteSpec,
  offset: number,
): SceneDirectorPaletteBank | null => spec.banks.find((candidate) => candidate.offset === offset) ?? null;

export const validateSceneDirectorPaletteSpec = (
  spec: SceneDirectorPaletteSpec,
): readonly string[] => {
  const issues: string[] = [];
  const occupied = new Set<number>();
  for (const paletteBank of spec.banks) {
    if (paletteBank.offset < 0 || paletteBank.offset + paletteBank.colours.length > spec.entryCount) {
      issues.push(`${paletteBank.label} exceeds palette entry count ${spec.entryCount}.`);
    }
    paletteBank.colours.forEach((_colour, index) => {
      const entry = paletteBank.offset + index;
      if (occupied.has(entry)) issues.push(`${paletteBank.label} overlaps palette entry ${entry}.`);
      occupied.add(entry);
    });
  }
  return issues;
};
