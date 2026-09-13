import { commonCapabilities } from "./reference-fidelity-common-capabilities.js";
import { commonScenarios, ids, pack, scenario, titleCapability, variant } from "./reference-fidelity-foundation.js";

const dottSpecific = [
  titleCapability(
    "persistent-verb-panel",
    "Persistent verb panel",
    "input",
    "Reserve the lower virtual-screen panel for stable verbs and inventory while preserving readable room composition above it.",
  ),
  titleCapability(
    "sentence-construction",
    "Live sentence construction",
    "input",
    "Build and retain explicit verb, object and second-object intent before execution, including mid-sentence save/restore.",
  ),
  titleCapability(
    "protagonist-switching",
    "Three-protagonist switching",
    "world",
    "Preserve independent protagonist location and inventory while switching control through one shared deterministic world.",
  ),
  titleCapability(
    "route-dependent-world-state",
    "Cross-time world consequence",
    "world",
    "Allow one protagonist's action to change shared facts and another protagonist's local world state without merging their inventories or locations.",
  ),
  titleCapability(
    "alternative-puzzle-solutions",
    "Item transformation and combinations",
    "routing",
    "Support authored two-item recipes, persistent transformations, wrong-use feedback and later-room consequences.",
  ),
  titleCapability(
    "dialogue-tree",
    "Comic dialogue state",
    "narrative",
    "Retain conversational availability, one-shot choices and room consequences through character switching and cutaways.",
  ),
] as const;

export const dottReferenceTitlePack = pack({
  id: "reference.dott.dos-vga",
  titleId: "day-of-the-tentacle",
  referenceTitle: "Day of the Tentacle",
  label: "Day of the Tentacle technical grammar",
  summary:
    "SCUMM5 cartoon adventure with a persistent verb/sentence panel, three independently located protagonists, inventory transformations and cross-time consequences.",
  engineDialectId: "lucasarts-scumm5-vga",
  profileId: "verb-panel-cartoon-vga",
  variants: [
    variant(
      "dott.dos.floppy.en",
      "day-of-the-tentacle",
      "lucasarts-scumm5-vga",
      "floppy",
      "DOS VGA floppy",
      ["Text, interface timing and compact digital/MIDI presentation remain distinct from later voiced variants."],
    ),
    variant(
      "dott.dos.cd.en",
      "day-of-the-tentacle",
      "lucasarts-scumm5-vga",
      "cd",
      "DOS VGA CD talkie",
      ["Speech pacing must preserve verb-panel responsiveness, sentence state and comic reaction timing."],
    ),
  ],
  capabilities: [...commonCapabilities, ...dottSpecific],
  scenarios: [
    ...commonScenarios("scenario.dott", ids(dottSpecific)),
    scenario(
      "scenario.dott.cross-time-chain",
      "Cross-time three-character chain",
      "Prove sentence grammar, inventory transformation, character switching, cross-world mutation and a deterministic cutaway in one original causal chain.",
      [
        "persistent-verb-panel",
        "sentence-construction",
        "protagonist-switching",
        "route-dependent-world-state",
        "alternative-puzzle-solutions",
      ],
      [
        "Use one inventory item with another through the persistent sentence panel.",
        "Apply the resulting state change to another protagonist's era/location.",
        "Switch protagonists without changing shared score or unrelated inventory.",
        "Trigger a short room-local comic cutaway and return to the exact prior room state.",
      ],
      "The full chain remains deterministic, saveable and reversible through the intended recovery path without collapsing protagonist-local state.",
    ),
  ],
  originalProof: {
    showcaseId: "showcase.saltwake-island",
    title: "Saltwake Island",
    profileId: "verb-panel-cartoon-vga",
    status: "available",
    originalAssetsOnly: true,
    featuredSystems: [
      "persistent verbs",
      "live sentence line",
      "inventory combinations",
      "multi-protagonist state",
      "room-script cutaways",
      "comic feedback",
    ],
    note:
      "Use Saltwake Island plus the governed cross-character grammar stress proof as the original SCUMM5 comedy lane; no commercial DOTT rooms, characters or jokes are reproduced.",
  },
});
