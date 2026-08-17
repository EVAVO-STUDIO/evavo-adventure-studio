import { commonCapabilities } from "./reference-fidelity-common-capabilities.js";
import { commonScenarios, ids, pack, scenario, titleCapability, variant } from "./reference-fidelity-foundation.js";

const kq5Specific = [
  titleCapability(
    "temporary-icon-bar",
    "Temporary icon bar",
    "input",
    "Open and dismiss the complete action icon set without permanently reducing room composition.",
  ),
  titleCapability(
    "narration-feedback",
    "Narration feedback",
    "narrative",
    "Resolve look, use and failure feedback through authored narration with deterministic reading time.",
  ),
  titleCapability(
    "score-counter",
    "Visible score counter",
    "system",
    "Award stable score changes and preserve the total through save, load and replay.",
  ),
  titleCapability(
    "death-restart-flow",
    "Death and restart flow",
    "narrative",
    "Present explicit death feedback and bounded restart, load or title recovery.",
  ),
  titleCapability(
    "storybook-room-state",
    "Storybook room-state change",
    "world",
    "Make solved fantasy mechanisms and route changes visible in the illustrated room.",
  ),
] as const;

export const kq5ReferenceTitlePack = pack({
    id: "reference.kq5.dos-vga",
    titleId: "kings-quest-v",
    referenceTitle: "King's Quest V",
    label: "King's Quest V technical grammar",
    summary: "SCI1 storybook rooms, temporary icon interaction, narration, score and recoverable death flow.",
    engineDialectId: "sierra-sci1-vga",
    profileId: "storybook-icon-vga",
    variants: [
      variant(
        "kq5.dos.floppy.en",
        "kings-quest-v",
        "sierra-sci1-vga",
        "floppy",
        "DOS VGA floppy",
        ["Text-led presentation and floppy-era audio remain explicit evidence dimensions."],
      ),
      variant(
        "kq5.dos.cd.en",
        "kings-quest-v",
        "sierra-sci1-vga",
        "cd",
        "DOS VGA CD",
        ["Speech and digital-audio behaviour must not be inferred from the floppy variant."],
      ),
    ],
    capabilities: [...commonCapabilities, ...kq5Specific],
    scenarios: commonScenarios("scenario.kq5", ids(kq5Specific)),
    originalProof: {
      showcaseId: "showcase.glass-finch",
      title: "The Glass Finch",
      profileId: "storybook-icon-vga",
      status: "available",
      originalAssetsOnly: true,
      featuredSystems: ["temporary icon bar", "score", "storybook room state", "death recovery"],
      note: "Expand the existing original Glass Finch construction proof into the playable SCI1-style lane.",
    },
  });
