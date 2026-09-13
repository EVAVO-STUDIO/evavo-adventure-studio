import { commonCapabilities } from "./reference-fidelity-common-capabilities.js";
import { commonScenarios, ids, pack, scenario, titleCapability, variant } from "./reference-fidelity-foundation.js";

const gk1Specific = [
  titleCapability(
    "chapter-day-progression",
    "Chapter and day progression",
    "narrative",
    "Gate location, witness and evidence changes through explicit chapter state.",
  ),
  titleCapability(
    "topic-dialogue",
    "Topic dialogue",
    "investigation",
    "Open, exhaust and condition dialogue topics through evidence and prior testimony.",
  ),
  titleCapability(
    "evidence-research",
    "Evidence and research",
    "investigation",
    "Connect physical clues, research results and deductions in a persistent evidence graph.",
  ),
  titleCapability(
    "portrait-conversation",
    "Portrait conversation",
    "narrative",
    "Present stable character identity, expression and eyeline during long-form interviews.",
  ),
  titleCapability(
    "close-up-investigation",
    "Close-up investigation",
    "investigation",
    "Enter and exit evidence close-ups without losing room, cursor or actor state.",
  ),
  titleCapability(
    "investigation-gating",
    "Investigation gating",
    "investigation",
    "Require the correct evidence understanding rather than only arbitrary flag order.",
  ),
] as const;

export const gk1ReferenceTitlePack = pack({
    id: "reference.gk1.dos-vga",
    titleId: "gabriel-knight-sins-of-the-fathers",
    referenceTitle: "Gabriel Knight: Sins of the Fathers",
    label: "Gabriel Knight 1 technical grammar",
    summary: "SCI32 chapter investigation with research, topics, portraits, close-ups and evidence gating.",
    engineDialectId: "sierra-sci32-vga",
    profileId: "gothic-investigation-vga",
    variants: [
      variant(
        "gk1.dos.floppy.en",
        "gabriel-knight-sins-of-the-fathers",
        "sierra-sci32-vga",
        "floppy",
        "DOS VGA floppy",
        ["Text pacing, portrait timing and audio structure are captured separately."],
      ),
      variant(
        "gk1.dos.cd.en",
        "gabriel-knight-sins-of-the-fathers",
        "sierra-sci32-vga",
        "cd",
        "DOS VGA CD",
        ["Speech timing and voiced dialogue must preserve the same canonical topic state."],
      ),
    ],
    capabilities: [...commonCapabilities, ...gk1Specific],
    scenarios: commonScenarios("scenario.gk1", ids(gk1Specific)),
    originalProof: {
      showcaseId: "showcase.red-ledger",
      title: "The Red Ledger",
      profileId: "gothic-investigation-vga",
      status: "available",
      originalAssetsOnly: true,
      featuredSystems: ["topic dialogue", "physical evidence", "portrait interviews", "chapter state"],
      note:
        "The existing Red Ledger vertical slice is the governed original investigation proof.",
    },
  });
