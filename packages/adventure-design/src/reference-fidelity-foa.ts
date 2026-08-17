import { commonCapabilities } from "./reference-fidelity-common-capabilities.js";
import { commonScenarios, ids, pack, scenario, titleCapability, variant } from "./reference-fidelity-foundation.js";

const foaSpecific = [
  titleCapability(
    "persistent-verb-panel",
    "Persistent verb panel",
    "input",
    "Reserve the lower interface region and retain exact verb availability and selection state.",
  ),
  titleCapability(
    "sentence-construction",
    "Sentence construction",
    "input",
    "Preview the complete verb, object and inventory command before execution.",
  ),
  titleCapability(
    "multi-route-structure",
    "Multi-route structure",
    "routing",
    "Support materially different team, wits and action-like routes through shared world state.",
  ),
  titleCapability(
    "companion-state",
    "Companion state",
    "narrative",
    "Persist companion availability, trust, dialogue and route-specific behaviour.",
  ),
  titleCapability(
    "travel-map",
    "Travel map",
    "routing",
    "Open destinations and preserve geographic progression through a deterministic travel interface.",
  ),
  titleCapability(
    "alternative-puzzle-solutions",
    "Alternative puzzle solutions",
    "routing",
    "Resolve multiple valid approaches with distinct state and feedback rather than aliases.",
  ),
  titleCapability(
    "dialogue-tree",
    "Branching dialogue tree",
    "narrative",
    "Preserve choice availability, consequence and re-entry across route variants.",
  ),
  titleCapability(
    "action-fight-system",
    "Action and fight system",
    "system",
    "Contain optional action sequences within deterministic adventure state and recovery.",
  ),
  titleCapability(
    "route-dependent-world-state",
    "Route-dependent world state",
    "routing",
    "Reflect chosen route, companion and solved alternatives in later rooms and outcomes.",
  ),
] as const;

export const foaReferenceTitlePack = pack({
    id: "reference.foa.dos-vga",
    titleId: "indiana-jones-fate-of-atlantis",
    referenceTitle: "Indiana Jones and the Fate of Atlantis",
    label: "Fate of Atlantis technical grammar",
    summary:
      "SCUMM5 pulp adventure with persistent verbs, sentence construction, travel and " +
      "alternate routes.",
    engineDialectId: "lucasarts-scumm5-vga",
    profileId: "pulp-archaeology-vga",
    variants: [
      variant(
        "foa.dos.floppy.en",
        "indiana-jones-fate-of-atlantis",
        "lucasarts-scumm5-vga",
        "floppy",
        "DOS VGA floppy",
        ["Text, music and interface timing are measured independently from the talkie release."],
      ),
      variant(
        "foa.dos.cd.en",
        "indiana-jones-fate-of-atlantis",
        "lucasarts-scumm5-vga",
        "cd",
        "DOS VGA CD talkie",
        ["Speech pacing and digital-audio transitions must preserve sentence and route state."],
      ),
    ],
    capabilities: [...commonCapabilities, ...foaSpecific],
    scenarios: [
      ...commonScenarios("scenario.foa", ids(foaSpecific)),
      scenario(
        "scenario.foa.route-divergence",
        "Route divergence and convergence",
        "Prove distinct route gameplay, companion state and later world consequences.",
        [
          "multi-route-structure",
          "companion-state",
          "alternative-puzzle-solutions",
          "travel-map",
          "route-dependent-world-state",
        ],
        [
          "Branch from one canonical pre-route save into three route strategies.",
          "Complete one route-specific obstacle and travel transition per branch.",
          "Compare companion and later-room state without forcing identical solutions.",
        ],
        "All routes remain completable, materially distinct and deterministic at later convergence points.",
      ),
    ],
    originalProof: {
      showcaseId: "showcase.sunken-dial",
      title: "The Sunken Dial",
      profileId: "pulp-archaeology-vga",
      status: "available",
      originalAssetsOnly: true,
      featuredSystems: ["persistent verbs", "sentence line", "alternate routes", "travel map"],
      note: "Expand The Sunken Dial into the governed original SCUMM5-style route proof.",
    },
  });
