import { commonCapabilities } from "./reference-fidelity-common-capabilities.js";
import { commonScenarios, ids, pack, scenario, titleCapability, variant } from "./reference-fidelity-foundation.js";

const lslSpecific = [
  titleCapability(
    "temporary-icon-bar",
    "Temporary icon bar",
    "input",
    "Open the complete SCI1-style action icon set without permanently reducing the social room composition.",
  ),
  titleCapability(
    "narration-feedback",
    "Narration and social feedback",
    "narrative",
    "Resolve observation, rejection, misunderstanding and successful social actions through concise authored feedback with deterministic reading time.",
  ),
  titleCapability(
    "score-counter",
    "Visible score counter",
    "system",
    "Award one-shot score for discoveries and successful social/inventory solutions and preserve it exactly through save/replay.",
  ),
  titleCapability(
    "relationship-state",
    "Social relationship state",
    "narrative",
    "Persist how important characters perceive prior introductions, gifts, mistakes and favours without reducing relationships to a visible modern meter.",
  ),
  titleCapability(
    "dialogue-tree",
    "Stateful social conversation",
    "narrative",
    "Change available conversational responses and later access according to prior social and inventory state.",
  ),
  titleCapability(
    "time-costed-actions",
    "Timed social actions",
    "time",
    "Allow selected travel, waiting and social actions to consume deterministic game time and change venue/contact availability where authored.",
  ),
  titleCapability(
    "death-restart-flow",
    "Comic failure and recovery",
    "narrative",
    "Present explicit comic failure or humiliation states with bounded retry, load, restart or alternate recovery rather than hidden dead ends.",
  ),
] as const;

export const lslVgaReferenceTitlePack = pack({
  id: "reference.lsl-vga.dos",
  titleId: "leisure-suit-larry-vga",
  referenceTitle: "Leisure Suit Larry VGA",
  label: "Leisure Suit Larry VGA technical grammar",
  summary:
    "SCI1 social comedy with temporary icon interaction, visible score, stateful venue conversations, inventory/social puzzles, authored timing and recoverable embarrassment.",
  engineDialectId: "sierra-sci1-vga",
  profileId: "social-comedy-icon-vga",
  variants: [
    variant(
      "lsl-vga.dos.floppy.en",
      "leisure-suit-larry-vga",
      "sierra-sci1-vga",
      "floppy",
      "DOS VGA floppy",
      ["Treat text, score, interface timing and floppy-era audio as explicit evidence dimensions."],
    ),
  ],
  capabilities: [...commonCapabilities, ...lslSpecific],
  scenarios: [
    ...commonScenarios("scenario.lsl-vga", ids(lslSpecific)),
    scenario(
      "scenario.lsl-vga.social-access",
      "Social access, mistake and recovery",
      "Prove that conversation, inventory, score and venue access form one readable social puzzle instead of a generic relationship meter.",
      [
        "relationship-state",
        "dialogue-tree",
        "score-counter",
        "narration-feedback",
        "death-restart-flow",
      ],
      [
        "Enter a social venue with one blocked route and at least two conversational approaches.",
        "Make one recoverable social mistake and retain specific feedback without permanently poisoning the route.",
        "Use an inventory/social clue to reopen or change the conversation.",
        "Complete the intended access chain and verify score plus visible NPC/venue state.",
      ],
      "The social puzzle remains understandable, funny, recoverable and deterministic without a modern relationship HUD.",
    ),
  ],
  originalProof: {
    showcaseId: "showcase.after-hours",
    title: "After Hours",
    profileId: "social-comedy-icon-vga",
    status: "available",
    originalAssetsOnly: true,
    featuredSystems: [
      "SCI1 icon interaction",
      "social state",
      "visible score",
      "relationship branches",
      "timed reactions",
      "recoverable embarrassment",
    ],
    note:
      "After Hours is the original social-comedy proof. It tests the production grammar without copying commercial Leisure Suit Larry rooms, characters, jokes or writing.",
  },
});
