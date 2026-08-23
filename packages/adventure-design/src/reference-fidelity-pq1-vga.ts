import { commonCapabilities } from "./reference-fidelity-common-capabilities.js";
import {
  commonScenarios,
  ids,
  pack,
  scenario,
  titleCapability,
  variant,
} from "./reference-fidelity-foundation.js";

const pq1VgaSpecific = [
  titleCapability(
    "temporary-icon-bar",
    "SCI1 icon interaction bar",
    "input",
    "Expose direct walk, look, use/touch, talk and inventory intent through a compact period icon interface rather than a persistent modern HUD.",
  ),
  titleCapability(
    "narration-feedback",
    "Grounded narration and procedural feedback",
    "narrative",
    "Return concise observation, procedure and consequence text without turning ordinary police work into quest-marker exposition.",
  ),
  titleCapability(
    "score-counter",
    "Visible procedural score",
    "system",
    "Track consequential correct actions with restrained visible score feedback appropriate to early Sierra VGA presentation.",
    false,
  ),
  titleCapability(
    "death-restart-flow",
    "Failure, death and restart flow",
    "system",
    "Resolve unsafe or seriously incorrect actions into explicit failure with a fast bounded restart or restore path.",
  ),
  titleCapability(
    "procedure-checks",
    "Readable police procedure",
    "procedure",
    "Gate equipment use, traffic stops, evidence handling and location actions on understandable procedural order rather than hidden arbitrary flags.",
  ),
  titleCapability(
    "procedural-failure",
    "Procedural failure and recovery",
    "procedure",
    "Explain what made an unsafe or invalid action fail and preserve a clear retry, restore or restart path.",
  ),
  titleCapability(
    "location-progression",
    "Patrol and municipal location progression",
    "world",
    "Move cleanly between station, street, vehicle and public-interior scenes while retaining inventory, duty and procedural state.",
  ),
] as const;

export const pq1VgaReferenceTitlePack = pack({
  id: "reference.pq1-vga-remake.dos-vga",
  titleId: "police-quest-i-vga-remake",
  referenceTitle: "Police Quest: In Pursuit of the Death Angel — VGA remake",
  label: "Police Quest I VGA remake technical grammar",
  summary:
    "Early Sierra SCI1 VGA procedural adventure: grounded contemporary rooms, compact icon interaction, " +
    "real-world proportions, readable police procedure, score/failure feedback and economical actor staging.",
  engineDialectId: "sierra-sci1-vga",
  profileId: "procedural-investigation-vga",
  variants: [
    variant(
      "pq1-vga.dos.floppy.en",
      "police-quest-i-vga-remake",
      "sierra-sci1-vga",
      "floppy",
      "DOS VGA remake",
      [
        "Treat this as an early SCI1-era VGA lane, not as Police Quest IV / SCI32 presentation.",
        "Review grounded station, street, vehicle and public-interior scenes at native 320 by 200 before any display treatment.",
        "The visual target is painted real-world observation translated into economical VGA pixels, not modern chunky pixel art or photoreal concept art.",
      ],
    ),
  ],
  capabilities: [...commonCapabilities, ...pq1VgaSpecific],
  scenarios: [
    ...commonScenarios("scenario.pq1-vga", ids(pq1VgaSpecific)),
    scenario(
      "scenario.pq1-vga.station-to-patrol",
      "Station briefing to patrol handoff",
      "Prove grounded room staging, small practical targets, equipment procedure and a clean transition into patrol state.",
      [
        "temporary-icon-bar",
        "narration-feedback",
        "procedure-checks",
        "location-progression",
        "foreground-occlusion",
        "scene-transitions",
      ],
      [
        "Enter an original station briefing room through an authored doorway arrival path.",
        "Inspect and use small equipment targets with exact hotspot precedence plus native click comfort.",
        "Attempt departure before the required equipment/procedure state and retain the explanation.",
        "Complete the equipment handoff, traverse the station exit and enter an original patrol transition.",
      ],
      "The player moves through a believable working environment with readable procedure, deliberate actor staging and no modern UI scaffolding.",
    ),
    scenario(
      "scenario.pq1-vga.roadside-stop",
      "Roadside stop procedure and failure",
      "Prove that a mundane exterior can remain visually readable while procedure, actor approach and recoverable failure stay explicit.",
      [
        "walk-areas",
        "depth-scaling",
        "foreground-occlusion",
        "procedure-checks",
        "procedural-failure",
        "death-restart-flow",
      ],
      [
        "Stage the officer, vehicle and stopped driver with authored walk lanes, scale and foreground priority.",
        "Attempt one unsafe or invalid procedural action and retain clear failure feedback.",
        "Restore or retry from the bounded recovery point without corrupting unrelated world state.",
        "Complete the stop correctly and verify location/procedural state progression.",
      ],
      "The roadside scene behaves like a directed early-90s adventure room rather than a physics sandbox or checklist UI.",
    ),
  ],
  originalProof: {
    showcaseId: "showcase.night-shift",
    title: "Night Shift",
    profileId: "procedural-investigation-vga",
    status: "planned",
    originalAssetsOnly: true,
    featuredSystems: [
      "SCI1-style icon interaction",
      "grounded municipal interiors",
      "footprint-aware staging",
      "stateful door traversal",
      "small-target click comfort",
      "procedural feedback",
      "patrol/location transitions",
      "failure and restart",
    ],
    note:
      "Night Shift is an original early-90s procedural VGA proof. It must use original rooms, people, dialogue and puzzles while measuring the reference title's production grammar.",
  },
});
