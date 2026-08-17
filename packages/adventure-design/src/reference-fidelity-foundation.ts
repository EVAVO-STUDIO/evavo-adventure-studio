import type {
  AdventureReferenceCapabilityCategory,
  AdventureReferenceCapabilityId,
  AdventureReferenceCapabilityRequirement,
  AdventureReferenceEngineDialect,
  AdventureReferenceEngineDialectId,
  AdventureReferenceScenario,
  AdventureReferenceTitleId,
  AdventureReferenceTitlePack,
  AdventureReferenceVariant,
} from "./reference-fidelity-types.js";
import { capability, commonCapabilities, runtimeEvidence } from "./reference-fidelity-common-capabilities.js";

const baselineIds = commonCapabilities.map((entry) => entry.id);

const dialect = (
  id: AdventureReferenceEngineDialectId,
  label: string,
  summary: string,
  notes: readonly string[],
): AdventureReferenceEngineDialect => ({
  dialectVersion: 1,
  id,
  label,
  summary,
  nativeSize: { width: 320, height: 200 },
  paletteMode: "indexed-8-bit",
  logicalTicksPerSecond: 60,
  baselineCapabilityIds: baselineIds,
  notes,
});

export const adventureReferenceEngineDialects: readonly AdventureReferenceEngineDialect[] = [
  dialect(
    "sierra-sci1-vga",
    "Sierra SCI1 VGA dialect",
    "Icon-led Sierra VGA room, cursor, score, narration and lifecycle behaviour.",
    [
      "Treat icon selection, score feedback, narration and death recovery as separate contracts.",
      "Edition-specific timing and audio remain variant data rather than hidden profile assumptions.",
    ],
  ),
  dialect(
    "sierra-sci32-vga",
    "Sierra SCI32 VGA dialect",
    "Later Sierra VGA foundations supporting portrait, investigation, procedure and RPG subsystems.",
    [
      "Title packs must declare their own subsystem graph instead of sharing one Gothic runtime.",
      "Floppy and CD releases remain explicit variants even when they share most world data.",
    ],
  ),
  dialect(
    "lucasarts-scumm5-vga",
    "LucasArts SCUMM5 VGA dialect",
    "Persistent verb, sentence-line, inventory and route-state behaviour for illustrated pulp adventure.",
    [
      "The persistent interface is part of native composition, not an overlay added after art production.",
      "Alternate routes and companion state require deterministic state-graph evidence.",
    ],
  ),
] as const;

export const variant = (
  id: string,
  titleId: AdventureReferenceTitleId,
  engineDialectId: AdventureReferenceEngineDialectId,
  media: "floppy" | "cd",
  label: string,
  notes: readonly string[],
): AdventureReferenceVariant => ({
  id,
  titleId,
  engineDialectId,
  platform: "dos",
  media,
  language: "en",
  label,
  notes,
});

export const scenario = (
  id: string,
  label: string,
  description: string,
  requiredCapabilityIds: readonly AdventureReferenceCapabilityId[],
  steps: readonly string[],
  expectedOutcome: string,
): AdventureReferenceScenario => ({
  id,
  label,
  description,
  requiredCapabilityIds,
  steps,
  expectedOutcome,
});

export const commonScenarios = (
  prefix: string,
  titleSpecificCapabilityIds: readonly AdventureReferenceCapabilityId[],
): readonly AdventureReferenceScenario[] => [
  scenario(
    `${prefix}.boot-and-input`,
    "Boot, presentation and first input",
    "Prove the exact native presentation, interface and first meaningful input for the selected release.",
    [
      "native-320x200",
      "indexed-256-colour",
      "integer-scaling",
      "nearest-neighbour-sampling",
      "bitmap-typography",
      "semantic-cursors",
    ],
    [
      "Boot the selected release variant from a clean state.",
      "Verify native frame, interface geometry, typography and first cursor acknowledgement.",
      "Retain a screenshot and semantic trace for the first meaningful action.",
    ],
    "The exact release variant reaches a readable interactive frame and " +
      "acknowledges input deterministically.",
  ),
  scenario(
    `${prefix}.stateful-puzzle`,
    "Stateful puzzle progression",
    "Exercise a recoverable title-specific puzzle from initial state through visible consequence.",
    [
      "walk-areas",
      "depth-scaling",
      "inventory-state",
      "dialogue-state",
      ...titleSpecificCapabilityIds,
    ],
    [
      "Enter the puzzle from its unsolved canonical state.",
      "Exercise an incomplete or incorrect action and retain recoverable feedback.",
      "Complete the intended causal chain and revisit the changed room state.",
    ],
    "The puzzle remains recoverable and leaves the authored world, inventory and " +
      "dialogue consequences visible.",
  ),
  scenario(
    `${prefix}.save-roundtrip`,
    "Save, load and replay roundtrip",
    "Prove exact restoration and replay closure while a title-specific subsystem is active.",
    [
      "save-slot-ui",
      "exact-save-restore",
      "deterministic-replay",
      "variant-specific-presentation",
    ],
    [
      "Save during a non-trivial title-specific subsystem state.",
      "Mutate the world, then restore the save through the release-appropriate interface.",
      "Replay the retained input sequence and compare the final save fingerprint.",
    ],
    "Restore and replay converge on the same canonical world and subsystem state.",
  ),
  scenario(
    `${prefix}.terminal-outcome`,
    "Terminal outcome and recovery",
    "Prove one governed ending or failure and its bounded recovery path in original proof content.",
    ["terminal-outcome", "exact-save-restore", "original-proof-content"],
    [
      "Reach one governed success or failure state in the original proof.",
      "Verify interaction freezes or redirects according to the lifecycle contract.",
      "Exercise restart, load or title recovery and retain evidence of the resulting state.",
    ],
    "The lifecycle outcome is explicit, recoverable and reproducible through save and replay evidence.",
  ),
];

const boundary = {
  permitted: [
    "Engine behaviour measurements, timing ranges and capability contracts.",
    "Private comparison traces produced from a legitimately owned local installation.",
    "Original EVAVO characters, rooms, dialogue, music, interface art and puzzle content.",
  ],
  prohibited: [
    "Commercial art, sprites, portraits, interface artwork or extracted screenshots " +
      "in distributable fixtures.",
    "Commercial music, speech, sound effects or other audio assets.",
    "Commercial dialogue, scripts, text, maps or narrative data.",
    "Commercial characters, logos, names used as original proof content or branded artwork.",
    "Commercial room layouts, scene reproductions or puzzle solutions copied into " +
      "bundled demonstrations.",
  ],
} as const;

export const titleCapability = (
  id: AdventureReferenceCapabilityId,
  label: string,
  category: AdventureReferenceCapabilityCategory,
  description: string,
  critical = true,
): AdventureReferenceCapabilityRequirement =>
  capability(id, label, category, critical, description, runtimeEvidence, critical ? 2 : 1);

export const pack = (
  input: Omit<AdventureReferenceTitlePack, "packVersion" | "redistributionBoundary">,
): AdventureReferenceTitlePack => ({
  packVersion: 1,
  ...input,
  redistributionBoundary: boundary,
});


export const ids = (values: readonly AdventureReferenceCapabilityRequirement[]) =>
  values.map((entry) => entry.id);
