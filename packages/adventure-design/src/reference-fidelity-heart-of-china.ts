import { commonCapabilities } from "./reference-fidelity-common-capabilities.js";
import {
  commonScenarios,
  ids,
  pack,
  scenario,
  titleCapability,
  variant,
} from "./reference-fidelity-foundation.js";

const heartOfChinaSpecific = [
  titleCapability(
    "full-screen-cinematic-panels",
    "Full-screen cinematic panels",
    "cinematic",
    "Stage travel, dialogue, action and consequence as authored full-screen VGA compositions.",
  ),
  titleCapability(
    "protagonist-switching",
    "Protagonist switching",
    "narrative",
    "Switch active protagonists while preserving separate knowledge, inventory and social context.",
  ),
  titleCapability(
    "relationship-state",
    "Relationship consequence state",
    "narrative",
    "Persist trust, fatigue and disagreement so choices alter later scenes and outcomes.",
  ),
  titleCapability(
    "route-time-costs",
    "Route and time costs",
    "time",
    "Apply explicit travel and conversation costs that materially change later route availability.",
  ),
  titleCapability(
    "editorial-travel-montage",
    "Editorial travel montage",
    "cinematic",
    "Preserve geography, elapsed time and causal state through hard-cut travel panels.",
  ),
  titleCapability(
    "knowledge-separation",
    "Separated protagonist knowledge",
    "narrative",
    "Keep what each protagonist knows distinct from audience-only cinematic information.",
  ),
  titleCapability(
    "action-sequence-windows",
    "Cinematic action windows",
    "action",
    "Resolve train, vehicle or combat inserts through deterministic authored input windows.",
  ),
  titleCapability(
    "action-telegraph-timing",
    "Readable action telegraphs",
    "action",
    "Signal every required action through silhouette, sound and held anticipation before input closes.",
  ),
  titleCapability(
    "safe-action-retry",
    "Safe action retry",
    "action",
    "Restore a named pre-action anchor without erasing route, investigation or relationship state.",
  ),
] as const;

export const heartOfChinaReferenceTitlePack = pack({
  id: "reference.heart-of-china.dos-vga",
  titleId: "heart-of-china",
  referenceTitle: "Heart of China",
  label: "Heart of China technical grammar",
  summary:
    "DGDS cinematic travel with protagonist switching, relationship consequences, " +
    "costed routes, editorial montages and recoverable action inserts.",
  engineDialectId: "dynamix-dgds-vga",
  profileId: "cinematic-pulp-vga",
  variants: [
    variant(
      "heart-of-china.dos.floppy.en",
      "heart-of-china",
      "dynamix-dgds-vga",
      "floppy",
      "DOS VGA floppy",
      [
        "The floppy release owns its exact room, panel, timing and audio evidence.",
        "Action and travel behaviour must be measured independently from repackaged releases.",
      ],
    ),
    variant(
      "heart-of-china.dos.digital.en",
      "heart-of-china",
      "dynamix-dgds-vga",
      "digital",
      "DOS VGA digital distribution",
      [
        "Digital packaging is treated as an explicit release variant rather than assumed identical.",
        "Only behavioural measurements may enter distributed Adventure Studio fixtures.",
      ],
    ),
  ],
  capabilities: [...commonCapabilities, ...heartOfChinaSpecific],
  scenarios: [
    ...commonScenarios("scenario.heart-of-china", ids(heartOfChinaSpecific)),
    scenario(
      "scenario.heart-of-china.route-relationship",
      "Route, protagonist and relationship proof",
      "Prove that route cost, active protagonist and trust create distinct later scenes and outcomes.",
      [
        "protagonist-switching",
        "relationship-state",
        "route-time-costs",
        "editorial-travel-montage",
        "knowledge-separation",
      ],
      [
        "Begin from one canonical airstrip state with both protagonists available.",
        "Resolve one route after disclosing a costly truth and retain the montage and trust state.",
        "Replay from the same start while concealing the truth and choose the faster route.",
        "Compare location, elapsed time, knowledge, trust and later action recovery.",
      ],
      "Both routes remain valid while producing materially different time, relationship " +
        "and scene consequences.",
    ),
    scenario(
      "scenario.heart-of-china.action-retry",
      "Editorial action and retry proof",
      "Prove readable action windows, failure consequence and restoration to a named safe anchor.",
      [
        "action-sequence-windows",
        "action-telegraph-timing",
        "safe-action-retry",
        "exact-save-restore",
        "deterministic-replay",
      ],
      [
        "Enter an original vehicle or train action from a retained canonical anchor.",
        "Miss one telegraphed input and retain the failure panel and unchanged route history.",
        "Retry from the safe anchor and complete every authored input window.",
        "Replay both attempts and compare the final save fingerprint.",
      ],
      "Failure is legible and recoverable; success reaches the same deterministic route state on replay.",
    ),
  ],
  originalProof: {
    showcaseId: "showcase.jade-horizon",
    title: "Jade Horizon",
    profileId: "cinematic-pulp-vga",
    status: "planned",
    originalAssetsOnly: true,
    featuredSystems: [
      "multiple protagonists",
      "relationship state",
      "costed routes",
      "travel montages",
      "recoverable action inserts",
    ],
    note:
      "The original construction showcase and deterministic systems contract exist; " +
      "the packaged playable cinematic slice remains a separate evidence milestone.",
  },
});
