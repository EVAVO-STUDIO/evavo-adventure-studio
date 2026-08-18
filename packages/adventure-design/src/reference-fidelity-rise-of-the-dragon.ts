import { commonCapabilities } from "./reference-fidelity-common-capabilities.js";
import {
  commonScenarios,
  ids,
  pack,
  scenario,
  titleCapability,
  variant,
} from "./reference-fidelity-foundation.js";

const riseOfTheDragonSpecific = [
  titleCapability(
    "full-screen-cinematic-panels",
    "Full-screen cinematic panels",
    "cinematic",
    "Stage apartment, street, office, evidence and danger beats as hard-cut VGA panels.",
  ),
  titleCapability(
    "visible-game-clock",
    "Visible game clock",
    "time",
    "Expose the case date and time while advancing one game minute per three hundred logical ticks.",
  ),
  titleCapability(
    "scheduled-contact-windows",
    "Scheduled contact windows",
    "time",
    "Open and close witness, office and transit access through inspectable schedule state.",
  ),
  titleCapability(
    "time-costed-actions",
    "Time-costed actions",
    "time",
    "Charge travel, dialogue, evidence and action decisions against the same canonical clock.",
  ),
  titleCapability(
    "deadline-outcomes",
    "Deadline-driven outcomes",
    "time",
    "Resolve missed contacts and terminal broadcasts into explicit recoverable lifecycle states.",
  ),
  titleCapability(
    "relationship-state",
    "Contact relationship state",
    "narrative",
    "Persist trust, fear and cooperation so evidence delivery changes later assistance.",
  ),
  titleCapability(
    "action-sequence-windows",
    "Cinematic action windows",
    "action",
    "Resolve first-person combat or escape inserts through deterministic authored input windows.",
  ),
  titleCapability(
    "action-telegraph-timing",
    "Readable action telegraphs",
    "action",
    "Telegraph required input with a native silhouette, sound cue and held anticipation frame.",
  ),
  titleCapability(
    "safe-action-retry",
    "Safe action retry",
    "action",
    "Restore a named pre-action anchor while preserving clock, evidence and relationship state.",
  ),
  titleCapability(
    "knowledge-separation",
    "Investigator and audience knowledge",
    "investigation",
    "Keep evidence known to the investigator separate from audience-only cinematic reveals.",
  ),
] as const;

export const riseOfTheDragonReferenceTitlePack = pack({
  id: "reference.rise-of-the-dragon.dos-vga",
  titleId: "rise-of-the-dragon",
  referenceTitle: "Rise of the Dragon",
  label: "Rise of the Dragon technical grammar",
  summary:
    "DGDS clock-driven cyber-noir with scheduled contacts, time-costed investigation, " +
    "relationship state, deadline outcomes and recoverable action inserts.",
  engineDialectId: "dynamix-dgds-vga",
  profileId: "cinematic-pulp-vga",
  variants: [
    variant(
      "rise-of-the-dragon.dos.floppy.en",
      "rise-of-the-dragon",
      "dynamix-dgds-vga",
      "floppy",
      "DOS VGA floppy",
      [
        "The visible clock, location access and action timing are captured from the exact floppy variant.",
        "EGA, Amiga and Macintosh releases are not silently folded into this DOS VGA contract.",
      ],
    ),
    variant(
      "rise-of-the-dragon.dos.digital.en",
      "rise-of-the-dragon",
      "dynamix-dgds-vga",
      "digital",
      "DOS VGA digital distribution",
      [
        "Digital packaging remains an explicit variant with its own executable reference trace.",
        "Distributed proof content remains original even when private comparison uses an owned installation.",
      ],
    ),
  ],
  capabilities: [...commonCapabilities, ...riseOfTheDragonSpecific],
  scenarios: [
    ...commonScenarios("scenario.rise-of-the-dragon", ids(riseOfTheDragonSpecific)),
    scenario(
      "scenario.rise-of-the-dragon.clock-window",
      "Clock and scheduled-contact proof",
      "Prove continuous clock advancement, explicit action costs and distinct missed-window outcomes.",
      [
        "visible-game-clock",
        "scheduled-contact-windows",
        "time-costed-actions",
        "deadline-outcomes",
        "exact-save-restore",
      ],
      [
        "Start from an original apartment state with the case clock visible.",
        "Advance twenty-five real-time-equivalent seconds and verify five game minutes elapse.",
        "Spend time on travel and evidence, then reach one contact before the window closes.",
        "Restore the same start, miss the contact and retain the governed failure state.",
      ],
      "Clock, costs, contact availability and failure outcome remain deterministic through save and replay.",
    ),
    scenario(
      "scenario.rise-of-the-dragon.action-retry",
      "Cyber-noir action and safe-retry proof",
      "Prove an action failure preserves evidence and time while returning to an authored safe anchor.",
      [
        "action-sequence-windows",
        "action-telegraph-timing",
        "safe-action-retry",
        "relationship-state",
        "knowledge-separation",
      ],
      [
        "Enter an original danger location after evidence and contact state are established.",
        "Miss one clearly telegraphed input and inspect retained clock, evidence and trust.",
        "Retry from the named anchor and complete the bounded sequence.",
        "Verify that success opens a different terminal state before the final deadline.",
      ],
      "Action play remains integrated with investigation, clock and relationship state " +
        "rather than becoming a separate game.",
    ),
  ],
  originalProof: {
    showcaseId: "showcase.dead-channel",
    title: "Dead Channel",
    profileId: "cinematic-pulp-vga",
    status: "planned",
    originalAssetsOnly: true,
    featuredSystems: [
      "visible case clock",
      "scheduled contacts",
      "evidence-gated locations",
      "contact trust",
      "recoverable action inserts",
    ],
    note:
      "Dead Channel is the original clock-driven systems proof; a packaged playable " +
      "slice must be retained before this title lane can report playable evidence.",
  },
});
