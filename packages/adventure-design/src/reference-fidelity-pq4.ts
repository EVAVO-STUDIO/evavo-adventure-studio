import { commonCapabilities } from "./reference-fidelity-common-capabilities.js";
import {
  commonScenarios,
  ids,
  pack,
  scenario,
  titleCapability,
  variant,
} from "./reference-fidelity-foundation.js";

const pq4Specific = [
  titleCapability(
    "procedure-checks",
    "Procedure checks",
    "procedure",
    "Evaluate police procedure, equipment and order of operations through explicit conditions.",
  ),
  titleCapability(
    "evidence-chain",
    "Evidence chain",
    "procedure",
    "Preserve collection, handling, analysis and presentation state for case evidence.",
  ),
  titleCapability(
    "case-state",
    "Case-state model",
    "procedure",
    "Track suspects, locations, leads and procedural milestones as one inspectable case graph.",
  ),
  titleCapability(
    "interrogation-flow",
    "Interrogation flow",
    "investigation",
    "Condition questions and testimony on evidence, procedure and prior answers.",
  ),
  titleCapability(
    "procedural-failure",
    "Procedural failure and recovery",
    "procedure",
    "Explain failed procedure and offer a bounded recovery or restart path.",
  ),
  titleCapability(
    "location-progression",
    "Location progression",
    "world",
    "Open and retire investigation locations according to case state without orphaning evidence.",
  ),
] as const;

export const pq4ReferenceTitlePack = pack({
  id: "reference.pq4.dos-vga",
  titleId: "police-quest-iv",
  referenceTitle: "Police Quest IV",
  label: "Police Quest IV technical grammar",
  summary:
    "SCI32 procedural investigation with evidence handling, case state, interrogation " +
    "and failure recovery.",
  engineDialectId: "sierra-sci32-vga",
  profileId: "procedural-investigation-vga",
  variants: [
    variant(
      "pq4.dos.floppy.en",
      "police-quest-iv",
      "sierra-sci32-vga",
      "floppy",
      "DOS VGA floppy",
      ["Procedure feedback and evidence presentation are measured against the floppy release."],
    ),
    variant(
      "pq4.dos.cd.en",
      "police-quest-iv",
      "sierra-sci32-vga",
      "cd",
      "DOS VGA CD",
      ["Voiced interrogation and release-specific presentation require separate evidence."],
    ),
  ],
  capabilities: [...commonCapabilities, ...pq4Specific],
  scenarios: [
    ...commonScenarios("scenario.pq4", ids(pq4Specific)),
    scenario(
      "scenario.pq4.evidence-procedure",
      "Evidence and procedure proof",
      "Prove that evidence collection and procedural order alter case progress and failure feedback.",
      [
        "procedure-checks",
        "evidence-chain",
        "case-state",
        "procedural-failure",
        "location-progression",
      ],
      [
        "Attempt evidence handling in an invalid order and retain the procedural explanation.",
        "Recover without losing unrelated case state.",
        "Complete collection and analysis, then verify the new location and interrogation topic.",
      ],
      "Correct procedure advances the case graph while incorrect procedure remains " +
        "explainable and recoverable.",
    ),
  ],
  originalProof: {
    showcaseId: "showcase.open-case",
    title: "Open Case",
    profileId: "procedural-investigation-vga",
    status: "planned",
    originalAssetsOnly: true,
    featuredSystems: [
      "procedure checks",
      "evidence chain",
      "case graph",
      "interrogation",
    ],
    note:
      "The original four-plate production contract now exists; playable procedural runtime proof remains the next milestone.",
  },
});
